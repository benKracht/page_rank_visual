import React, { useState, useEffect, useRef } from "react";
import { COLORS, CONFIG } from "./constants";
import { useGraphSimulation } from "./useGraphSimulation";
import { useCanvasRecorder } from "./useCanvasRecorder";
import CanvasRenderer from "./CanvasRenderer";

// Recording resolution presets
const RECORD_RESOLUTIONS = {
  "720p":  { w: 1280, h: 720,  label: "HD 720p"  },
  "1080p": { w: 1920, h: 1080, label: "FHD 1080p" },
  "1440p": { w: 2560, h: 1440, label: "QHD 1440p" },
};

export default function PageRankVisualizer() {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });

  const [preset, setPreset] = useState("web");
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [walkerCount, setWalkerCount] = useState(CONFIG.WALKER_COUNT);
  const [dampingFactor, setDampingFactor] = useState(CONFIG.DAMPING_FACTOR);

  // Recording state
  const [recordResKey, setRecordResKey] = useState("1080p");
  const [recordOverride, setRecordOverride] = useState(null); // { w, h } when recording
  const recorder = useCanvasRecorder();

  const {
    stateRef,
    reset,
    stats,
    setRunning,
    setSpeed: setSimSpeed,
    setWalkerCount: setSimWalkerCount,
    setDampingFactor: setSimDampingFactor,
    relayoutForSize,
  } = useGraphSimulation(containerRef, preset);

  // --- Resize observer ---
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

  // --- Sync controls → simulation ---
  useEffect(() => {
    reset();
    setIsRunning(false);
  }, [preset, reset]);

  useEffect(() => { setRunning(isRunning); }, [isRunning, setRunning]);
  useEffect(() => { setSimSpeed(speed); }, [speed, setSimSpeed]);
  useEffect(() => { setSimWalkerCount(walkerCount); }, [walkerCount, setSimWalkerCount]);
  useEffect(() => { setSimDampingFactor(dampingFactor); }, [dampingFactor, setSimDampingFactor]);

  // --- Recording control ---
  const handleToggleRecord = () => {
    if (recorder.isRecording) {
      recorder.stop();
      // Return layout to container dimensions
      setRecordOverride(null);
      relayoutForSize(dimensions.w, dimensions.h);
      return;
    }

    const res = RECORD_RESOLUTIONS[recordResKey];
    // Re-layout nodes for the recording canvas size so they're centered &
    // well-spaced at the target resolution. User's manual drag positions will
    // be overwritten — a fair tradeoff for a clean recording.
    relayoutForSize(res.w, res.h);
    setRecordOverride(res);

    // Give React one frame to apply the new renderSize to the canvas, then
    // attach MediaRecorder to the (now high-res) canvas element.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const canvas = rendererRef.current?.getCanvas();
        if (!canvas) return;
        recorder.start(canvas, {
          fps: 60,
          bitsPerSecond: 20_000_000,
          filename: `pagerank-${preset}-${res.w}x${res.h}.webm`,
        });
      });
    });
  };

  const sortedNodes = Object.keys(stats.scores).sort(
    (a, b) => stats.scores[b] - stats.scores[a]
  );

  const teleportPct = ((1 - dampingFactor) * 100).toFixed(0);

  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.textDim,
    display: "block",
    marginBottom: 6,
    letterSpacing: 0.5,
  };

  // Format elapsed recording time as mm:ss
  const recSeconds = Math.floor(recorder.elapsedMs / 1000);
  const recMin = String(Math.floor(recSeconds / 60)).padStart(2, "0");
  const recSec = String(recSeconds % 60).padStart(2, "0");

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
                  disabled={recorder.isRecording}
                  style={{
                    background: preset === p ? COLORS.accent : COLORS.surface,
                    color: preset === p ? COLORS.bg : COLORS.text,
                    border: preset === p ? "none" : `1px solid ${COLORS.border}`,
                    borderRadius: 4,
                    padding: "6px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: recorder.isRecording ? "not-allowed" : "pointer",
                    opacity: recorder.isRecording ? 0.5 : 1,
                    textTransform: "uppercase",
                    transition: "all 0.15s",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Speed */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>SPEED ({speed.toFixed(1)}x)</label>
            <input
              type="range" min="0.5" max="5" step="0.5" value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{ width: "100%", accentColor: COLORS.accent }}
            />
          </div>

          {/* Walkers */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>WALKERS ({walkerCount})</label>
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

          {/* Teleport probability */}
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

          {/* Start / Reset */}
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
              disabled={recorder.isRecording}
              style={{
                padding: "0 14px",
                borderRadius: 4,
                border: `1px solid ${COLORS.border}`,
                background: "transparent",
                color: COLORS.text,
                cursor: recorder.isRecording ? "not-allowed" : "pointer",
                opacity: recorder.isRecording ? 0.4 : 1,
                fontSize: 14,
              }}
              title="Reset"
            >
              ↻
            </button>
          </div>
        </div>

        {/* --- Recording panel --- */}
        <div style={{ padding: 20, borderBottom: `1px solid ${COLORS.border}` }}>
          <label style={labelStyle}>RECORDING</label>

          <select
            value={recordResKey}
            onChange={(e) => setRecordResKey(e.target.value)}
            disabled={recorder.isRecording}
            style={{
              width: "100%",
              padding: "6px 8px",
              background: COLORS.surface,
              color: COLORS.text,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              fontSize: 12,
              marginBottom: 10,
              cursor: recorder.isRecording ? "not-allowed" : "pointer",
            }}
          >
            {Object.entries(RECORD_RESOLUTIONS).map(([key, r]) => (
              <option key={key} value={key}>
                {r.label} — {r.w}×{r.h}
              </option>
            ))}
          </select>

          <button
            onClick={handleToggleRecord}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 4,
              background: recorder.isRecording ? "#dc2626" : COLORS.surface,
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 12,
              letterSpacing: 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              border: recorder.isRecording ? "none" : `1px solid ${COLORS.border}`,
              marginBottom: 0,
            }}
          >
            {recorder.isRecording ? (
              <>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#fff", animation: "pulse 1s ease-in-out infinite",
                }} />
                STOP ({recMin}:{recSec})
              </>
            ) : (
              <>● RECORD</>
            )}
          </button>

          <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 8, lineHeight: 1.5 }}>
            Saves a .webm file. Convert to mp4 with:
            <code style={{
              display: "block",
              marginTop: 4,
              padding: 6,
              background: COLORS.bg,
              borderRadius: 3,
              fontSize: 9,
              wordBreak: "break-all",
              color: COLORS.accent,
            }}>
              ffmpeg -i in.webm -c:v libx264 -crf 18 -pix_fmt yuv420p out.mp4
            </code>
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
        <CanvasRenderer
          ref={rendererRef}
          stateRef={stateRef}
          width={dimensions.w}
          height={dimensions.h}
          renderSize={recordOverride}
        />

        {/* REC indicator overlay */}
        {recorder.isRecording && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              background: "rgba(220, 38, 38, 0.9)",
              color: "#fff",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              pointerEvents: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#fff",
              animation: "pulse 1s ease-in-out infinite",
            }} />
            REC {recMin}:{recSec} · {recordOverride?.w}×{recordOverride?.h}
          </div>
        )}

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

      {/* Keyframes for the REC pulse — inlined so no CSS file changes needed */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
