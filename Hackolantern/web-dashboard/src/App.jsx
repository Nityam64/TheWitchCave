import React, { useEffect, useState } from "react";

const API_URL = "http://localhost:8000/api";

export default function App() {
  const [pantry, setPantry] = useState([]);
  const [cursedIds, setCursedIds] = useState([]);

  const fetchPantry = async () => {
    try {
      const res = await fetch(`${API_URL}/pantry`);
      const data = await res.json();
      setPantry(data.pantry);
    } catch (err) {
      console.error("Failed to fetch pantry:", err);
    }
  };

  useEffect(() => { fetchPantry(); }, []);

  const recordSale = async (id, qty) => {
    await fetch(`${API_URL}/pantry/${id}/transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ change_amount: -qty }),
    });
    fetchPantry();
  };

  const auditShelf = async (id, missingAmount = 5) => {
    await fetch(`${API_URL}/pantry/${id}/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missing_amount: missingAmount }),
    });
    fetchPantry();
  };

  const toggleCurse = async (id) => {
    const updated = cursedIds.includes(id)
      ? cursedIds.filter((i) => i !== id)
      : [...cursedIds.slice(-2), id]; // Max 3 ingredients
    setCursedIds(updated);
    await fetch(`${API_URL}/midnight-curse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredient_ids: updated }),
    });
    fetchPantry();
  };

  return (
    <div style={{ background: "#12091c", color: "#f5e6ff", minHeight: "100vh", padding: "24px", fontFamily: "sans-serif" }}>
      <h1>🎃 Madam Hexley's Smart Potion Pantry</h1>
      <p>Powered by FastAPI AI Engine & Firebase Firestore. Click "Curse (3x)" or "Audit Shelf" to trigger prophecies and anomalies.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        {pantry.map((item) => (
          <div key={item.id} style={{ border: "1px solid #6b21a8", borderRadius: "12px", padding: "16px", background: "#1e1030" }}>
            <h3>{item.name} {item.is_cursed && "🌕 (3x CURSED)"}</h3>
            <p>Stock: <strong>{item.current_stock}</strong> / Expected: {item.expected_stock} | Burn Rate: <strong>{item.prophecy?.daily_burn_rate || 0}/day</strong></p>
            <p>🔮 Prophecy Run-out: <strong>{item.prophecy?.days_until_run_out} days ({item.prophecy?.run_out_date})</strong></p>
            <p>✨ Restock Spell: Order <strong>{item.prophecy?.recommended_reorder} units</strong></p>
            {item.anomalies?.map((alert, idx) => (
              <div key={idx} style={{ background: "#7f1d1d", padding: "6px", borderRadius: "6px", marginTop: "6px", fontSize: "12px" }}>
                ⚠️ {alert}
              </div>
            ))}
            <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button onClick={() => recordSale(item.id, 5)}>Sell 5</button>
              <button onClick={() => recordSale(item.id, -20)}>Restock +20</button>
              <button onClick={() => toggleCurse(item.id)}>Curse (3x)</button>
              <button onClick={() => auditShelf(item.id, 5)} style={{ background: "#991b1b", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 8px", cursor: "pointer" }}>
                Audit Shelf (Report Missing)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
