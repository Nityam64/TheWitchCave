import React, { useEffect, useState } from "react";
import GetStarted from "./GetStarted";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

const API_URL = "http://localhost:8000/api";

export default function App() {
  const [activeTab, setActiveTab] = useState("get-started"); // "get-started" or "console"
  const [pantry, setPantry] = useState([]);
  const [cursedIds, setCursedIds] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPantry = async () => {
    try {
      const res = await fetch(`${API_URL}/pantry`);
      const data = await res.json();
      setPantry(data.pantry || []);
      const cursed = (data.pantry || []).filter(item => item.is_cursed).map(item => item.id);
      setCursedIds(cursed);
    } catch (err) {
      console.error("Failed to fetch pantry:", err);
    }
  };

  useEffect(() => {
    fetchPantry();
  }, []);

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

  const simulateQuickCurse = async () => {
    // Select first 2 or 3 ingredients for Full Moon 3x surge
    const surgeIds = [1, 2, 3];
    setCursedIds(surgeIds);
    await fetch(`${API_URL}/midnight-curse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredient_ids: surgeIds }),
    });
    await fetchPantry();
    setActiveTab("console");
  };

  return (
    <div style={{ background: "#0f0817", color: "#f8fafc", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Top B2B Operations Navbar */}
      <header style={{
        background: "#180e28",
        borderBottom: "1px solid #2e1a4d",
        padding: "12px 24px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        position: "sticky",
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>🧪</span>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#f1f5f9" }}>Hexley Dark Store Ops</div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>Automated Inventory Telemetry & AI Forecasting</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", background: "#10091d", padding: "4px", borderRadius: "10px", border: "1px solid #2e1a4d", gap: "4px" }}>
          <button
            onClick={() => setActiveTab("get-started")}
            style={{
              background: activeTab === "get-started" ? "#9333ea" : "transparent",
              color: activeTab === "get-started" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            🧭 Manager Get Started
          </button>
          <button
            onClick={() => setActiveTab("console")}
            style={{
              background: activeTab === "console" ? "#9333ea" : "transparent",
              color: activeTab === "console" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            ⚡ Live Pantry Console
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ padding: "24px 20px" }}>
        {activeTab === "get-started" ? (
          <GetStarted
            onEnterConsole={() => setActiveTab("console")}
            onQuickCurse={simulateQuickCurse}
          />
        ) : (
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            {/* Console Toolbar */}
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "20px",
              background: "#1b112c",
              border: "1px solid #2e1a4d",
              padding: "16px 20px",
              borderRadius: "14px"
            }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: 800 }}>⚡ Live Pantry Telemetry Console</h2>
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>
                  Active Ingredients: <strong>{pantry.length}</strong> | Cursed (3x): <strong>{cursedIds.length}/3</strong> | Single Source of Truth: FastAPI AI + Firestore
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={fetchPantry}
                  style={{
                    background: "#2e1a4d",
                    color: "#e2e8f0",
                    border: "1px solid #4c2882",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  🔄 Refresh Telemetry
                </button>
                <button
                  onClick={simulateQuickCurse}
                  style={{
                    background: "rgba(245, 158, 11, 0.2)",
                    color: "#fbbf24",
                    border: "1px solid #d97706",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  🌕 Trigger Festival Surge (3x)
                </button>
              </div>
            </div>

            {/* Ingredients Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "16px" }}>
              {pantry.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "#1b112c",
                    border: item.is_cursed ? "1px solid #d97706" : "1px solid #2e1a4d",
                    borderRadius: "14px",
                    padding: "18px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#f8fafc" }}>
                        {item.name}
                      </h3>
                      {item.is_cursed && (
                        <span style={{
                          background: "rgba(245, 158, 11, 0.2)",
                          color: "#fbbf24",
                          border: "1px solid #d97706",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 700
                        }}>
                          🌕 3x CURSED
                        </span>
                      )}
                    </div>

                    {/* Stock & Burn stats */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      background: "#140c22",
                      padding: "10px",
                      borderRadius: "8px",
                      marginBottom: "12px",
                      fontSize: "12px"
                    }}>
                      <div>
                        <div style={{ color: "#94a3b8" }}>Current Stock</div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: item.current_stock < item.safety_stock ? "#f87171" : "#10b981" }}>
                          {item.current_stock} <span style={{ fontSize: "11px", color: "#64748b" }}>/ exp {item.expected_stock}</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ color: "#94a3b8" }}>Daily Burn Rate</div>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "#a855f7" }}>
                          {item.prophecy?.daily_burn_rate || 0}/day
                        </div>
                      </div>
                    </div>

                    {/* Prophecy Details */}
                    <div style={{ fontSize: "13px", lineHeight: 1.6, marginBottom: "12px", color: "#cbd5e1" }}>
                      <div>🔮 <strong>Stockout:</strong> in {item.prophecy?.days_until_run_out} days ({item.prophecy?.run_out_date})</div>
                      <div>✨ <strong>Restock Spell:</strong> Reorder <span style={{ color: "#38bdf8", fontWeight: 700 }}>{item.prophecy?.recommended_reorder} units</span> (7-day lead + buffer)</div>
                    </div>

                    {/* Anomalies Strip */}
                    {item.anomalies && item.anomalies.length > 0 && (
                      <div style={{ marginBottom: "12px" }}>
                        {item.anomalies.map((alert, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "#7f1d1d",
                              color: "#fecaca",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                              marginTop: "4px"
                            }}
                          >
                            ⚠️ {alert}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Crystal Ball Recharts Forecast */}
                    <div style={{ background: "#140c22", padding: "10px", borderRadius: "8px", marginBottom: "14px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "6px" }}>
                        🔮 Crystal Ball (7-Day Demand Forecast)
                      </div>
                      <div style={{ width: "100%", height: 85 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={item.prophecy?.crystal_ball_forecast || []} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                            <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10 }} />
                            <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['dataMin - 1', 'dataMax + 2']} />
                            <Tooltip
                              contentStyle={{ background: "#1e1030", borderColor: "#7e22ce", borderRadius: "6px", fontSize: "11px" }}
                              itemStyle={{ color: "#e9d5ff" }}
                            />
                            <Line
                              type="monotone"
                              dataKey="predicted"
                              stroke={item.is_cursed ? "#f59e0b" : "#a855f7"}
                              strokeWidth={2}
                              dot={{ r: 2, fill: "#e9d5ff" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", borderTop: "1px solid #2e1a4d", paddingTop: "12px" }}>
                    <button
                      onClick={() => recordSale(item.id, 5)}
                      style={{
                        background: "#3b2061",
                        color: "#f3e8ff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Sell 5
                    </button>
                    <button
                      onClick={() => recordSale(item.id, -20)}
                      style={{
                        background: "#065f46",
                        color: "#a7f3d0",
                        border: "none",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      Restock +20
                    </button>
                    <button
                      onClick={() => toggleCurse(item.id)}
                      style={{
                        background: item.is_cursed ? "#d97706" : "rgba(245, 158, 11, 0.2)",
                        color: item.is_cursed ? "#ffffff" : "#fbbf24",
                        border: "1px solid #d97706",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      {item.is_cursed ? "Uncurse" : "Curse (3x)"}
                    </button>
                    <button
                      onClick={() => auditShelf(item.id, 5)}
                      style={{
                        background: "#991b1b",
                        color: "#fee2e2",
                        border: "none",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        marginLeft: "auto"
                      }}
                    >
                      Audit Shelf (Shrinkage)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
