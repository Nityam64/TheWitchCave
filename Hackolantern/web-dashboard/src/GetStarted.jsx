import React from "react";

export default function GetStarted({ onEnterConsole, onQuickCurse }) {
  const capabilities = [
    {
      icon: "📦",
      title: "Instant Shelf & POS Ledger",
      desc: "Deduct sales, log supplier deliveries, and track real-time stock across all potion shelves in one click."
    },
    {
      icon: "🔮",
      title: "AI Prophecy (Stockout Predictor)",
      desc: "Exponential Moving Average burn-rate engine calculates exact days and dates before any ingredient hits zero."
    },
    {
      icon: "✨",
      title: "Automated Restock Spell",
      desc: "Calculates optimal reorder quantities factoring in 7-day supplier lead times and safety stock buffers."
    },
    {
      icon: "🚨",
      title: "Strange Happenings (Shrinkage & Spike Radar)",
      desc: "Z-score anomaly detection flags sudden consumption surges and catches missing shelf inventory (theft/spillage)."
    },
    {
      icon: "📈",
      title: "Crystal Ball Demand Telemetry",
      desc: "Interactive 7-day historical + forecasted demand curves to visualize burn trajectories before bottlenecks happen."
    },
    {
      icon: "🌕",
      title: "Midnight Curse (3x Festival Surge Simulator)",
      desc: "One-click stress test that triples demand on up to 3 core ingredients for next week's Full Moon Festival and recalculates reorders instantly."
    }
  ];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "16px 8px" }}>
      {/* Top Executive Banner */}
      <div style={{
        background: "linear-gradient(135deg, #1b112c 0%, #24143a 100%)",
        border: "1px solid #3b2061",
        borderRadius: "16px",
        padding: "36px 32px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        marginBottom: "24px"
      }}>
        <div style={{
          display: "inline-block",
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          padding: "4px 10px",
          borderRadius: "999px",
          background: "rgba(168, 85, 247, 0.2)",
          color: "#d8b4fe",
          border: "1px solid #7e22ce",
          marginBottom: "16px"
        }}>
          INTERNAL STORE OPS • TRACK 01
        </div>
        <h1 style={{
          fontSize: "34px",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          margin: "0 0 10px 0",
          color: "#f8fafc"
        }}>
          Madam Hexley’s Dark Store Command Center
        </h1>
        <p style={{
          fontSize: "16px",
          lineHeight: 1.5,
          color: "#cbd5e1",
          margin: "0 0 24px 0",
          maxWidth: "780px"
        }}>
          Zero stockouts. Automated restock spells. Real-time shelf shrinkage & festival surge protection.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <button
            onClick={onEnterConsole}
            style={{
              background: "#9333ea",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "12px 22px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(147, 51, 234, 0.4)",
              transition: "transform 0.15s ease"
            }}
          >
            Launch Live Pantry Console →
          </button>
          <button
            onClick={onQuickCurse}
            style={{
              background: "rgba(245, 158, 11, 0.15)",
              color: "#fbbf24",
              border: "1px solid #d97706",
              borderRadius: "10px",
              padding: "12px 20px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Simulate Full Moon 3x Surge 🌕
          </button>
        </div>
      </div>

      {/* Live System Readiness Strip */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        marginBottom: "28px"
      }}>
        <div style={{
          flex: "1 1 240px",
          background: "#1b112c",
          border: "1px solid #2e1a4d",
          borderRadius: "10px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "13px",
          color: "#e2e8f0"
        }}>
          <span style={{ fontSize: "14px" }}>🟢</span>
          <span>FastAPI + AI Engine: <strong style={{ color: "#34d399" }}>Online</strong></span>
        </div>
        <div style={{
          flex: "1 1 240px",
          background: "#1b112c",
          border: "1px solid #2e1a4d",
          borderRadius: "10px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "13px",
          color: "#e2e8f0"
        }}>
          <span style={{ fontSize: "14px" }}>🔥</span>
          <span>Firebase Firestore Sync: <strong style={{ color: "#38bdf8" }}>Active</strong></span>
        </div>
        <div style={{
          flex: "1 1 240px",
          background: "#1b112c",
          border: "1px solid #2e1a4d",
          borderRadius: "10px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "13px",
          color: "#e2e8f0"
        }}>
          <span style={{ fontSize: "14px" }}>📱</span>
          <span>Android Scanner Companion: <strong style={{ color: "#a78bfa" }}>Connected</strong></span>
        </div>
      </div>

      {/* Core Store Manager Capabilities Grid */}
      <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 16px 0", color: "#f1f5f9" }}>
        Core Dark Store Operations Architecture
      </h2>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: "16px",
        marginBottom: "32px"
      }}>
        {capabilities.map((cap, i) => (
          <div key={i} style={{
            background: "#1b112c",
            border: "1px solid #2e1a4d",
            borderRadius: "14px",
            padding: "20px",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)"
          }}>
            <div style={{ fontSize: "26px", marginBottom: "10px" }}>{cap.icon}</div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 8px 0", color: "#e2e8f0" }}>
              {cap.title}
            </h3>
            <p style={{ fontSize: "14px", lineHeight: 1.5, color: "#94a3b8", margin: 0 }}>
              {cap.desc}
            </p>
          </div>
        ))}
      </div>

      {/* 3-Step Manager Shift Workflow */}
      <div style={{
        background: "#140c22",
        border: "1px solid #2a1645",
        borderRadius: "14px",
        padding: "22px 24px"
      }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px" }}>
          Daily Shift Operational Protocol
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "14px"
        }}>
          <div style={{ background: "#1b112c", padding: "14px 16px", borderRadius: "10px", borderLeft: "4px solid #a855f7" }}>
            <strong style={{ display: "block", color: "#f8fafc", fontSize: "14px", marginBottom: "4px" }}>
              Step 1: Shelf Audit
            </strong>
            <span style={{ fontSize: "13px", color: "#94a3b8" }}>
              Perform barcode / shelf spot-check via Android or Web to catch discrepancies instantly.
            </span>
          </div>
          <div style={{ background: "#1b112c", padding: "14px 16px", borderRadius: "10px", borderLeft: "4px solid #f59e0b" }}>
            <strong style={{ display: "block", color: "#f8fafc", fontSize: "14px", marginBottom: "4px" }}>
              Step 2: AI Anomaly Review
            </strong>
            <span style={{ fontSize: "13px", color: "#94a3b8" }}>
              Review Z-Score consumption spikes and Strange Happenings flags computed by FastAPI.
            </span>
          </div>
          <div style={{ background: "#1b112c", padding: "14px 16px", borderRadius: "10px", borderLeft: "4px solid #10b981" }}>
            <strong style={{ display: "block", color: "#f8fafc", fontSize: "14px", marginBottom: "4px" }}>
              Step 3: Restock & Buffer
            </strong>
            <span style={{ fontSize: "13px", color: "#94a3b8" }}>
              Trigger automated restock spells with 7-day supplier lead time and Full Moon festival buffers.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
