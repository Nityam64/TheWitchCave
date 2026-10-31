import React from "react";
import GetStarted from "./GetStarted";

export default function App() {
  const navigateToPantry = () => {
    // Navigate to the full Madam Hexley Potion Pantry app
    // If the port 8080 prototype is running, navigate there; otherwise navigate to /pantry.html
    window.location.href = "http://localhost:8080/#home";
  };

  return (
    <div style={{ background: "#0b0612", color: "#f8fafc", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Top Operations Header */}
      <header style={{
        background: "rgba(20, 11, 34, 0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #2a1548",
        padding: "14px 28px",
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

        <div>
          <button
            onClick={navigateToPantry}
            style={{
              background: "#9333ea",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 18px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(147, 51, 234, 0.35)",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>Open Potion Pantry</span>
            <span>→</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        <GetStarted onEnterConsole={navigateToPantry} />
      </main>
    </div>
  );
}
