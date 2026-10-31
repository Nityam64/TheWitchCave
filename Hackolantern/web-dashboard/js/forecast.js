// js/forecast.js - Forecast & Festival Demand Prediction Engine
// Transparent baseline calculations with clear plain-language explanations.

export function calculateForecastForItem(item, salesHistory, settings = {}) {
  // 1. Gather all sales lines for this item
  const itemSales = [];
  const now = new Date();

  // Normalize sales history
  for (const sale of salesHistory) {
    if (!sale.items || !Array.isArray(sale.items)) continue;
    const saleDate = new Date(sale.timestamp);
    for (const line of sale.items) {
      if (line.itemId === item.id) {
        itemSales.push({
          quantity: Number(line.quantity) || 0,
          date: saleDate,
          timestamp: sale.timestamp
        });
      }
    }
  }

  // Gracefully handle missing / insufficient sales history
  if (itemSales.length < 2) {
    return {
      hasEnoughData: false,
      reason: "Not enough sales history (fewer than 2 sales recorded)",
      avgDailySales: 0,
      normal7DayDemand: 0,
      festivalMultiplier: 1,
      isFestivalActiveForThisItem: false,
      forecastDemand: 0,
      safetyStock: item.minStock || 0,
      currentStock: item.quantity || 0,
      reorderQuantity: Math.max(0, (item.minStock || 0) - (item.quantity || 0)),
      explanation: "Without at least two historic sales, demand cannot be projected safely. Recommendation is based solely on bringing current stock up to minimum safety stock.",
      daysOfHistory: itemSales.length,
      itemSales
    };
  }

  // Sort by date ascending
  itemSales.sort((a, b) => a.date - b.date);

  // Determine span in days (minimum 1 day to avoid divide-by-zero)
  const firstSaleTime = itemSales[0].date.getTime();
  const lastSaleTime = itemSales[itemSales.length - 1].date.getTime();
  const spanDays = Math.max(1, Math.round((lastSaleTime - firstSaleTime) / 86400000) + 1);

  const totalQuantitySold = itemSales.reduce((acc, s) => acc + s.quantity, 0);
  const avgDailySales = Math.round((totalQuantitySold / spanDays) * 10) / 10;

  // 2. Normal 7-day demand estimate
  const normal7DayDemand = Math.round(avgDailySales * 7);

  // 3. Festival multiplier check
  const isFestivalActive = settings.festivalActive !== false;
  const isAffected = item.isFestivalAffected || (settings.affectedItemIds && settings.affectedItemIds.includes(item.id));
  const festivalMultiplier = (isFestivalActive && isAffected) ? (item.festivalMultiplier || settings.festivalMultiplier || 3) : 1;

  const forecastDemand = Math.round(normal7DayDemand * festivalMultiplier);

  // 4. Safety stock & reorder suggestion formula:
  // reorder quantity = max(0, forecast demand + safety stock - quantity on hand - incoming quantity)
  const safetyStock = Number(item.minStock) || 0;
  const currentStock = Number(item.quantity) || 0;
  const incomingQuantity = 0; // Can be linked to pending supplier orders
  const reorderQuantity = Math.max(0, forecastDemand + safetyStock - currentStock - incomingQuantity);

  // 5. Days until run out
  const dailyBurn = avgDailySales * festivalMultiplier;
  const daysUntilStockout = dailyBurn > 0 ? Math.round((currentStock / dailyBurn) * 10) / 10 : 999;

  // 6. Plain-language explanation for the shopkeeper
  let explanation = `Based on historic sales of ${totalQuantitySold} ${item.unit} over ${spanDays} days, average consumption is ${avgDailySales} ${item.unit}/day. Normal 7-day demand is ${normal7DayDemand} ${item.unit}.`;
  if (festivalMultiplier > 1) {
    explanation += ` During the Full Moon Festival, this item is cursed with a ${festivalMultiplier}x demand surge, bringing projected 7-day demand to ${forecastDemand} ${item.unit}.`;
  }
  explanation += ` Adding minimum safety stock (${safetyStock} ${item.unit}) and subtracting your current stock (${currentStock} ${item.unit}), you should reorder ${reorderQuantity} ${item.unit}.`;

  return {
    hasEnoughData: true,
    avgDailySales,
    normal7DayDemand,
    festivalMultiplier,
    isFestivalActiveForThisItem: festivalMultiplier > 1,
    forecastDemand,
    safetyStock,
    currentStock,
    reorderQuantity,
    daysUntilStockout,
    explanation,
    daysOfHistory: spanDays,
    totalQuantitySold,
    itemSales
  };
}

export function generateDailyHistoryAndForecast(itemSales, forecastDemand) {
  // Produce 7 days of past sales + 7 days future projected points
  const days = [];
  const now = new Date();

  // Past 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = d.toISOString().split("T")[0];
    const qty = itemSales
      .filter(s => s.date.toISOString().split("T")[0] === dateStr)
      .reduce((sum, s) => sum + s.quantity, 0);

    days.push({
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" }),
      actual: qty,
      forecast: null,
      isFuture: false
    });
  }

  // Future 7 days
  const dailyFuture = Math.round((forecastDemand / 7) * 10) / 10;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    days.push({
      label: `+${i}d (${d.toLocaleDateString("en-US", { weekday: "short" })})`,
      actual: null,
      forecast: dailyFuture,
      isFuture: true
    });
  }

  return days;
}

