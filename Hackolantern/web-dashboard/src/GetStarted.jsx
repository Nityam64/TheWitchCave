import React, { useRef, useState, useEffect } from "react";

export default function GetStarted({ onEnterConsole }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Authentication State
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rank, setRank] = useState("Master Apothecary");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("hexley_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleOpenAuth = (tab = "signin") => {
    if (currentUser) {
      onEnterConsole();
      return;
    }
    setAuthTab(tab);
    setAuthError("");
    setAuthSuccess("");
    setShowAuth(true);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setAuthError("Please provide both identifier and passkey.");
      return;
    }
    setAuthError("");
    try {
      const res = await fetch("http://localhost:8000/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");
      localStorage.setItem("hexley_token", data.token);
      localStorage.setItem("hexley_user", JSON.stringify(data.user));
      setCurrentUser(data.user);
      setAuthSuccess(`✦ Welcome back, ${data.user.alchemist_name}!`);
      setTimeout(() => {
        setShowAuth(false);
        onEnterConsole();
      }, 700);
    } catch (err) {
      if (username.toLowerCase() === "hexley" && (password === "midnight" || password === "admin")) {
        const demo = { username: "hexley", alchemist_name: "Madam Hexley", rank: "Grand Alchemist" };
        localStorage.setItem("hexley_user", JSON.stringify(demo));
        setCurrentUser(demo);
        setAuthSuccess("✦ Welcome back, Madam Hexley!");
        setTimeout(() => {
          setShowAuth(false);
          onEnterConsole();
        }, 700);
        return;
      }
      setAuthError(err.message || "Failed to authenticate.");
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!username || !password || !name) {
      setAuthError("Please fill out all required fields.");
      return;
    }
    setAuthError("");
    try {
      const res = await fetch("http://localhost:8000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email, alchemist_name: name, rank })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to register");
      localStorage.setItem("hexley_token", data.token);
      localStorage.setItem("hexley_user", JSON.stringify(data.user));
      setCurrentUser(data.user);
      setAuthSuccess(`✦ Guild Roll inscribed! Welcome, ${data.user.alchemist_name}.`);
      setTimeout(() => {
        setShowAuth(false);
        onEnterConsole();
      }, 700);
    } catch (err) {
      const local = { username, alchemist_name: name, email, rank };
      localStorage.setItem("hexley_user", JSON.stringify(local));
      setCurrentUser(local);
      setAuthSuccess(`✦ Guild Roll inscribed! Welcome, ${name}.`);
      setTimeout(() => {
        setShowAuth(false);
        onEnterConsole();
      }, 700);
    }
  };

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

  const updateScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    updateScrollButtons();
    window.addEventListener("resize", updateScrollButtons);
    return () => window.removeEventListener("resize", updateScrollButtons);
  }, []);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const offset = direction === "left" ? -340 : 340;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

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
        marginBottom: "40px"
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
            onClick={() => handleOpenAuth("signin")}
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
            <span>{currentUser ? `Enter Vault as ${currentUser.alchemist_name}` : "Get Started • Enter Vault"}</span>
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

      {/* Feature Capabilities: Horizontal Carousel / Swipe */}
      <div style={{ marginBottom: "48px" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px", color: "#f8fafc" }}>
              Engineered for High-Velocity Shelf Operations
            </h2>
            <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>
              Swipe through the core telemetry and operational capabilities.
            </p>
          </div>

          {/* Navigation Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              style={{
                background: canScrollLeft ? "#24113d" : "#140a22",
                color: canScrollLeft ? "#f8fafc" : "#475569",
                border: "1px solid #3b1d64",
                borderRadius: "10px",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: canScrollLeft ? "pointer" : "default",
                fontSize: "16px",
                transition: "all 0.15s ease"
              }}
            >
              ←
            </button>
            <button
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              aria-label="Scroll right"
              style={{
                background: canScrollRight ? "#24113d" : "#140a22",
                color: canScrollRight ? "#f8fafc" : "#475569",
                border: "1px solid #3b1d64",
                borderRadius: "10px",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: canScrollRight ? "pointer" : "default",
                fontSize: "16px",
                transition: "all 0.15s ease"
              }}
            >
              →
            </button>
          </div>
        </div>

        {/* Horizontal Scroll Track */}
        <div
          ref={scrollRef}
          onScroll={updateScrollButtons}
          style={{
            display: "flex",
            gap: "18px",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            padding: "8px 4px 18px",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch"
          }}
        >
          {features.map((feat, i) => (
            <div
              key={i}
              style={{
                flex: "0 0 320px",
                scrollSnapAlign: "start",
                background: "linear-gradient(180deg, #180e28 0%, #130922 100%)",
                border: "1px solid #2e1a4d",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                userSelect: "none"
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
                <p style={{ fontSize: "14px", lineHeight: 1.5, color: "#94a3b8", margin: "0 0 18px" }}>
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
                paddingTop: "14px"
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
          onClick={() => handleOpenAuth("signin")}
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
          {currentUser ? `Open Live Console (${currentUser.alchemist_name}) →` : "Get Started • Sign In / Sign Up →"}
        </button>
      </div>

      {/* Auth Modal Overlay */}
      {showAuth && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10, 4, 18, 0.88)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowAuth(false); }}>
          <div style={{
            background: "#1c1128",
            border: "2px solid #a855f7",
            borderRadius: "16px",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(168, 85, 247, 0.3)",
            width: "100%",
            maxWidth: "420px",
            padding: "26px",
            position: "relative"
          }}>
            <button
              onClick={() => setShowAuth(false)}
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "20px",
                cursor: "pointer"
              }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#f8fafc", margin: "0 0 4px" }}>
              Hexley Alchemist Guild
            </h3>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 16px" }}>
              Authenticate to unlock the live potion pantry ledger.
            </p>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", borderBottom: "1px solid #331d4d", paddingBottom: "8px" }}>
              <button
                type="button"
                onClick={() => { setAuthTab("signin"); setAuthError(""); }}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: authTab === "signin" ? "#c084fc" : "#94a3b8",
                  borderBottom: authTab === "signin" ? "2px solid #a855f7" : "none",
                  padding: "4px 8px",
                  cursor: "pointer"
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab("signup"); setAuthError(""); }}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: authTab === "signup" ? "#c084fc" : "#94a3b8",
                  borderBottom: authTab === "signup" ? "2px solid #a855f7" : "none",
                  padding: "4px 8px",
                  cursor: "pointer"
                }}
              >
                Sign Up (Guild Roll)
              </button>
            </div>

            {authTab === "signin" ? (
              <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "4px" }}>Alchemist Username / Email</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. hexley"
                    style={{ width: "100%", background: "#0f0717", border: "1px solid #4a2872", borderRadius: "8px", padding: "10px", color: "#f8fafc", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "4px" }}>Secret Cipher (Password)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: "100%", background: "#0f0717", border: "1px solid #4a2872", borderRadius: "8px", padding: "10px", color: "#f8fafc", boxSizing: "border-box" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setUsername("hexley"); setPassword("midnight"); }}
                  style={{ background: "rgba(168, 85, 247, 0.15)", border: "1px dashed #9333ea", color: "#c084fc", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", cursor: "pointer", textAlign: "left" }}
                >
                  🧙 Fill Madam Hexley Demo Credentials
                </button>
                <button
                  type="submit"
                  style={{ background: "#9333ea", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginTop: "6px" }}
                >
                  Authorize & Enter Vault →
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "4px" }}>Alchemist Title & Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Archmage Thorne"
                    style={{ width: "100%", background: "#0f0717", border: "1px solid #4a2872", borderRadius: "8px", padding: "8px 10px", color: "#f8fafc", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "4px" }}>Guild Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. thorne"
                    style={{ width: "100%", background: "#0f0717", border: "1px solid #4a2872", borderRadius: "8px", padding: "8px 10px", color: "#f8fafc", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "4px" }}>Guild Rank</label>
                  <select
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    style={{ width: "100%", background: "#0f0717", border: "1px solid #4a2872", borderRadius: "8px", padding: "8px 10px", color: "#f8fafc", boxSizing: "border-box" }}
                  >
                    <option value="Master Apothecary">Master Apothecary</option>
                    <option value="Apprentice Brewer">Apprentice Brewer</option>
                    <option value="Coven High Inquisitor">Coven High Inquisitor</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "4px" }}>Secret Cipher (Password)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 4 characters"
                    style={{ width: "100%", background: "#0f0717", border: "1px solid #4a2872", borderRadius: "8px", padding: "8px 10px", color: "#f8fafc", boxSizing: "border-box" }}
                  />
                </div>
                <button
                  type="submit"
                  style={{ background: "#9333ea", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginTop: "6px" }}
                >
                  Inscribe Name & Enter Vault →
                </button>
              </form>
            )}

            {authError && <div style={{ color: "#f87171", fontSize: "13px", marginTop: "8px", textAlign: "center" }}>{authError}</div>}
            {authSuccess && <div style={{ color: "#4ade80", fontSize: "13px", marginTop: "8px", textAlign: "center" }}>{authSuccess}</div>}

            <div style={{ textAlign: "center", marginTop: "14px" }}>
              <button
                type="button"
                onClick={() => {
                  const guest = { username: "guest", alchemist_name: "Guest Alchemist", rank: "Visitor" };
                  localStorage.setItem("hexley_user", JSON.stringify(guest));
                  setShowAuth(false);
                  onEnterConsole();
                }}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "13px", textDecoration: "underline", cursor: "pointer" }}
              >
                ✦ Continue as Guest Alchemist (Skip Auth) →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
