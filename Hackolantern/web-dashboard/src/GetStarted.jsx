import React from "react";

export default function GetStarted({ onEnterConsole }) {
  const features = [
    {
      icon: "📦",
      tag: "INVENTORY OPS",
      title: "Dark Store POS Ledger",
      desc: "Instant stock audits, delivery syncs, and real-time jar count tracking across every shelf.",
      highlight: "Sub-second ledger updates"
    },
    {
      icon: "🔮",
      tag: "AI PREDICTIVE ENGINE",
      title: "Prophecy Burn Forecasting",
      desc: "Exponential moving average engine pinpoints exact depletion dates before items run dry.",
      highlight: "Stockout date predictor"
    },
    {
      icon: "✨",
      tag: "AUTONOMOUS REORDER",
      title: "Restock Spells & Buffers",
      desc: "Calculates reorder quantities factoring in 7-day supplier lead times and safety thresholds.",
      highlight: "Automated replenishment"
    },
    {
      icon: "🚨",
      tag: "ANOMALY RADAR",
      title: "Strange Happenings Radar",
      desc: "Z-score spike detection flags unusual volume bursts and identifies missing inventory.",
      highlight: "Shrinkage & theft alerts"
    },
    {
      icon: "📈",
      tag: "DEMAND TELEMETRY",
      title: "Crystal Ball 7-Day Curves",
      desc: "Visual demand trajectories to anticipate volume bottlenecks and festival rushes.",
      highlight: "Trend extrapolation"
    },
    {
      icon: "🌕",
      tag: "STRESS TESTING",
      title: "Midnight Curse Simulator",
      desc: "Instant 3x demand multiplier test for the Full Moon Festival on peak potion ingredients.",
      highlight: "3x surge simulation"
    }
  ];

  const workflow = [
    { num: "01", step: "Shelf Audit", desc: "Staff scan or spot-check jars via Android/Web to identify shrinkage." },
    { num: "02", step: "AI Anomaly Flagging", desc: "Prophecy engine evaluates burn rate and alerts on sudden consumption." },
    { num: "03", step: "Execute Restock", desc: "One-click restock recommendations generated with supplier lead buffers." }
  ];

  return (
    <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "20px 12px 60px" }}>
      {/* Hero Showcase Section */}
      <div style={{
        position: "relative",
        background: "radial-gradient(ellipse at 50% -20%, #3b1d6e 0%, #170d28 65%, #0f0817 100%)",
        border: "1px solid #381e61",
        borderRadius: "24px",
        padding: "54px 36px 44px",
        textAlign: "center",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
        overflow: "hidden",
        marginBottom: "36px"
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(168, 85, 247, 0.12)",
          border: "1px solid rgba(168, 85, 247, 0.35)",
          color: "#d8b4fe",
          padding: "6px 14px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          marginBottom: "20px"
        }}>
          <span>⚡</span>
          <span>INTERNAL OPS PLATFORM • TRACK 01</span>
        </div>

        <h1 style={{
          fontSize: "44px",
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
          margin: "0 auto 16px",
          maxWidth: "760px",
          background: "linear-gradient(180deg, #ffffff 30%, #c084fc 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>
          Madam Hexley’s Smart Dark Store Command Center
        </h1>

        <p style={{
          fontSize: "17px",
          lineHeight: 1.6,
          color: "#cbd5e1",
          maxWidth: "680px",
          margin: "0 auto 32px"
        }}>
          Next-generation pantry telemetry powered by FastAPI AI and real-time shelf sync. Eliminate stockouts, predict festival surges, and automate replenishment spells.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
          <button
            onClick={onEnterConsole}
            style={{
              background: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              padding: "14px 32px",
              fontSize: "16px",
              fontWeight: 800,
              letterSpacing: "0.02em",
              cursor: "pointer",
              boxShadow: "0 10px 25px rgba(147, 51, 234, 0.45)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              transition: "transform 0.15s ease"
            }}
          >
            <span>Enter Live Pantry Console</span>
            <span style={{ fontSize: "18px" }}>→</span>
          </button>
        </div>

        {/* Live Subsystem Indicators */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "24px",
          flexWrap: "wrap",
          marginTop: "36px",
          paddingTop: "24px",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#94a3b8" }}>
            <span style={{ height: "8px", width: "8px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
            <span>FastAPI AI Engine: <strong style={{ color: "#f8fafc" }}>Online</strong></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#94a3b8" }}>
            <span style={{ height: "8px", width: "8px", borderRadius: "50%", background: "#38bdf8", display: "inline-block" }}></span>
            <span>Firestore Sync: <strong style={{ color: "#f8fafc" }}>Persistent</strong></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#94a3b8" }}>
            <span style={{ height: "8px", width: "8px", borderRadius: "50%", background: "#a855f7", display: "inline-block" }}></span>
            <span>Android Scanner: <strong style={{ color: "#f8fafc" }}>Ready</strong></span>
          </div>
        </div>
      </div>

      {/* Feature Capabilities Grid */}
      <div style={{ marginBottom: "40px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h2 style={{ fontSize: "26px", fontWeight: 800, margin: "0 0 8px", color: "#f8fafc" }}>
            Engineered for High-Velocity Shelf Operations
          </h2>
          <p style={{ fontSize: "15px", color: "#94a3b8", margin: 0 }}>
            Everything needed to manage potion supply chains during calm hours or Full Moon surges.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "18px"
        }}>
          {features.map((feat, i) => (
            <div
              key={i}
              style={{
                background: "linear-gradient(180deg, #180e28 0%, #130922 100%)",
                border: "1px solid #2e1a4d",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 6px 18px rgba(0, 0, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between"
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <span style={{ fontSize: "28px" }}>{feat.icon}</span>
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "rgba(168, 85, 247, 0.15)",
                    color: "#c084fc",
                    border: "1px solid rgba(168, 85, 247, 0.25)"
                  }}>
                    {feat.tag}
                  </span>
                </div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 8px", color: "#f8fafc" }}>
                  {feat.title}
                </h3>
                <p style={{ fontSize: "14px", lineHeight: 1.5, color: "#94a3b8", margin: "0 0 16px" }}>
                  {feat.desc}
                </p>
              </div>

              <div style={{
                fontSize: "12px",
                color: "#10b981",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                paddingTop: "12px"
              }}>
                <span>✓</span>
                <span>{feat.highlight}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Standard Shift Protocol Workflow */}
      <div style={{
        background: "#160c26",
        border: "1px solid #2a1548",
        borderRadius: "20px",
        padding: "32px 28px",
        marginBottom: "36px"
      }}>
        <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "0 0 6px", color: "#f8fafc" }}>
          Manager Shift Protocol
        </h3>
        <p style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 24px" }}>
          Standardized routine for incoming store supervisors.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px"
        }}>
          {workflow.map((w, idx) => (
            <div
              key={idx}
              style={{
                background: "#1c1032",
                border: "1px solid #341c5a",
                borderRadius: "14px",
                padding: "20px",
                position: "relative"
              }}
            >
              <span style={{
                position: "absolute",
                top: "14px",
                right: "16px",
                fontSize: "24px",
                fontWeight: 900,
                color: "rgba(168, 85, 247, 0.25)"
              }}>
                {w.num}
              </span>
              <h4 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 6px", color: "#f8fafc" }}>
                {w.step}
              </h4>
              <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
                {w.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Launch Banner */}
      <div style={{
        textAlign: "center",
        padding: "28px 20px",
        background: "linear-gradient(90deg, rgba(147, 51, 234, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)",
        border: "1px dashed #4c2882",
        borderRadius: "16px"
      }}>
        <h4 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px", color: "#f8fafc" }}>
          Ready to review real-time stock and anomalies?
        </h4>
        <p style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 16px" }}>
          Access shelf ledgers, test festival demand multipliers, and run automated reorders.
        </p>
        <button
          onClick={onEnterConsole}
          style={{
            background: "#9333ea",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            padding: "12px 28px",
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(147, 51, 234, 0.4)"
          }}
        >
          Open Live Console →
        </button>
      </div>
    </div>
  );
}
