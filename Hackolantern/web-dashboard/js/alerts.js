// js/alerts.js - Unusual-Consumption Anomaly Detection Engine
// Flags items whose today or recent consumption exceeds 2x their average daily sales.

export function detectUnusualConsumption(inventory, salesHistory) {
  const alerts = [];
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  for (const item of inventory) {
    if (item.isArchived) continue;

    // Collect all historic sales for this item
    const itemSales = [];
    for (const sale of salesHistory) {
      if (!sale.items || !Array.isArray(sale.items)) continue;
      const saleDateStr = new Date(sale.timestamp).toISOString().split("T")[0];
      for (const line of sale.items) {
        if (line.itemId === item.id) {
          itemSales.push({
            quantity: Number(line.quantity) || 0,
            dateStr: saleDateStr,
            timestamp: sale.timestamp
          });
        }
      }
    }

    // Require at least 3 historical sale records across distinct days to establish a meaningful baseline
    const distinctDays = [...new Set(itemSales.map(s => s.dateStr))];
    if (distinctDays.length < 3) {
      continue; // Avoid misleading alerts when history is insufficient
    }

    // Baseline calculation: Exclude today to find the pre-existing average daily sales
    const pastSales = itemSales.filter(s => s.dateStr !== todayStr);
    const pastDays = distinctDays.filter(d => d !== todayStr);

    if (pastDays.length < 2) continue;

    const totalPastQuantity = pastSales.reduce((acc, s) => acc + s.quantity, 0);
    const baselineDailyAvg = Math.round((totalPastQuantity / pastDays.length) * 10) / 10;

    if (baselineDailyAvg <= 0) continue;

    // Today's consumption
    const todaySales = itemSales.filter(s => s.dateStr === todayStr);
    const todayQuantity = todaySales.reduce((acc, s) => acc + s.quantity, 0);

    // Threshold: Today's usage is more than 2x the normal average
    const ratio = Math.round((todayQuantity / baselineDailyAvg) * 10) / 10;
    if (todayQuantity >= 2 * baselineDailyAvg && todayQuantity > 5) {
      alerts.push({
        itemId: item.id,
        itemName: item.name,
        unit: item.unit,
        severity: ratio >= 3 ? "critical" : "warning",
        headline: `Sudden Surge: ${todayQuantity} ${item.unit} consumed today (${ratio}x normal rate)`,
        measuredUsage: `${todayQuantity} ${item.unit}`,
        normalAverage: `${baselineDailyAvg} ${item.unit}/day`,
        ratio,
        suggestion: "Inspect recent sales and stock movements for unexpected shrinkage, ritual batch demands, or goblin shoplifting.",
        timestamp: new Date().toISOString()
      });
    }
  }

  return alerts;
}

