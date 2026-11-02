import React, { useRef, useState, useCallback } from 'react';
import { motion, useSpring } from 'framer-motion';

const SNAP_RADIUS = 110; // Distance in px where cursor snaps to letter
const MAX_PULL = 28;     // Maximum px the letter can travel toward cursor

export const MagneticLetter = ({ char, index, onSnapChange }) => {
  if (char === ' ') {
    return <span key={index} style={{ display: "inline-block", width: "clamp(12px, 2vw, 28px)" }}>&nbsp;</span>;
  }
  const ref = useRef(null);
  const [isSnapped, setIsSnapped] = useState(false);

  const x = useSpring(0, { stiffness: 260, damping: 18, mass: 0.6 });
  const y = useSpring(0, { stiffness: 260, damping: 18, mass: 0.6 });

  const handleMouseMove = useCallback((e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist < SNAP_RADIUS) {
      // Calculate pull vector clamped to MAX_PULL
      const pullFactor = Math.min(1, (SNAP_RADIUS - dist) / SNAP_RADIUS);
      const angle = Math.atan2(dy, dx);
      const moveX = Math.cos(angle) * Math.min(dist * 0.45, MAX_PULL) * (0.4 + pullFactor * 0.6);
      const moveY = Math.sin(angle) * Math.min(dist * 0.45, MAX_PULL) * (0.4 + pullFactor * 0.6);

      x.set(moveX);
      y.set(moveY);

      if (!isSnapped) {
        setIsSnapped(true);
      }
      onSnapChange(index, true, centerX, centerY, moveX, moveY);
    } else if (isSnapped) {
      x.set(0);
      y.set(0);
      setIsSnapped(false);
      onSnapChange(index, false, centerX, centerY, 0, 0);
    }
  }, [index, isSnapped, onSnapChange, x, y]);

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
    if (isSnapped) {
      setIsSnapped(false);
      onSnapChange(index, false, 0, 0, 0, 0);
    }
  }, [index, isSnapped, onSnapChange, x, y]);

  return (
    <motion.span
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x, y, display: "inline-block", position: "relative", cursor: "pointer", userSelect: "none", padding: "0 4px" }}
      className="relative inline-block cursor-pointer select-none px-1"
    >
      {/* Active Letter MicroSlat Glint Aura */}
      <motion.span
        initial={false}
        animate={{
          scale: isSnapped ? 1.35 : 0.4,
          opacity: isSnapped ? 1 : 0,
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "128px",
          height: "128px",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: -1,
          background: "radial-gradient(circle, rgba(151,232,241,0.45) 0%, rgba(32,32,91,0.55) 55%, transparent 75%)",
          filter: "blur(8px)",
        }}
      />
      <span
        style={{
          position: "relative",
          zIndex: 10,
          transition: "color 0.2s, text-shadow 0.2s",
          color: isSnapped ? "#97e8f1" : "#ffffff",
          textShadow: isSnapped ? "0 0 18px rgba(151,232,241,0.65)" : "none"
        }}
        className={`relative z-10 transition-colors duration-200 ${isSnapped ? "text-[#97e8f1] drop-shadow-[0_0_18px_rgba(151,232,241,0.65)]" : "text-white"}`}
      >
        {char}
      </span>
    </motion.span>
  );
};

export const MagneticAuraHeading = ({ text = "Mirai", children, style = {}, headingStyle = {} }) => {
  const containerRef = useRef(null);
  const [waves, setWaves] = useState([]);
  const [activeAura, setActiveAura] = useState({ active: false, x: 0, y: 0 });
  const lastWaveRef = useRef({});

  const handleSnapChange = useCallback((index, snapped, clientX, clientY, offsetX, offsetY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const localX = clientX - rect.left + offsetX;
    const localY = clientY - rect.top + offsetY;

    if (snapped) {
      setActiveAura({ active: true, x: localX, y: localY });

      // Throttle radial wave emission per letter to create clean flowing rings
      const now = Date.now();
      if (!lastWaveRef.current[index] || now - lastWaveRef.current[index] > 420) {
        lastWaveRef.current[index] = now;
        const id = `${index}-${now}`;
        setWaves((prev) => [...prev.slice(-6), { id, x: localX, y: localY }]);
      }
    } else {
      setActiveAura((prev) => ({ ...prev, active: false }));
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        ...style
      }}
      className="relative flex w-full items-center justify-center overflow-hidden"
    >
      {/* Radial Wave Rings Flowing Through the Stat / MicroSlat Box */}
      <div
        style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {waves.map((wave) => (
          <motion.div
            key={wave.id}
            initial={{ scale: 0.2, opacity: 0.85 }}
            animate={{ scale: 5.5, opacity: 0 }}
            transition={{ duration: 1.35, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() =>
              setWaves((prev) => prev.filter((w) => w.id !== wave.id))
            }
            style={{
              position: "absolute",
              left: wave.x,
              top: wave.y,
              width: "144px",
              height: "144px",
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              mixBlendMode: "screen",
              border: "1.5px solid rgba(151, 232, 241, 0.55)",
              boxShadow: "0 0 35px 8px rgba(151, 232, 241, 0.25), inset 0 0 25px rgba(32, 32, 91, 0.65)",
              background: "radial-gradient(circle, rgba(151,232,241,0.12) 0%, rgba(32,32,91,0.28) 60%, transparent 72%)",
            }}
            className="absolute h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen"
          />
        ))}

        {/* Continuous Following MicroSlat Highlight Aura */}
        <motion.div
          animate={{
            x: activeAura.x,
            y: activeAura.y,
            opacity: activeAura.active ? 1 : 0,
            scale: activeAura.active ? 1 : 0.6,
          }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "288px",
            height: "288px",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            filter: "blur(24px)",
            mixBlendMode: "screen",
            background: "radial-gradient(circle, rgba(151,232,241,0.28) 0%, rgba(32,32,91,0.45) 45%, transparent 70%)",
          }}
          className="absolute left-0 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md mix-blend-screen"
        />
      </div>

      {/* Foreground Magnetic Letters */}
      {children ? (
        <div style={{ position: "relative", zIndex: 10 }} className="relative z-10">{children}</div>
      ) : (
        <h1
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "clamp(42px, 7vw, 92px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            margin: "0",
            ...headingStyle
          }}
          className="relative z-10 flex flex-wrap items-center justify-center font-bold leading-tight"
        >
          {text.split("").map((char, idx) => (
            <MagneticLetter char={char} index={idx} key={idx} onSnapChange={handleSnapChange} />
          ))}
        </h1>
      )}
    </div>
  );
};

export default MagneticAuraHeading;
