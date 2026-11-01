"""
Robust Data Loader for The Witch's Potion Pantry
Auto-detects column names, long vs. wide formats, parses diverse date formats,
aggregates multiple sales per day, and fills missing days with 0.
"""

from __future__ import annotations
import io
import re
import os
from typing import Union, Optional, Tuple, Dict, Any, List
import pandas as pd
import numpy as np


# Candidate patterns for auto-detection
DATE_PATTERNS = [
    r"^date$", r"^day$", r"^timestamp$", r"^sale_?date$", r"^dt$", r"^datetime$",
    r"^time$", r"^trans_?date$", r"^transaction_?date$", r"^order_?date$"
]

ITEM_PATTERNS = [
    r"^ingredient_?name$", r"^ingredient_?id$", r"^ingredient$", r"^item_?name$",
    r"^item_?id$", r"^item$", r"^product_?name$", r"^product_?id$", r"^product$",
    r"^sku_?id$", r"^sku$", r"^name$"
]

QUANTITY_PATTERNS = [
    r"^units_?sold$", r"^quantity$", r"^qty$", r"^sales$", r"^demand$",
    r"^sold$", r"^units$", r"^count$", r"^volume$", r"^amount$",
    r"^predicted_?units$", r"^predicted$", r"^prediction$"
]

METADATA_COLS = [
    "category", "current_stock", "expected_stock", "safety_stock",
    "supplier", "supplier_id", "lead_time_days", "is_cursed", "notes"
]


def _match_column(columns: List[str], patterns: List[str]) -> Optional[str]:
    """Finds the best matching column from a list of column names using regex patterns."""
    for pattern in patterns:
        for col in columns:
            cleaned = str(col).strip().lower().replace("-", "_").replace(" ", "_")
            if re.match(pattern, cleaned):
                return col
    return None


def detect_columns(df: pd.DataFrame) -> Tuple[Optional[str], Optional[str], Optional[str], bool]:
    """
    Detects (date_col, item_col, qty_col, is_wide).
    If is_wide is True, non-date numeric columns represent items.
    """
    cols = list(df.columns)
    date_col = _match_column(cols, DATE_PATTERNS)

    # Fallback for date column: check if any column contains "date" or "time"
    if not date_col:
        for c in cols:
            cl = str(c).lower()
            if "date" in cl or "time" in cl or "day" in cl:
                date_col = c
                break

    # If still not found, check if first column values can be parsed as dates
    if not date_col and len(cols) > 0:
        sample_vals = df[cols[0]].dropna().head(10).astype(str)
        try:
            parsed = pd.to_datetime(sample_vals, errors="coerce")
            if parsed.notna().sum() >= max(1, len(sample_vals) * 0.7):
                date_col = cols[0]
        except Exception:
            pass

    item_col = _match_column(cols, ITEM_PATTERNS)
    qty_col = _match_column(cols, QUANTITY_PATTERNS)

    # Check for wide format:
    # Wide format has a date column, and 2 or more other numeric columns (or non-date columns)
    is_wide = False
    if date_col:
        non_date_cols = [c for c in cols if c != date_col]
        # Check if non-date columns appear to be wide item columns
        if not item_col or (len(non_date_cols) >= 2 and not qty_col):
            # Check if majority of non-date columns are numeric or convertible to numeric
            numeric_count = 0
            for c in non_date_cols:
                if pd.api.types.is_numeric_dtype(df[c]):
                    numeric_count += 1
                else:
                    converted = pd.to_numeric(df[c], errors="coerce")
                    if converted.notna().sum() >= max(1, len(df[c].dropna()) * 0.7):
                        numeric_count += 1
            if numeric_count >= 1 and (len(non_date_cols) == numeric_count or not item_col):
                is_wide = True

    return date_col, item_col, qty_col, is_wide


class FlexibleDataLoader:
    """Robust loader converting any reasonable sales CSV format into a standardized dataframe."""

    @staticmethod
    def load(
        source: Union[str, bytes, io.StringIO, pd.DataFrame],
        fill_missing_days: bool = True,
        default_stock: int = 50,
        default_safety: int = 20,
        default_lead_time: int = 3
    ) -> pd.DataFrame:
        """
        Loads CSV content or file and returns a standardized DataFrame with columns:
        ['date', 'dt', 'ingredient_id', 'ingredient_name', 'units_sold',
         'category', 'current_stock', 'safety_stock', 'supplier', 'supplier_id',
         'lead_time_days', 'is_cursed']
        """
        if isinstance(source, pd.DataFrame):
            df = source.copy()
        elif isinstance(source, (str, bytes, io.StringIO)):
            if isinstance(source, str) and os.path.exists(source) and os.path.isfile(source):
                df = pd.read_csv(source)
            elif isinstance(source, str):
                df = pd.read_csv(io.StringIO(source))
            elif isinstance(source, bytes):
                df = pd.read_csv(io.BytesIO(source))
            else:
                df = pd.read_csv(source)
        else:
            raise ValueError(f"Unsupported source type: {type(source)}")

        if df.empty:
            raise ValueError("Uploaded data contains no rows.")

        raw_columns = list(df.columns)
        date_col, item_col, qty_col, is_wide = detect_columns(df)

        if not date_col:
            raise ValueError(
                f"Could not auto-detect a date column. Found columns: {raw_columns}. "
                f"Expected a date column named like 'date', 'day', 'timestamp', or 'sale_date'."
            )

        # Parse and normalize dates
        df["dt"] = pd.to_datetime(df[date_col], errors="coerce")
        df = df.dropna(subset=["dt"]).copy()
        if df.empty:
            raise ValueError(
                f"Date column '{date_col}' contains no valid parseable dates. "
                f"Supported formats include YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, and ISO timestamps."
            )
        df["date"] = df["dt"].dt.strftime("%Y-%m-%d")

        # Handle Wide Format
        if is_wide:
            value_vars = [c for c in raw_columns if c != date_col and c != "dt" and c != "date"]
            if not value_vars:
                raise ValueError(
                    f"Wide format detected with date column '{date_col}', but no value columns found. "
                    f"Found columns: {raw_columns}."
                )
            melted = pd.melt(
                df,
                id_vars=["dt", "date"],
                value_vars=value_vars,
                var_name="ingredient_name",
                value_name="units_sold"
            )
            melted["units_sold"] = pd.to_numeric(melted["units_sold"], errors="coerce").fillna(0.0)
            melted["ingredient_id"] = melted["ingredient_name"].astype(str).apply(
                lambda s: re.sub(r"[^a-z0-9]+", "_", s.strip().lower()).strip("_")
            )
            standardized = melted
            metadata_dict = {}

        # Handle Long Format
        else:
            if not item_col:
                # If neither item nor qty detected, check error
                raise ValueError(
                    f"Could not auto-detect an ingredient/item column. Found columns: {raw_columns}. "
                    f"Expected an item column named like 'ingredient', 'item', 'product', 'sku', or 'name'."
                )
            if not qty_col:
                raise ValueError(
                    f"Could not auto-detect a quantity/sales column. Found columns: {raw_columns}. "
                    f"Expected a quantity column named like 'units_sold', 'quantity', 'qty', 'sales', or 'demand'."
                )

            # Extract item_name and item_id
            df["units_sold"] = pd.to_numeric(df[qty_col], errors="coerce").fillna(0.0)

            # Check if there's a separate ID column
            id_col_candidate = _match_column([c for c in raw_columns if c != item_col], [r"^ingredient_?id$", r"^item_?id$", r"^id$", r"^sku$"])
            if id_col_candidate:
                df["ingredient_id"] = df[id_col_candidate].astype(str).str.strip().str.lower()
                df["ingredient_name"] = df[item_col].astype(str).str.strip()
            else:
                df["ingredient_name"] = df[item_col].astype(str).str.strip()
                df["ingredient_id"] = df["ingredient_name"].apply(
                    lambda s: re.sub(r"[^a-z0-9]+", "_", s.strip().lower()).strip("_")
                )

            # Preserve metadata if present
            meta_map = {}
            for col in raw_columns:
                cl = str(col).strip().lower().replace("-", "_").replace(" ", "_")
                for m in METADATA_COLS:
                    if cl == m or (m in cl and cl not in [item_col, qty_col, date_col]):
                        meta_map[m] = col
                        break

            metadata_dict = {}
            for ing_id, group in df.groupby("ingredient_id"):
                first_row = group.iloc[0]
                meta_item = {}
                for m, src_col in meta_map.items():
                    val = first_row.get(src_col)
                    if pd.notna(val):
                        meta_item[m] = val
                metadata_dict[ing_id] = meta_item

            standardized = df[["dt", "date", "ingredient_id", "ingredient_name", "units_sold"]].copy()

        # Handle multiple sales per day: sum them per day per item
        aggregated = (
            standardized.groupby(["ingredient_id", "ingredient_name", "date"], as_index=False)["units_sold"]
            .sum()
        )
        aggregated["dt"] = pd.to_datetime(aggregated["date"])

        # Handle missing days: fill with 0
        if fill_missing_days and not aggregated.empty:
            full_frames = []
            for (ing_id, ing_name), group in aggregated.groupby(["ingredient_id", "ingredient_name"]):
                min_d = group["dt"].min()
                max_d = group["dt"].max()
                all_dates = pd.date_range(min_d, max_d, freq="D")
                date_df = pd.DataFrame({"dt": all_dates})
                date_df["date"] = date_df["dt"].dt.strftime("%Y-%m-%d")
                date_df["ingredient_id"] = ing_id
                date_df["ingredient_name"] = ing_name

                merged = pd.merge(date_df, group, on=["ingredient_id", "ingredient_name", "dt", "date"], how="left")
                merged["units_sold"] = merged["units_sold"].fillna(0.0)
                full_frames.append(merged)

            if full_frames:
                result_df = pd.concat(full_frames, ignore_index=True)
            else:
                result_df = aggregated
        else:
            result_df = aggregated

        # Sort chronologically by ingredient and date
        result_df = result_df.sort_values(["ingredient_id", "dt"]).reset_index(drop=True)

        # Attach metadata attributes per ingredient (fallback to defaults if missing)
        result_df["category"] = "General"
        result_df["current_stock"] = default_stock
        result_df["expected_stock"] = default_stock
        result_df["safety_stock"] = default_safety
        result_df["supplier"] = "General Supplier"
        result_df["supplier_id"] = "sup-general"
        result_df["lead_time_days"] = default_lead_time
        result_df["is_cursed"] = False

        if not is_wide and metadata_dict:
            for ing_id, meta in metadata_dict.items():
                mask = result_df["ingredient_id"] == ing_id
                if "category" in meta:
                    result_df.loc[mask, "category"] = str(meta["category"])
                if "current_stock" in meta:
                    try:
                        stock_val = int(meta["current_stock"])
                        result_df.loc[mask, "current_stock"] = stock_val
                        result_df.loc[mask, "expected_stock"] = stock_val
                    except (ValueError, TypeError):
                        pass
                if "safety_stock" in meta:
                    try:
                        result_df.loc[mask, "safety_stock"] = int(meta["safety_stock"])
                    except (ValueError, TypeError):
                        pass
                if "supplier" in meta:
                    result_df.loc[mask, "supplier"] = str(meta["supplier"])
                if "supplier_id" in meta:
                    result_df.loc[mask, "supplier_id"] = str(meta["supplier_id"])
                if "lead_time_days" in meta:
                    try:
                        result_df.loc[mask, "lead_time_days"] = int(meta["lead_time_days"])
                    except (ValueError, TypeError):
                        pass
                if "is_cursed" in meta:
                    result_df.loc[mask, "is_cursed"] = str(meta["is_cursed"]).lower() in ("true", "1", "yes")

        return result_df


def load_sales_data(source: Any, **kwargs) -> pd.DataFrame:
    """Convenience helper to load sales data flexibly."""
    return FlexibleDataLoader.load(source, **kwargs)

