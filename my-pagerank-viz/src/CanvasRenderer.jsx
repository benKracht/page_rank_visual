import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { COLORS, CONFIG } from "./constants";

/**
 * Curve offset for edge u→v.
 * Bidirectional edges get more curvature so they don't overlap.
 */
function getCurveOffset(graph, u, v) {
  const hasReverse = graph.edges[v] && u in graph.edges[v];
  return hasReverse ? 35 : 18;
}

function getControlPoint(from, to, curvature) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return { x: from.x, y: from.y };
  const ux = dx / dist;
  const uy = dy / dist;
  return {
    x: (from.x + to.x) / 2 - uy * curvature,
    y: (from.y + to.y) / 2 + ux * curvature,
  };
}

function bezierPoint(sx, sy, cx, cy, ex, ey, t) {
  const inv = 1 - t;
  return {
    x: inv * inv * sx + 2 * inv * t * cx + t * t * ex,
    y: inv * inv * sy + 2 * inv * t * cy + t * t * ey,
  };
}

function bezierTangent(sx, sy, cx, cy, ex, ey, t) {
  const inv = 1 - t;
  return {
    x: 2 * inv * (cx - sx) + 2 * t * (ex - cx),
    y: 2 * inv * (cy - sy) + 2 * t * (ey - cy),
  };
}

function findTAtRadius(sx, sy, cx, cy, ex, ey, center, radius, tLo, tHi) {
  for (let i = 0; i < 14; i++) {
    const tMid = (tLo + tHi) / 2;
    const pt = bezierPoint(sx, sy, cx, cy, ex, ey, tMid);
    const dist = Math.sqrt((pt.x - center.x) ** 2 + (pt.y - center.y) ** 2);
    if (dist > radius) {
      tLo = tMid;
    } else {
      tHi = tMid;
    }
  }
  return tLo;
}

function drawEdge(ctx, from, to, curvature, color, lineWidth) {
  const ctrl = getControlPoint(from, to, curvature);
  const r = CONFIG.NODE_RADIUS;
  const margin = 2;

  const tStartRev = findTAtRadius(
    to.x, to.y, ctrl.x, ctrl.y, from.x, from.y,
    from, r + margin, 0.0, 1.0
  );
  const clampedStart = Math.max(0.02, 1 - tStartRev);

  const clampedEnd = findTAtRadius(
    from.x, from.y, ctrl.x, ctrl.y, to.x, to.y,
    to, r + margin, 0.5, 1.0
  );

  if (clampedEnd <= clampedStart + 0.02) return;

  const steps = 24;
  ctx.beginPath();
  const p0 = bezierPoint(from.x, from.y, ctrl.x, ctrl.y, to.x, to.y, clampedStart);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i <= steps; i++) {
    const t = clampedStart + (clampedEnd - clampedStart) * (i / steps);
    const p = bezierPoint(from.x, from.y, ctrl.x, ctrl.y, to.x, to.y, t);
    ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  const tip = bezierPoint(from.x, from.y, ctrl.x, ctrl.y, to.x, to.y, clampedEnd);
  const tang = bezierTangent(from.x, from.y, ctrl.x, ctrl.y, to.x, to.y, clampedEnd);
  const tLen = Math.sqrt(tang.x ** 2 + tang.y ** 2);
  if (tLen < 0.01) return;
  const tx = tang.x / tLen;
  const ty = tang.y / tLen;
  const nx = -ty;
  const ny = tx;

  const arrowLen = 9;
  const arrowHalf = 4;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - arrowLen * tx + arrowHalf * nx, tip.y - arrowLen * ty + arrowHalf * ny);
  ctx.lineTo(tip.x - arrowLen * tx - arrowHalf * nx, tip.y - arrowLen * ty - arrowHalf * ny);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function getWalkerPosition(from, to, curvature, t, type) {
  if (type === "teleport") {
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
  }
  const ctrl = getControlPoint(from, to, curvature);
  return bezierPoint(from.x, from.y, ctrl.x, ctrl.y, to.x, to.y, t);
}

/**
 * CanvasRenderer — renders the graph simulation.
 *
 * Props:
 *   stateRef       – shared simulation state ref
 *   width, height  – CSS display dimensions (px)
 *   renderSize     – optional { w, h } forcing internal pixel resolution
 *                    (used for high-res recording). Falls back to width/height.
 *
 * Exposes via ref:
 *   getCanvas()    – the underlying <canvas> DOM node (for captureStream)
 */
const CanvasRenderer = forwardRef(function CanvasRenderer(
  { stateRef, width, height, renderSize },
  ref
) {
  const canvasRef = useRef(null);
  const animIdRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

  // Effective internal pixel resolution (may differ from CSS size for recording)
  const pxW = renderSize?.w ?? width;
  const pxH = renderSize?.h ?? height;

  // --- Drag handlers (convert CSS coords → canvas pixel coords) ---
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const { positions } = stateRef.current;
    for (const [node, pos] of Object.entries(positions)) {
      const d = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (d < CONFIG.NODE_RADIUS + 6) {
        stateRef.current.draggedNode = node;
        canvas.style.cursor = "grabbing";
        return;
      }
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!stateRef.current.draggedNode || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    stateRef.current.positions[stateRef.current.draggedNode] = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handleMouseUp = () => {
    stateRef.current.draggedNode = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
  };

  // --- Render loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const render = () => {
      const { graph, positions, walkers, scores, totalSteps } = stateRef.current;

      // Only write canvas.width/height when it actually changes. Assigning every
      // frame would reset captureStream and flash the canvas.
      if (canvas.width !== pxW) canvas.width = pxW;
      if (canvas.height !== pxH) canvas.height = pxH;

      ctx.clearRect(0, 0, pxW, pxH);

      if (!graph || Object.keys(positions).length === 0) {
        animIdRef.current = requestAnimationFrame(render);
        return;
      }

      const nodes = Array.from(graph.nodes);

      // --- Background grid ---
      ctx.strokeStyle = "rgba(30, 41, 59, 0.15)";
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx < pxW; gx += 50) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, pxH); ctx.stroke();
      }
      for (let gy = 0; gy < pxH; gy += 50) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(pxW, gy); ctx.stroke();
      }

      // --- 1. Draw edges ---
      for (const u of nodes) {
        if (!graph.edges[u]) continue;
        for (const v of Object.keys(graph.edges[u])) {
          const from = positions[u];
          const to = positions[v];
          if (!from || !to) continue;

          const isActive = walkers.some(
            (w) => w.current === u && w.target === v && w.type === "walk"
          );

          const curvature = getCurveOffset(graph, u, v);
          const prob = graph.edges[u][v].probability;
          const baseWidth = 0.8 + prob * 4;

          drawEdge(
            ctx, from, to, curvature,
            isActive ? COLORS.edgeActive : COLORS.edge,
            isActive ? baseWidth + 1.5 : baseWidth
          );
        }
      }

      // --- 2. Draw walkers ---
      walkers.forEach((w) => {
        const fromPos = positions[w.current];
        if (!fromPos) return;

        let wx, wy;
        let walkerColor = COLORS.walker;
        let walkerRadius = 5;

        if (w.target && positions[w.target]) {
          const toPos = positions[w.target];
          const curvature =
            w.type === "teleport" ? 0 : getCurveOffset(graph, w.current, w.target);
          const pt = getWalkerPosition(fromPos, toPos, curvature, w.t, w.type);
          wx = pt.x;
          wy = pt.y;

          if (w.type === "teleport") {
            walkerColor = COLORS.walkerTeleport;
            walkerRadius = 3.5;

            ctx.beginPath();
            ctx.setLineDash([3, 5]);
            ctx.moveTo(fromPos.x, fromPos.y);
            ctx.lineTo(toPos.x, toPos.y);
            ctx.strokeStyle = "rgba(34, 211, 238, 0.12)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else {
          wx = fromPos.x;
          wy = fromPos.y;
          walkerRadius = 2;
        }

        const glowR = walkerRadius + 4;
        const glow = ctx.createRadialGradient(wx, wy, 0, wx, wy, glowR);
        glow.addColorStop(0, walkerColor);
        glow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(wx, wy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(wx, wy, walkerRadius, 0, Math.PI * 2);
        ctx.fillStyle = walkerColor;
        ctx.fill();
      });

      // --- 3. Draw nodes (on top) ---
      const maxScore = Math.max(1, ...Object.values(scores));

      for (const node of nodes) {
        const pos = positions[node];
        if (!pos) continue;
        const score = scores[node] || 0;
        const pct = totalSteps > 0 ? score / totalSteps : 0;
        const scoreRatio = totalSteps > 0 ? score / maxScore : 0;

        const r = CONFIG.NODE_RADIUS + scoreRatio * 6;

        const outerGlow = ctx.createRadialGradient(pos.x, pos.y, r, pos.x, pos.y, r * 2.2);
        outerGlow.addColorStop(0, `rgba(59, 130, 246, ${0.06 + scoreRatio * 0.18})`);
        outerGlow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = outerGlow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.surface;
        ctx.fill();

        const hue = 210 - scoreRatio * 175;
        ctx.strokeStyle = `hsl(${hue}, 75%, 55%)`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px -apple-system, 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node, pos.x, pos.y);

        if (totalSteps > 0) {
          ctx.fillStyle = COLORS.accent;
          ctx.font = "bold 10px monospace";
          ctx.fillText(`${(pct * 100).toFixed(1)}%`, pos.x, pos.y + r + 14);
        }
      }

      animIdRef.current = requestAnimationFrame(render);
    };

    animIdRef.current = requestAnimationFrame(render);
    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, [stateRef, pxW, pxH]);

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: "grab", display: "block", width: "100%", height: "100%" }}
    />
  );
});

export default CanvasRenderer;
