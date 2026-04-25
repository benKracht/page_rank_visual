import { CONFIG } from "./constants";

export class Graph {
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
      const neighbors = Object.keys(this.edges[u]);
      const totalWeight = neighbors.reduce((s, v) => s + this.edges[u][v].weight, 0);
      if (totalWeight > 0) {
        for (const v of neighbors) {
          this.edges[u][v].probability = this.edges[u][v].weight / totalWeight;
        }
      }
    }
  }

  getProbability(u, v) {
    if (u in this.edges && v in this.edges[u]) {
      return this.edges[u][v].probability;
    }
    return 0;
  }

  /**
   * One step of the random walk with damping.
   * @param {string} current - current node
   * @param {number} dampingFactor - probability of following an edge (vs teleporting)
   * @returns {{ node: string, type: 'walk' | 'teleport' }}
   */
  getNextStep(current, dampingFactor) {
    const d = dampingFactor != null ? dampingFactor : CONFIG.DAMPING_FACTOR;
    const allNodes = Array.from(this.nodes);
    const neighbors = Object.keys(this.edges[current] || {});

    // Dangling node or random teleport
    if (neighbors.length === 0 || Math.random() > d) {
      const target = allNodes[Math.floor(Math.random() * allNodes.length)];
      return { node: target, type: "teleport" };
    }

    // Follow an edge based on transition probability
    const probs = neighbors.map((v) => this.edges[current][v].probability);
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < neighbors.length; i++) {
      cumulative += probs[i];
      if (r <= cumulative) return { node: neighbors[i], type: "walk" };
    }
    return { node: neighbors[neighbors.length - 1], type: "walk" };
  }

  /**
   * Power iteration for the true PageRank vector.
   * @param {number} dampingFactor
   * @param {number} iterations
   * @returns {Object} { node: rank } summing to 1
   */
  calculatePageRank(dampingFactor, iterations = 200) {
    const d = dampingFactor != null ? dampingFactor : CONFIG.DAMPING_FACTOR;
    const nodes = Array.from(this.nodes);
    const n = nodes.length;
    if (n === 0) return {};

    let ranks = {};
    nodes.forEach((node) => (ranks[node] = 1 / n));

    for (let iter = 0; iter < iterations; iter++) {
      const newRanks = {};
      nodes.forEach((node) => (newRanks[node] = (1 - d) / n));

      for (const u of nodes) {
        const neighbors = Object.keys(this.edges[u] || {});
        if (neighbors.length === 0) {
          // Dangling node: distribute rank evenly
          const share = (d * ranks[u]) / n;
          nodes.forEach((node) => (newRanks[node] += share));
        } else {
          for (const v of neighbors) {
            const prob = this.edges[u][v].probability;
            newRanks[v] += d * ranks[u] * prob;
          }
        }
      }

      ranks = newRanks;
    }

    return ranks;
  }
}

export function buildPresetGraph(preset) {
  const g = new Graph();

  if (preset === "simple") {
    ["A", "B", "C", "D"].forEach((n) => g.addNode(n));
    g.addEdge("A", "B", 1);
    g.addEdge("A", "C", 1);
    g.addEdge("B", "C", 1);
    g.addEdge("B", "D", 1);
    g.addEdge("C", "A", 1);
    g.addEdge("D", "A", 1);
    g.addEdge("D", "C", 1);
  } else if (preset === "star") {
    ["Hub", "A", "B", "C", "D", "E"].forEach((n) => g.addNode(n));
    ["A", "B", "C", "D", "E"].forEach((n) => {
      g.addEdge(n, "Hub", 1);
      g.addEdge("Hub", n, 1);
    });
  } else if (preset === "web") {
    ["Home", "About", "Blog", "Shop", "Contact", "FAQ"].forEach((n) => g.addNode(n));
    g.addEdge("Home", "About", 2);
    g.addEdge("Home", "Blog", 3);
    g.addEdge("Home", "Shop", 4);
    g.addEdge("Home", "Contact", 1);
    g.addEdge("About", "Home", 2);
    g.addEdge("About", "Contact", 1);
    g.addEdge("Blog", "Home", 1);
    g.addEdge("Blog", "Shop", 2);
    g.addEdge("Blog", "FAQ", 1);
    g.addEdge("Shop", "Home", 1);
    g.addEdge("Shop", "FAQ", 2);
    g.addEdge("Shop", "Blog", 1);
    g.addEdge("Contact", "Home", 3);
    g.addEdge("FAQ", "Home", 1);
    g.addEdge("FAQ", "Shop", 1);
  } else if (preset === "trap") {
    // Spider trap: B↔C cycle absorbs rank without teleportation
    ["Normal_1", "Trap_1", "Trap_2", "Normal_2", "Normal_3"].forEach((n) => g.addNode(n));
    g.addEdge("Normal_1", "Trap_1", 1);
    g.addEdge("Normal_1", "Normal_2", 1);
    g.addEdge("Trap_1", "Trap_2", 1);
    g.addEdge("Trap_2", "Trap_1", 1);
    g.addEdge("Normal_2", "Normal_1", 1);
    g.addEdge("Normal_2", "Normal_3", 1);
    g.addEdge("Normal_3", "Normal_1", 1);
  }

  g.normalize();
  return g;
}