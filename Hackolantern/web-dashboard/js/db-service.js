// js/db-service.js - Local Storage Database for Hexley's Potion Pantry
// No Firebase. All data lives in browser LocalStorage and is seeded from sample-data.js on first visit.

import {
  SAMPLE_INVENTORY,
  SAMPLE_SUPPLIERS,
  SAMPLE_SALES,
  SAMPLE_MOVEMENTS,
  SAMPLE_SETTINGS
} from "./sample-data.js";

class DatabaseService {
  constructor() {
    this.status = "demo";
  }

  initialize() {
    this.initLocalStore();
    return Promise.resolve({ status: "demo", message: "Running in Local Storage mode. All data saved in this browser." });
  }

  // Seed sample data into LocalStorage on first load (re-seeds if empty or incomplete)
  initLocalStore() {
    try {
      const inv = JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
      if (!Array.isArray(inv) || inv.length < 6) {
        localStorage.setItem("hexley_inventory", JSON.stringify(SAMPLE_INVENTORY));
      }
    } catch {
      localStorage.setItem("hexley_inventory", JSON.stringify(SAMPLE_INVENTORY));
    }

    try {
      const sup = JSON.parse(localStorage.getItem("hexley_suppliers") || "[]");
      if (!Array.isArray(sup) || sup.length === 0) {
        localStorage.setItem("hexley_suppliers", JSON.stringify(SAMPLE_SUPPLIERS));
      }
    } catch {
      localStorage.setItem("hexley_suppliers", JSON.stringify(SAMPLE_SUPPLIERS));
    }

    try {
      const sal = JSON.parse(localStorage.getItem("hexley_sales") || "[]");
      if (!Array.isArray(sal) || sal.length < 5) {
        localStorage.setItem("hexley_sales", JSON.stringify(SAMPLE_SALES));
      }
    } catch {
      localStorage.setItem("hexley_sales", JSON.stringify(SAMPLE_SALES));
    }

    try {
      const mov = JSON.parse(localStorage.getItem("hexley_movements") || "[]");
      if (!Array.isArray(mov) || mov.length < 4) {
        localStorage.setItem("hexley_movements", JSON.stringify(SAMPLE_MOVEMENTS));
      }
    } catch {
      localStorage.setItem("hexley_movements", JSON.stringify(SAMPLE_MOVEMENTS));
    }

    try {
      const set = JSON.parse(localStorage.getItem("hexley_settings") || "{}");
      if (!set || Object.keys(set).length === 0) {
        localStorage.setItem("hexley_settings", JSON.stringify(SAMPLE_SETTINGS));
      }
    } catch {
      localStorage.setItem("hexley_settings", JSON.stringify(SAMPLE_SETTINGS));
    }
  }

  resetToSampleData() {
    localStorage.setItem("hexley_inventory", JSON.stringify(SAMPLE_INVENTORY));
    localStorage.setItem("hexley_suppliers", JSON.stringify(SAMPLE_SUPPLIERS));
    localStorage.setItem("hexley_sales", JSON.stringify(SAMPLE_SALES));
    localStorage.setItem("hexley_movements", JSON.stringify(SAMPLE_MOVEMENTS));
    localStorage.setItem("hexley_settings", JSON.stringify(SAMPLE_SETTINGS));
  }

  // --- INVENTORY ---
  async getInventory() {
    return JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
  }

  async saveInventoryItem(item) {
    const items = JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
    const now = new Date().toISOString();
    let savedId = item.id;
    if (item.id) {
      const idx = items.findIndex(i => i.id === item.id);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...item, updatedAt: now };
      } else {
        items.push({ ...item, updatedAt: now });
      }
    } else {
      savedId = "item-" + Date.now();
      items.push({ ...item, id: savedId, createdAt: now, updatedAt: now });
    }
    localStorage.setItem("hexley_inventory", JSON.stringify(items));

    // Synchronize new ingredient creation with the FastAPI / Firestore backend
    try {
      fetch("http://localhost:8000/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          current_stock: Number(item.quantity) || 0,
          safety_stock: Number(item.minStock) || 10,
          supplier: item.supplierName || "Diagon Alley Apothecary",
          lead_time_days: Number(item.leadTimeDays) || 3,
          category: item.category || "Potions & Herbs",
          unit: item.unit || "jars"
        })
      }).catch(err => {
        console.warn("Backend /api/pantry sync:", err.message);
      });
    } catch (_) {}

    return savedId;
  }

  async archiveInventoryItem(itemId) {
    const items = JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.isArchived = true;
      item.updatedAt = new Date().toISOString();
      localStorage.setItem("hexley_inventory", JSON.stringify(items));
    }
  }

  // --- SALES (atomic LocalStorage simulation) ---
  async recordSaleAtomic(saleData) {
    const now = new Date().toISOString();
    const items = JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
    const movements = JSON.parse(localStorage.getItem("hexley_movements") || "[]");
    const sales = JSON.parse(localStorage.getItem("hexley_sales") || "[]");

    // Validate stock first
    for (const line of saleData.items) {
      const item = items.find(i => i.id === line.itemId);
      if (!item) throw new Error(`Ingredient not found: ${line.itemName}`);
      if (item.quantity < line.quantity) {
        throw new Error(`Cannot sell ${line.quantity} of ${item.name}! Only ${item.quantity} in stock.`);
      }
    }

    // Deduct stock and record movements
    for (const line of saleData.items) {
      const item = items.find(i => i.id === line.itemId);
      item.quantity -= line.quantity;
      item.updatedAt = now;

      movements.unshift({
        id: "mov-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        itemId: item.id,
        itemName: item.name,
        type: "sale",
        quantityDelta: -line.quantity,
        quantityAfter: item.quantity,
        reason: saleData.notes ? `Sale (${saleData.notes})` : "Customer Sale",
        timestamp: now
      });
    }

    const saleId = "sale-" + Date.now();
    sales.unshift({ id: saleId, ...saleData, timestamp: now });

    localStorage.setItem("hexley_inventory", JSON.stringify(items));
    localStorage.setItem("hexley_movements", JSON.stringify(movements));
    localStorage.setItem("hexley_sales", JSON.stringify(sales));

    return { success: true, saleId };
  }

  // --- DELIVERIES ---
  async recordDelivery({ itemId, supplierId, quantity, notes }) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) throw new Error("Delivery quantity must be a positive number.");
    const now = new Date().toISOString();

    const items = JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
    const movements = JSON.parse(localStorage.getItem("hexley_movements") || "[]");
    const item = items.find(i => i.id === itemId);
    if (!item) throw new Error("Ingredient not found in pantry");

    item.quantity = (item.quantity || 0) + qty;
    item.updatedAt = now;

    movements.unshift({
      id: "mov-" + Date.now(),
      itemId: item.id,
      itemName: item.name,
      type: "delivery",
      supplierId,
      quantityDelta: qty,
      quantityAfter: item.quantity,
      reason: notes ? `Delivery: ${notes}` : "Supplier Delivery Restock",
      timestamp: now
    });

    localStorage.setItem("hexley_inventory", JSON.stringify(items));
    localStorage.setItem("hexley_movements", JSON.stringify(movements));
    return { success: true, newQty: item.quantity };
  }

  async recordStockAdjustment({ itemId, quantityDelta, reason }) {
    const delta = parseInt(quantityDelta, 10);
    if (isNaN(delta) || delta === 0) throw new Error("Adjustment must be a non-zero number.");
    const now = new Date().toISOString();

    const items = JSON.parse(localStorage.getItem("hexley_inventory") || "[]");
    const movements = JSON.parse(localStorage.getItem("hexley_movements") || "[]");
    const item = items.find(i => i.id === itemId);
    if (!item) throw new Error("Item not found");

    const newQty = (item.quantity || 0) + delta;
    if (newQty < 0) throw new Error(`Cannot adjust below zero. Current stock is ${item.quantity}.`);

    item.quantity = newQty;
    item.updatedAt = now;

    movements.unshift({
      id: "mov-" + Date.now(),
      itemId: item.id,
      itemName: item.name,
      type: delta < 0 ? "correction_down" : "correction_up",
      quantityDelta: delta,
      quantityAfter: newQty,
      reason: reason || "Manual stock inventory count correction",
      timestamp: now
    });

    localStorage.setItem("hexley_inventory", JSON.stringify(items));
    localStorage.setItem("hexley_movements", JSON.stringify(movements));
    return { success: true, newQty };
  }

  // --- SUPPLIERS ---
  async getSuppliers() {
    return JSON.parse(localStorage.getItem("hexley_suppliers") || "[]");
  }

  async saveSupplier(supplier) {
    const now = new Date().toISOString();
    const suppliers = JSON.parse(localStorage.getItem("hexley_suppliers") || "[]");
    let savedId = supplier.id;
    if (supplier.id) {
      const idx = suppliers.findIndex(s => s.id === supplier.id);
      if (idx !== -1) {
        suppliers[idx] = { ...suppliers[idx], ...supplier, updatedAt: now };
      } else {
        suppliers.push({ ...supplier, updatedAt: now });
      }
    } else {
      savedId = "sup-" + Date.now();
      suppliers.push({ ...supplier, id: savedId, createdAt: now });
    }
    localStorage.setItem("hexley_suppliers", JSON.stringify(suppliers));
    return savedId;
  }

  // --- SALES & MOVEMENTS QUERIES ---
  async getSales() {
    return JSON.parse(localStorage.getItem("hexley_sales") || "[]");
  }

  async getStockMovements() {
    return JSON.parse(localStorage.getItem("hexley_movements") || "[]");
  }

  // --- SETTINGS ---
  async getSettings() {
    return JSON.parse(localStorage.getItem("hexley_settings") || JSON.stringify(SAMPLE_SETTINGS));
  }

  async saveSettings(settings) {
    localStorage.setItem("hexley_settings", JSON.stringify(settings));
    return settings;
  }
}

export const dbService = new DatabaseService();
