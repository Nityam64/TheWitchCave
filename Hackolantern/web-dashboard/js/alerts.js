// js/alerts.js - Full-History Anomaly Detection Scanner
// Scans daily sales history using rolling statistics and Z-score (>2.0) to flag all anomalous spike dates and missing stock.

export function detectUnusualConsumption(inventory, salesHistory, backendAnomalies = []) {
  const alerts = [];
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  for (const item of inventory) {
    if (item.isArchived) continue;

    // Collect daily sales grouped by dateStr
    const dailyMap = {};
    for (const sale of salesHistory) {
      if (!sale.items || !Array.isArray(sale.items)) continue;
      const saleDateStr = new Date(sale.timestamp).toISOString().split("T")[0];
      for (const line of sale.items) {
        if (line.itemId === item.id) {
          dailyMap[saleDateStr] = (dailyMap[saleDateStr] || 0) + (Number(line.quantity) || 0);
        }
      }
    }

    const dateKeys = Object.keys(dailyMap).sort();
    if (dateKeys.length < 3) continue;

    const values = dateKeys.map(d => dailyMap[d]);
    const totalQty = values.reduce((a, b) => a + b, 0);
    const mean = totalQty / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.max(Math.sqrt(variance), 1.0);

    for (let i = 0; i < dateKeys.length; i++) {
      const dStr = dateKeys[i];
      const qty = dailyMap[dStr];
      const zScore = (qty - mean) / std;
      const ratio = Math.round((qty / (mean || 1)) * 10) / 10;

      // Spike criteria: Z-score > 2.0 or (ratio >= 2.5 and qty > 5)
      if ((zScore > 2.0 || ratio >= 2.5) && qty > 5) {
        const isToday = dStr === todayStr;
        alerts.push({
          itemId: item.id,
          itemName: item.name,
          unit: item.unit || "jars",
          severity: zScore > 3.0 || ratio >= 3 ? "critical" : "warning",
          type: "CONSUMPTION_SPIKE",
          date: isToday ? "Today" : dStr,
          rawDate: dStr,
          zScore: Math.round(zScore * 10) / 10,
          qty: qty,
          headline: `Consumption Surge: ${qty} ${item.unit || "jars"} on ${isToday ? "Today" : dStr} (${ratio}x normal, Z=${Math.round(zScore * 10) / 10}σ)`,
          measuredUsage: `${qty} ${item.unit || "jars"}`,
          normalAverage: `${Math.round(mean * 10) / 10} ${item.unit || "jars"}/day`,
          ratio,
          suggestion: `Unusual demand spike detected on ${dStr}. Check ritual batch orders or potential shrinkage.`,
          timestamp: dStr
        });
      }
    }
  }

  // Also include backend anomalies if supplied
  if (Array.isArray(backendAnomalies)) {
    for (const ba of backendAnomalies) {
      if (ba.type === "MISSING_STOCK") {
        alerts.push({
          itemId: ba.ingredient_id,
          itemName: ba.ingredient || "Vault Stock",
          severity: "critical",
          type: "MISSING_STOCK",
          date: "Current Audit",
          headline: ba.message || `MISSING STOCK: ${ba.missing_units} units vanished without a sale!`,
          measuredUsage: `Deficit: ${ba.missing_units} units`,
          normalAverage: "Audit Discrepancy",
          suggestion: "Reconcile shelf ledger immediately.",
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  return alerts;
}


