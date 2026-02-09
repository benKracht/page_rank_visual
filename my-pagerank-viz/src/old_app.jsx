import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = {
  bg: "#0a0e17",
  surface: "#111827",
  border: "#1e293b",
  accent: "#f59e0b",
  accentGlow: "rgba(245, 158, 11, 0.4)",
  walker: "#ef4444",
  walkerGlow: "rgba(239, 68, 68, 0.6)",
  node: "#3b82f6",
  nodeGlow: "rgba(59, 130, 246, 0.3)",
  text: "#e2e8f0",
  textDim: "#64748b",
  edge: "rgba(100, 116, 139, 0.3)",
  edgeActive: "rgba(245, 158, 11, 0.7)",
  scoreBg: "rgba(245, 158, 11, 0.1)",
};

class Graph {
  constructor() {
    this.nodes = new Set();
    this.edges = {};
    this.scores = {};
  }
  addNode(i) {
    this.nodes.add(i);
    if (!(i in this.edges)) {
      this.edges[i] = {};
      this.scores[i] = 0;
    }
  }
  addEdge(u, v, weight) {
    if (!this.nodes.has(u)) this.addNode(u);
    if (!this.nodes.has(v)) this.addNode(v);
    this.edges[u][v] = { weight, probability: 0 };
  }
  normalize() {
    for (const u of Object.keys(this.edges)) {
      const totalWeight = Object.values(this.edges[u]).reduce((s, e) => s + e.weight, 0);
      if (totalWeight > 0) {
        for (const v of Object.keys(this.edges[u])) {
          this.edges[u][v].probability = this.edges[u][v].weight / totalWeight;
        }
      }
    }
  }
  nextStep(current) {
    if (!(current in this.edges) || Object.keys(this.edges[current]).length === 0) return null;
    const neighbors = Object.keys(this.edges[current]);
    const probs = neighbors.map((v) => this.edges[current][v].probability);
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < neighbors.length; i++) {
      cumulative += probs[i];
      if (r <= cumulative) return neighbors[i];
    }
    return neighbors[neighbors.length - 1];
  }
}

function buildPresetGraph(preset) {
  const g = new Graph();
  if (preset === "simple") {
    ["A", "B", "C", "D"].forEach((n) => g.addNode(n));
    g.addEdge("A", "B", 1); g.addEdge("A", "C", 1);
    g.addEdge("B", "C", 1); g.addEdge("B", "D", 1);
    g.addEdge("C", "A", 1);
    g.addEdge("D", "A", 1); g.addEdge("D", "C", 1);
  } else if (preset === "star") {
    ["Center", "A", "B", "C", "D", "E"].forEach((n) => g.addNode(n));
    ["A", "B", "C", "D", "E"].forEach((n) => {
      g.addEdge(n, "Center", 1);
      g.addEdge("Center", n, 1);
    });
  } else if (preset === "web") {
    ["Home", "About", "Blog", "Contact", "Products", "FAQ"].forEach((n) => g.addNode(n));
    g.addEdge("Home", "About", 2); g.addEdge("Home", "Blog", 3);
    g.addEdge("Home", "Products", 4); g.addEdge("Home", "Contact", 1);
    g.addEdge("About", "Home", 2); g.addEdge("About", "Contact", 1);
    g.addEdge("Blog", "Home", 1); g.addEdge("Blog", "Products", 2);
    g.addEdge("Blog", "FAQ", 1);
    g.addEdge("Products", "Home", 1); g.addEdge("Products", "FAQ", 2);
    g.addEdge("Products", "Blog", 1);
    g.addEdge("Contact", "Home", 3);
    g.addEdge("FAQ", "Home", 1); g.addEdge("FAQ", "Products", 1);
  } else if (preset === "cycle") {
    ["1", "2", "3", "4", "5", "6"].forEach((n) => g.addNode(n));
    g.addEdge("1", "2", 1); g.addEdge("2", "3", 1); g.addEdge("3", "4", 1);
    g.addEdge("4", "5", 1); g.addEdge("5", "6", 1); g.addEdge("6", "1", 1);
    g.addEdge("3", "1", 1); g.addEdge("5", "2", 1);
  }
  g.normalize();
  return g;
}

function layoutNodes(graph, width, height) {
  const nodes = Array.from(graph.nodes);
  const n = nodes.length;
  const cx = width / 2, cy = height / 2;
  const radius = Math.min(width, height) * 0.32;
  const positions = {};
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions[node] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
  return positions;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function drawArrow(ctx, fromX, fromY, toX, toY, nodeRadius, color, lineWidth, curvature = 0) {
  const dx = toX - fromX, dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;

  const ux = dx / dist, uy = dy / dist;
  
  // 1. Arrow Dimensions
  const arrowLen = 6 + lineWidth * 1.5; 
  const arrowWidthRatio = 0.6;
  const gapFromNode = 2; 

  // 2. The Tip
  const tipX = toX - ux * (nodeRadius + gapFromNode);
  const tipY = toY - uy * (nodeRadius + gapFromNode);
  const startX = fromX + ux * nodeRadius, startY = fromY + uy * nodeRadius;
  
  const midX = (startX + tipX) / 2 + curvature * -uy;
  const midY = (startY + tipY) / 2 + curvature * ux;

  // 3. THE FIX: Calculate the point at the BACK of the arrowhead
 
  const tOffset = (arrowLen + 2) / dist; 
  const tLineEnd = Math.max(0, 1 - tOffset); 

  const lineEndX = (1 - tLineEnd)**2 * startX + 2 * (1 - tLineEnd) * tLineEnd * midX + tLineEnd**2 * tipX;
  const lineEndY = (1 - tLineEnd)**2 * startY + 2 * (1 - tLineEnd) * tLineEnd * midY + tLineEnd**2 * tipY;

  // DRAW THE CURVED LINE
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(midX, midY, lineEndX, lineEndY);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  
  // Use "butt" to keep the end flat so it doesn't poke through the triangle
  ctx.lineCap = "butt"; 
  ctx.stroke();

  // 4. ALIGNED TANGENT (Calculated at the tip)
  const tux = 2 * (1 - 1.0) * (midX - startX) + 2 * 1.0 * (tipX - midX);
  const tuy = 2 * (1 - 1.0) * (midY - startY) + 2 * 1.0 * (tipY - midY);
  const tMag = Math.sqrt(tux * tux + tuy * tuy);
  const nx = tux / tMag, ny = tuy / tMag;

  // DRAW THE ARROWHEAD
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - arrowLen * nx + (arrowLen * arrowWidthRatio) * -ny, 
    tipY - arrowLen * ny + (arrowLen * arrowWidthRatio) * nx
  );
  ctx.lineTo(
    tipX - arrowLen * nx - (arrowLen * arrowWidthRatio) * -ny, 
    tipY - arrowLen * ny - (arrowLen * arrowWidthRatio) * nx
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
function getPointOnQuadratic(sx, sy, mx, my, ex, ey, t) {
  const x = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * ex;
  const y = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * ey;
  return { x, y };
}

export default function PageRankVisualizer() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stateRef = useRef({
    graph: null,
    positions: {},
    walker: null,
    walkerPos: { x: 0, y: 0 },
    walkerTarget: null,
    animT: 0,
    fromNode: null,
    toNode: null,
    totalSteps: 0,
    scores: {},
    running: false,
    speed: 1,
  });

  const [preset, setPreset] = useState("web");
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [scores, setScores] = useState({});
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentNode, setCurrentNode] = useState(null);

  const NODE_RADIUS = 26;

  const initGraph = useCallback((p) => {
    const g = buildPresetGraph(p);
    const canvas = canvasRef.current;
    const w = canvas?.width || 700;
    const h = canvas?.height || 500;
    const positions = layoutNodes(g, w, h);
    const nodes = Array.from(g.nodes);
    const startNode = nodes[Math.floor(Math.random() * nodes.length)];
    const initScores = {};
    nodes.forEach((n) => (initScores[n] = 0));

    stateRef.current = {
      ...stateRef.current,
      graph: g,
      positions,
      walker: startNode,
      walkerPos: { ...positions[startNode] },
      walkerTarget: null,
      animT: 0,
      fromNode: null,
      toNode: null,
      totalSteps: 0,
      scores: initScores,
      running: false,
    };
    setScores(initScores);
    setTotalSteps(0);
    setCurrentNode(startNode);
    setRunning(false);
  }, []);

  useEffect(() => { initGraph(preset); }, [preset, initGraph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = Math.max(400, container.clientHeight);
      if (stateRef.current.graph) {
        stateRef.current.positions = layoutNodes(stateRef.current.graph, canvas.width, canvas.height);
        const walker = stateRef.current.walker;
        if (walker && stateRef.current.positions[walker]) {
          stateRef.current.walkerPos = { ...stateRef.current.positions[walker] };
        }
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => { stateRef.current.speed = speed; }, [speed]);

  useEffect(() => {
    stateRef.current.running = running;
  }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let lastTime = 0;
    const frame = (timestamp) => {
      const dt = lastTime ? (timestamp - lastTime) / 1000 : 0.016;
      lastTime = timestamp;
      const st = stateRef.current;
      const { graph, positions, walkerPos } = st;
      if (!graph) { animRef.current = requestAnimationFrame(frame); return; }

      if (st.running) {
        if (st.toNode === null) {
          const next = graph.nextStep(st.walker);
          if (next !== null) {
            st.fromNode = st.walker;
            st.toNode = next;
            st.animT = 0;
          }
        }
        if (st.toNode !== null) {
          st.animT += dt * 2.5 * st.speed;
          if (st.animT >= 1) {
            st.animT = 1;
            st.walker = st.toNode;
            st.scores[st.toNode] = (st.scores[st.toNode] || 0) + 1;
            st.totalSteps += 1;
            st.walkerPos = { ...positions[st.toNode] };
            setCurrentNode(st.toNode);
            if (st.totalSteps % 5 === 0) {
              setScores({ ...st.scores });
              setTotalSteps(st.totalSteps);
            }
            st.fromNode = null;
            st.toNode = null;
            st.animT = 0;
          } else {
            const from = positions[st.fromNode];
            const to = positions[st.toNode];
            const dx = to.x - from.x, dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / dist, uy = dy / dist;
            const curvature = 30;
            const mx = (from.x + to.x) / 2 + curvature * -uy;
            const my = (from.y + to.y) / 2 + curvature * ux;
            const pt = getPointOnQuadratic(from.x, from.y, mx, my, to.x, to.y, st.animT);
            st.walkerPos = pt;
          }
        }
      }

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background grid
      ctx.strokeStyle = "rgba(30, 41, 59, 0.3)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      const nodes = Array.from(graph.nodes);

      // Edges
      for (const u of nodes) {
        if (!graph.edges[u]) continue;
        for (const v of Object.keys(graph.edges[u])) {
          const from = positions[u], to = positions[v];
          const isActive = st.fromNode === u && st.toNode === v;
          const prob = graph.edges[u][v].probability;
          const lineW = 1 + prob * 10;
          const curvature = 30;
          drawArrow(ctx, from.x, from.y, to.x, to.y, NODE_RADIUS,
            isActive ? COLORS.edgeActive : COLORS.edge, isActive ? lineW + 1 : lineW, curvature);
        }
      }

      // Nodes
      const maxScore = Math.max(1, ...Object.values(st.scores));
      for (const node of nodes) {
        const pos = positions[node];
        const scoreRatio = st.totalSteps > 0 ? (st.scores[node] || 0) / maxScore : 0;
        const r = NODE_RADIUS + scoreRatio * 8;

        // Glow
        const grad = ctx.createRadialGradient(pos.x, pos.y, r * 0.5, pos.x, pos.y, r * 2.5);
        grad.addColorStop(0, `rgba(59, 130, 246, ${0.15 + scoreRatio * 0.25})`);
        grad.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();

        // Node circle
        ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        const ng = ctx.createRadialGradient(pos.x - r * 0.3, pos.y - r * 0.3, 0, pos.x, pos.y, r);
        const hue = lerp(210, 35, scoreRatio);
        ng.addColorStop(0, `hsl(${hue}, 80%, 60%)`);
        ng.addColorStop(1, `hsl(${hue}, 70%, 40%)`);
        ctx.fillStyle = ng; ctx.fill();
        ctx.strokeStyle = `hsl(${hue}, 80%, 70%)`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node, pos.x, pos.y);

        // Score below
        if (st.totalSteps > 0) {
          const pct = ((st.scores[node] || 0) / st.totalSteps * 100).toFixed(1);
          ctx.font = "10px 'JetBrains Mono', monospace";
          ctx.fillStyle = COLORS.accent;
          ctx.fillText(`${pct}%`, pos.x, pos.y + r + 14);
        }
      }

      // Walker
      const wp = st.walkerPos;
      const wGrad = ctx.createRadialGradient(wp.x, wp.y, 0, wp.x, wp.y, 14);
      wGrad.addColorStop(0, "#fff");
      wGrad.addColorStop(0.4, COLORS.walker);
      wGrad.addColorStop(1, "transparent");
      ctx.beginPath(); ctx.arc(wp.x, wp.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = wGrad; ctx.fill();

      ctx.beginPath(); ctx.arc(wp.x, wp.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#fff"; ctx.fill();

      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame(frame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  const sortedScores = Object.entries(scores)
    .map(([node, count]) => ({ node, count, pct: totalSteps > 0 ? (count / totalSteps * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);

  const maxPct = Math.max(1, ...sortedScores.map((s) => s.pct));

  return (
    <div style={{
      background: COLORS.bg,
      minHeight: "100vh",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      color: COLORS.text,
      display: "flex",
      flexDirection: "column",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: "16px 24px",
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: running ? COLORS.walker : COLORS.accent,
            boxShadow: `0 0 8px ${running ? COLORS.walkerGlow : COLORS.accentGlow}`,
            animation: running ? "pulse 1s infinite" : "none",
          }} />
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>PAGERANK</span>
          <span style={{ fontSize: 11, color: COLORS.textDim }}>random walk visualizer</span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 11, color: COLORS.textDim }}>GRAPH:</label>
          {["simple", "star", "web", "cycle"].map((p) => (
            <button key={p} onClick={() => { setPreset(p); }}
              style={{
                background: preset === p ? COLORS.accent : COLORS.surface,
                color: preset === p ? COLORS.bg : COLORS.text,
                border: `1px solid ${preset === p ? COLORS.accent : COLORS.border}`,
                padding: "4px 12px", borderRadius: 4, fontSize: 11,
                cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                textTransform: "uppercase",
              }}>{p}</button>
          ))}

          <div style={{ width: 1, height: 20, background: COLORS.border, margin: "0 4px" }} />

          <label style={{ fontSize: 11, color: COLORS.textDim }}>SPEED:</label>
          <input type="range" min={0.2} max={5} step={0.1} value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            style={{ width: 80, accentColor: COLORS.accent }} />
          <span style={{ fontSize: 11, width: 30 }}>{speed.toFixed(1)}x</span>

          <div style={{ width: 1, height: 20, background: COLORS.border, margin: "0 4px" }} />

          <button onClick={() => setRunning(!running)}
            style={{
              background: running ? COLORS.walker : "#22c55e",
              color: "#fff", border: "none",
              padding: "6px 16px", borderRadius: 4, fontSize: 11,
              cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: 1,
            }}>{running ? "⏸ PAUSE" : "▶ START"}</button>

          <button onClick={() => initGraph(preset)}
            style={{
              background: COLORS.surface, color: COLORS.textDim,
              border: `1px solid ${COLORS.border}`,
              padding: "6px 12px", borderRadius: 4, fontSize: 11,
              cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            }}>↻ RESET</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Canvas area */}
        <div style={{ flex: 1, position: "relative" }}>
          <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />

          {/* Stats overlay */}
          <div style={{
            position: "absolute", top: 12, left: 12,
            background: "rgba(10, 14, 23, 0.85)",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6, padding: "10px 14px",
            fontSize: 11,
          }}>
            <div style={{ color: COLORS.textDim, marginBottom: 4 }}>STEPS</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.accent }}>{totalSteps.toLocaleString()}</div>
            <div style={{ color: COLORS.textDim, marginTop: 6 }}>CURRENT</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{currentNode || "—"}</div>
          </div>
        </div>

        {/* Sidebar scores */}
        <div style={{
          width: 220, borderLeft: `1px solid ${COLORS.border}`,
          padding: 16, overflowY: "auto",
          background: "rgba(17, 24, 39, 0.5)",
        }}>
          <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 12, letterSpacing: 1, fontWeight: 700 }}>
            SCORE DISTRIBUTION
          </div>
          {sortedScores.map(({ node, count, pct }, i) => (
            <div key={node} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ fontWeight: 600 }}>
                  <span style={{ color: COLORS.textDim, marginRight: 4 }}>#{i + 1}</span>
                  {node}
                </span>
                <span style={{ color: COLORS.accent, fontWeight: 700 }}>{pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 4, background: COLORS.border, borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${maxPct > 0 ? (pct / maxPct) * 100 : 0}%`,
                  background: `linear-gradient(90deg, ${COLORS.node}, ${COLORS.accent})`,
                  transition: "width 0.3s ease",
                }} />
              </div>
              <div style={{ fontSize: 9, color: COLORS.textDim, marginTop: 1 }}>{count} visits</div>
            </div>
          ))}

          {totalSteps === 0 && (
            <div style={{ fontSize: 11, color: COLORS.textDim, textAlign: "center", marginTop: 24 }}>
              Press START to begin<br />the random walk
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}