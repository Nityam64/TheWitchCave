import React, { useEffect, useState } from "react";
import GetStarted from "./GetStarted";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

const API_URL = "http://localhost:8000/api";

export default function App() {
  const [activeTab, setActiveTab] = useState("get-started"); // "get-started" or "console"
  const [pantry, setPantry] = useState([]);
  const [cursedIds, setCursedIds] = useState([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [showCharts, setShowCharts] = useState(true);

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

  const filteredPantry = pantry.filter(item =>
    item.name?.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div style={{ background: "#0b0612", color: "#f8fafc", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Top Operations Header */}
      <header style={{
        background: "rgba(20, 11, 34, 0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #2a1548",
        padding: "12px 28px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        position: "sticky",
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            height: "36px",
            width: "36px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #9333ea, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            boxShadow: "0 4px 12px rgba(147, 51, 234, 0.35)"
          }}>
            🧪
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>Hexley Ops Console</div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>Madam Hexley's Dark Store Command Center</div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: "flex",
          background: "#140924",
          padding: "4px",
          borderRadius: "10px",
          border: "1px solid #2e1a4d",
          gap: "4px"
        }}>
          <button
            onClick={() => setActiveTab("get-started")}
            style={{
              background: activeTab === "get-started" ? "#9333ea" : "transparent",
              color: activeTab === "get-started" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "8px",
              padding: "7px 16px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            🧭 Product Overview
          </button>
          <button
            onClick={() => setActiveTab("console")}
            style={{
              background: activeTab === "console" ? "#9333ea" : "transparent",
              color: activeTab === "console" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "8px",
              padding: "7px 16px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            ⚡ Live Inventory Console
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {activeTab === "get-started" ? (
          <GetStarted onEnterConsole={() => setActiveTab("console")} />
        ) : (
          <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 20px" }}>
            {/* Control Bar */}
            <div style={{
              background: "linear-gradient(180deg, #180e29 0%, #130a22 100%)",
              border: "1px solid #2e1a4d",
              borderRadius: "16px",
              padding: "16px 20px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              marginBottom: "24px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Filter ingredients..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  style={{
                    background: "#0e0618",
                    border: "1px solid #3b2061",
                    borderRadius: "8px",
                    color: "#f8fafc",
                    padding: "8px 12px",
                    fontSize: "13px",
                    width: "220px",
                    outline: "none"
                  }}
                />
                <button
                  onClick={() => setShowCharts(!showCharts)}
                  style={{
                    background: showCharts ? "#2d164d" : "#170c28",
                    color: showCharts ? "#c084fc" : "#94a3b8",
                    border: "1px solid #4c2882",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {showCharts ? "Hide Telemetry Curves" : "Show Telemetry Curves"}
                </button>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={fetchPantry}
                  style={{
                    background: "#22113a",
                    color: "#e2e8f0",
                    border: "1px solid #3d1f69",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    fontSize: "13px",
                    cursor: "pointer"
                  }}
                >
                  🔄 Sync
                </button>
                <button
                  onClick={simulateQuickCurse}
                  style={{
                    background: "rgba(245, 158, 11, 0.15)",
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

            {/* Inventory Grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
              gap: "18px"
            }}>
              {filteredPantry.map((item) => {
                const isUnderSafety = item.current_stock < (item.safety_stock || 0);
                const isDiscrepant = item.current_stock < item.expected_stock;

                return (
                  <div
                    key={item.id}
                    style={{
                      background: "linear-gradient(180deg, #180d29 0%, #120820 100%)",
                      border: item.is_cursed ? "1px solid #d97706" : "1px solid #2d184d",
                      borderRadius: "16px",
                      padding: "20px",
                      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.25)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between"
                    }}
                  >
                    <div>
                      {/* Card Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                        <div>
                          <h3 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 700, color: "#f8fafc" }}>
                            {item.name}
                          </h3>
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                            Safety Threshold: {item.safety_stock || 0} units
                          </span>
                        </div>
                        {item.is_cursed && (
                          <span style={{
                            background: "rgba(245, 158, 11, 0.15)",
                            color: "#fbbf24",
                            border: "1px solid #d97706",
                            padding: "3px 8px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 700
                          }}>
                            🌕 3x CURSED
                          </span>
                        )}
                      </div>

                      {/* Stock Metres */}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px",
                        background: "#0f061b",
                        border: "1px solid #22103a",
                        borderRadius: "10px",
                        padding: "12px",
                        marginBottom: "14px"
                      }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>Actual Stock</div>
                          <div style={{
                            fontSize: "18px",
                            fontWeight: 800,
                            color: isUnderSafety ? "#f87171" : "#10b981"
                          }}>
                            {item.current_stock}
                            <span style={{ fontSize: "11px", fontWeight: 400, color: "#64748b", marginLeft: "4px" }}>
                              / {item.expected_stock}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>Daily Burn</div>
                          <div style={{ fontSize: "18px", fontWeight: 800, color: "#a855f7" }}>
                            {item.prophecy?.daily_burn_rate || 0} <span style={{ fontSize: "11px", fontWeight: 400, color: "#94a3b8" }}>/day</span>
                          </div>
                        </div>
                      </div>

                      {/* AI Forecasting Badges */}
                      <div style={{
                        background: "rgba(168, 85, 247, 0.05)",
                        border: "1px solid rgba(168, 85, 247, 0.15)",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        fontSize: "12px",
                        lineHeight: 1.6,
                        marginBottom: "14px",
                        color: "#cbd5e1"
                      }}>
                        <div>🔮 <strong>Stockout:</strong> in <span style={{ color: "#f8fafc", fontWeight: 700 }}>{item.prophecy?.days_until_run_out} days</span> ({item.prophecy?.run_out_date})</div>
                        <div>✨ <strong>Restock Spell:</strong> Order <span style={{ color: "#38bdf8", fontWeight: 700 }}>{item.prophecy?.recommended_reorder} units</span> (7d lead + buffer)</div>
                      </div>

                      {/* Anomalies Alert */}
                      {item.anomalies && item.anomalies.length > 0 && (
                        <div style={{ marginBottom: "14px" }}>
                          {item.anomalies.map((alert, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: "#450a0a",
                                border: "1px solid #7f1d1d",
                                color: "#fca5a5",
                                padding: "6px 10px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 600,
                                marginTop: "4px"
                              }}
                            >
                              ⚠️ {alert}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Crystal Ball Area Chart */}
                      {showCharts && (
                        <div style={{
                          background: "#0e0618",
                          border: "1px solid #24113d",
                          borderRadius: "10px",
                          padding: "10px",
                          marginBottom: "14px"
                        }}>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "6px" }}>
                            🔮 Crystal Ball 7-Day Forecast Curve
                          </div>
                          <div style={{ width: "100%", height: 75 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={item.prophecy?.crystal_ball_forecast || []} margin={{ top: 2, right: 6, left: -25, bottom: 0 }}>
                                <defs>
                                  <linearGradient id={`grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={item.is_cursed ? "#f59e0b" : "#a855f7"} stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor={item.is_cursed ? "#f59e0b" : "#a855f7"} stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="day" stroke="#475569" tick={{ fontSize: 9 }} />
                                <YAxis stroke="#475569" tick={{ fontSize: 9 }} domain={['dataMin - 1', 'dataMax + 2']} />
                                <Tooltip
                                  contentStyle={{ background: "#1c0d32", borderColor: "#7e22ce", borderRadius: "6px", fontSize: "11px" }}
                                  itemStyle={{ color: "#e9d5ff" }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="predicted"
                                  stroke={item.is_cursed ? "#f59e0b" : "#a855f7"}
                                  strokeWidth={2}
                                  fillOpacity={1}
                                  fill={`url(#grad-${item.id})`}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Operational Action Controls */}
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      borderTop: "1px solid #22103a",
                      paddingTop: "12px"
                    }}>
                      <button
                        onClick={() => recordSale(item.id, 5)}
                        style={{
                          background: "#2e154d",
                          color: "#e9d5ff",
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
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#34d399",
                          border: "1px solid #059669",
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
                          background: item.is_cursed ? "#d97706" : "rgba(245, 158, 11, 0.12)",
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
                        title="Simulate shelf inventory loss / shrinkage"
                        style={{
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#f87171",
                          border: "1px solid #991b1b",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          marginLeft: "auto"
                        }}
                      >
                        Audit Discrepancy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
