import React, { useState, useEffect, useRef } from "react";
import { COLORS, CONFIG } from "./constants";
import { useGraphSimulation } from "./useGraphSimulation";
import CanvasRenderer from "./CanvasRenderer";

export default function PageRankVisualizer() {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });

  const [preset, setPreset] = useState("web");
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [walkerCount, setWalkerCount] = useState(CONFIG.WALKER_COUNT);
  const [dampingFactor, setDampingFactor] = useState(CONFIG.DAMPING_FACTOR);

  const {
    stateRef,
    reset,
    stats,
    setRunning,
    setSpeed: setSimSpeed,
    setWalkerCount: setSimWalkerCount,
    setDampingFactor: setSimDampingFactor,
  } = useGraphSimulation(containerRef, preset);

  // Resize
  useEffect(() => {
    const onResize = () => {
      if (containerRef.current) {
        setDimensions({
          w: containerRef.current.clientWidth,
          h: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Sync controls → simulation
  useEffect(() => {
    reset();
    setIsRunning(false);
  }, [preset, reset]);

  useEffect(() => { setRunning(isRunning); }, [isRunning, setRunning]);
  useEffect(() => { setSimSpeed(speed); }, [speed, setSimSpeed]);
  useEffect(() => { setSimWalkerCount(walkerCount); }, [walkerCount, setSimWalkerCount]);
  useEffect(() => { setSimDampingFactor(dampingFactor); }, [dampingFactor, setSimDampingFactor]);

  // Sort nodes by estimated rank
  const sortedNodes = Object.keys(stats.scores).sort(
    (a, b) => stats.scores[b] - stats.scores[a]
  );

  const teleportPct = ((1 - dampingFactor) * 100).toFixed(0);

  // Shared label style
  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.textDim,
    display: "block",
    marginBottom: 6,
    letterSpacing: 0.5,
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* --- Sidebar --- */}
      <div
        style={{
          width: 280,
          minWidth: 280,
          borderRight: `1px solid ${COLORS.border}`,
          display: "flex",
          flexDirection: "column",
          background: "rgba(17, 24, 39, 0.5)",
        }}
      >
        {/* Header */}
        <div style={{ padding: 20, borderBottom: `1px solid ${COLORS.border}` }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>
            PageRank
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: 12, color: COLORS.textDim }}>
            Monte Carlo Random Walk
          </p>
        </div>

        {/* Controls */}
        <div style={{ padding: 20, borderBottom: `1px solid ${COLORS.border}` }}>
          {/* Preset selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>PRESET GRAPH</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {["simple", "star", "web", "trap"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  style={{
                    background: preset === p ? COLORS.accent : COLORS.surface,
                    color: preset === p ? COLORS.bg : COLORS.text,
                    border: preset === p ? "none" : `1px solid ${COLORS.border}`,
                    borderRadius: 4,
                    padding: "6px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    transition: "all 0.15s",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Speed slider */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>SPEED ({speed.toFixed(1)}x)</label>
            <input
              type="range" min="0.5" max="5" step="0.5" value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{ width: "100%", accentColor: COLORS.accent }}
            />
          </div>

          {/* Walker count slider */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              WALKERS ({walkerCount})
            </label>
            <input
              type="range" min="1" max="200" step="1" value={walkerCount}
              onChange={(e) => setWalkerCount(Number(e.target.value))}
              style={{ width: "100%", accentColor: COLORS.accent }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: COLORS.textDim, marginTop: 2 }}>
              <span>1</span>
              <span>200</span>
            </div>
          </div>

          {/* Teleport probability slider */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              TELEPORT PROB ({teleportPct}%)
              <span style={{ fontWeight: 400, marginLeft: 4, opacity: 0.6 }}>
                d={dampingFactor.toFixed(2)}
              </span>
            </label>
            <input
              type="range" min="0" max="0.5" step="0.01" value={1 - dampingFactor}
              onChange={(e) => setDampingFactor(1 - Number(e.target.value))}
              style={{ width: "100%", accentColor: COLORS.walkerTeleport }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: COLORS.textDim, marginTop: 2 }}>
              <span>0%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Start / Reset buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setIsRunning(!isRunning)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 4,
                border: "none",
                background: isRunning ? COLORS.walker : "#22c55e",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 12,
                letterSpacing: 0.5,
              }}
            >
              {isRunning ? "⏸ PAUSE" : "▶ START"}
            </button>
            <button
              onClick={() => { reset(); setIsRunning(false); }}
              style={{
                padding: "0 14px",
                borderRadius: 4,
                border: `1px solid ${COLORS.border}`,
                background: "transparent",
                color: COLORS.text,
                cursor: "pointer",
                fontSize: 14,
              }}
              title="Reset"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Score list */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: COLORS.textDim,
              marginBottom: 12,
              display: "flex",
              justifyContent: "space-between",
              letterSpacing: 0.5,
            }}
          >
            <span>NODE</span>
            <span>
              EST / <span style={{ color: COLORS.node }}>TRUE</span>
            </span>
          </div>

          {sortedNodes.map((node) => {
            const count = stats.scores[node] || 0;
            const estPct = stats.totalSteps > 0 ? (count / stats.totalSteps) * 100 : 0;
            const truePct = (stats.trueRanks[node] || 0) * 100;

            return (
              <div key={node} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{node}</span>
                  <span>
                    <span style={{ color: COLORS.accent, fontWeight: 700 }}>{estPct.toFixed(1)}%</span>
                    <span style={{ color: COLORS.textDim, margin: "0 4px" }}>/</span>
                    <span style={{ color: COLORS.node }}>{truePct.toFixed(1)}%</span>
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: "rgba(255,255,255,0.07)",
                    borderRadius: 2,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${Math.min(truePct * 2, 100)}%`,
                      background: COLORS.node, opacity: 0.3, borderRadius: 2,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${Math.min(estPct * 2, 100)}%`,
                      background: COLORS.accent, borderRadius: 2,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}

          {stats.totalSteps === 0 && (
            <div style={{ fontSize: 12, color: COLORS.textDim, textAlign: "center", marginTop: 32, lineHeight: 1.6 }}>
              Press <strong style={{ color: "#22c55e" }}>START</strong> to begin the random walk.
              <br /><br />
              <span style={{ fontSize: 11 }}>Drag nodes to rearrange the graph.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 12,
            borderTop: `1px solid ${COLORS.border}`,
            fontSize: 10,
            color: COLORS.textDim,
            textAlign: "center",
          }}
        >
          {stats.totalSteps.toLocaleString()} steps · d={dampingFactor.toFixed(2)} · {walkerCount} walkers
        </div>
      </div>

      {/* --- Canvas --- */}
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <CanvasRenderer stateRef={stateRef} width={dimensions.w} height={dimensions.h} />

        {/* Legend */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 11,
            color: COLORS.textDim,
            opacity: 0.7,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.walker, display: "inline-block" }} />
            Walk
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.walkerTeleport, display: "inline-block" }} />
            Teleport ({teleportPct}%)
          </span>
        </div>
      </div>
    </div>
  );
}