import { useRef, useEffect, useState, useCallback } from "react";
import { CONFIG } from "./constants";
import { buildPresetGraph } from "./Graph";

function layoutNodes(graph, width, height) {
  const nodes = Array.from(graph.nodes);
  const n = nodes.length;
  if (n === 0) return {};
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.32;
  const positions = {};
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions[node] = {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
  return positions;
}

export function useGraphSimulation(containerRef, preset) {
  const [stats, setStats] = useState({
    totalSteps: 0,
    scores: {},
    trueRanks: {},
  });

  const stateRef = useRef({
    graph: null,
    positions: {},
    walkers: [],
    scores: {},
    totalSteps: 0,
    running: false,
    speed: 1,
    walkerCount: CONFIG.WALKER_COUNT,
    dampingFactor: CONFIG.DAMPING_FACTOR,
    trueRanks: {},
    draggedNode: null,
  });

  const reset = useCallback(() => {
    const st = stateRef.current;
    const g = buildPresetGraph(preset);
    const trueRanks = g.calculatePageRank(st.dampingFactor);

    const el = containerRef.current;
    const w = el ? el.clientWidth : 800;
    const h = el ? el.clientHeight : 600;

    const nodes = Array.from(g.nodes);
    const positions = layoutNodes(g, w, h);

    const walkers = [];
    for (let i = 0; i < st.walkerCount; i++) {
      const startNode = nodes[Math.floor(Math.random() * nodes.length)];
      walkers.push({ current: startNode, target: null, t: 0, type: "walk" });
    }

    const initScores = {};
    nodes.forEach((n) => (initScores[n] = 0));

    stateRef.current = {
      ...st,
      graph: g,
      positions,
      walkers,
      scores: initScores,
      totalSteps: 0,
      trueRanks,
      running: false,
      draggedNode: null,
    };

    setStats({ totalSteps: 0, scores: { ...initScores }, trueRanks });
  }, [preset, containerRef]);

  // Re-layout on resize without resetting simulation
  useEffect(() => {
    const handleResize = () => {
      const el = containerRef.current;
      const st = stateRef.current;
      if (!el || !st.graph) return;
      st.positions = layoutNodes(st.graph, el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [containerRef]);

  // Main simulation loop
  useEffect(() => {
    let animId;
    let lastTime = 0;
    let updateCounter = 0;

    const loop = (timestamp) => {
      const dt = lastTime ? (timestamp - lastTime) / 1000 : 0.016;
      lastTime = timestamp;

      const st = stateRef.current;
      if (!st.graph || !st.running) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const speedFactor = CONFIG.SPEED_MULTIPLIER * st.speed;

      st.walkers.forEach((w) => {
        if (!w.target) {
          const step = st.graph.getNextStep(w.current, st.dampingFactor);
          w.target = step.node;
          w.type = step.type;
          w.t = 0;
        }

        const moveSpeed = w.type === "teleport" ? speedFactor * 2 : speedFactor;
        w.t += dt * moveSpeed;

        if (w.t >= 1) {
          w.current = w.target;
          w.target = null;
          w.t = 0;
          st.scores[w.current] = (st.scores[w.current] || 0) + 1;
          st.totalSteps++;
        }
      });

      updateCounter++;
      if (updateCounter >= 10) {
        updateCounter = 0;
        setStats({
          totalSteps: st.totalSteps,
          scores: { ...st.scores },
          trueRanks: st.trueRanks,
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const setRunning = useCallback((r) => {
    stateRef.current.running = r;
  }, []);

  const setSpeed = useCallback((s) => {
    stateRef.current.speed = s;
  }, []);

  const setWalkerCount = useCallback((count) => {
    const st = stateRef.current;
    st.walkerCount = count;

    // If graph isn't initialized yet, just return
    if (!st.graph) return;

    const currentWalkers = st.walkers;
    const currentLen = currentWalkers.length;

    if (count > currentLen) {
      // 1. ADD WALKERS: Create new random walkers to fill the gap
      const diff = count - currentLen;
      const nodes = Array.from(st.graph.nodes);
      
      for (let i = 0; i < diff; i++) {
        const startNode = nodes[Math.floor(Math.random() * nodes.length)];
        currentWalkers.push({
          current: startNode,
          target: null,
          t: 0,
          type: "walk",
        });
      }
    } else if (count < currentLen) {
      // 2. REMOVE WALKERS: Simply trim the array
      currentWalkers.length = count;
    }
  }, []);

  const setDampingFactor = useCallback((d) => {
    stateRef.current.dampingFactor = d;
    // Recalculate true ranks for the new damping factor
    if (stateRef.current.graph) {
      stateRef.current.trueRanks = stateRef.current.graph.calculatePageRank(d);
      setStats((prev) => ({ ...prev, trueRanks: stateRef.current.trueRanks }));
    }
  }, []);

  return {
    stateRef,
    reset,
    stats,
    setRunning,
    setSpeed,
    setWalkerCount,
    setDampingFactor,
  };
}