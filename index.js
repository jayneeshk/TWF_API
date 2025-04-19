const express = require('express');
const app = express();
app.use(express.json());

// Graph (Adjacency list format with weights)
const graph = {
  C1: { C2: 4, L1: 3 },
  C2: { C1: 4, C3: 3, L1: 2.5 },
  C3: { C2: 3, L1: 2 },
  L1: { C1: 3, C2: 2.5, C3: 2 },
};

// Product-to-center map
const productCenterMap = {
  A: 'C1', B: 'C1', C: 'C1',
  D: 'C2', E: 'C2', F: 'C2',
  G: 'C3', H: 'C3', I: 'C3',
};

// Cost based on weight
function getCost(distance, weight) {
  if (weight === 0) return distance * 10; // assume base cost applies for vehicle movement
  return distance * (weight <= 5 ? 10 : 8);
}

// Dijkstra’s algorithm to get shortest path distance between two nodes
function dijkstra(start, end) {
  const distances = {};
  const visited = new Set();
  const queue = [[start, 0]];

  for (const node in graph) distances[node] = Infinity;
  distances[start] = 0;

  while (queue.length > 0) {
    queue.sort((a, b) => a[1] - b[1]);
    const [current, dist] = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    for (const neighbor in graph[current]) {
      const alt = dist + graph[current][neighbor];
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        queue.push([neighbor, alt]);
      }
    }
  }

  return distances[end];
}

// Calculate total weight per center
function totalWeightPerCenter(order) {
  const centers = { C1: 0, C2: 0, C3: 0 };
  for (const [product, qty] of Object.entries(order)) {
    const center = productCenterMap[product];
    centers[center] += qty;
  }
  return Object.fromEntries(Object.entries(centers).filter(([_, w]) => w > 0));
}

// Recursive route generator with L1 as starting point
function generateRoutes(pickups) {
  const routes = [];

  function dfs(path, remaining, currentNode, carriedWeight, costSoFar, visitedCenters) {
    if (remaining.length === 0 && currentNode === 'L1') {
      routes.push({ cost: costSoFar });
      return;
    }

    // Option to go to L1 and drop current load
    if (currentNode !== 'L1' && carriedWeight > 0) {
      const toL1 = dijkstra(currentNode, 'L1');
      const cost = getCost(toL1, carriedWeight);
      dfs(
        [...path, 'L1'],
        remaining,
        'L1',
        0,
        costSoFar + cost,
        visitedCenters
      );
    }

    // Pick next pickup center (if not already picked)
    for (let i = 0; i < remaining.length; i++) {
      const next = remaining[i];
      const dist = dijkstra(currentNode, next);
      const nextWeight = pickups[next];
      const cost = getCost(dist, carriedWeight); // carry current load to pickup

      dfs(
        [...path, next],
        remaining.filter((_, idx) => idx !== i),
        next,
        carriedWeight + nextWeight,
        costSoFar + cost,
        [...visitedCenters, next]
      );
    }
  }

  // Initial step: start from L1 to each pickup center
  for (const center of Object.keys(pickups)) {
    const toCenter = dijkstra('L1', center);
    const costToCenter = getCost(toCenter, 0); // empty vehicle
    const weight = pickups[center];

    dfs(['L1', center], Object.keys(pickups).filter(c => c !== center), center, weight, costToCenter, [center]);
  }

  return routes;
}

// Main API endpoint
app.post('/calculate-cost', (req, res) => {
  const order = req.body;

  // Calculate weight at each center
  const pickups = totalWeightPerCenter(order);
  if (Object.keys(pickups).length === 0) {
    return res.status(400).json({ error: 'No valid products in request.' });
  }

  // Generate all possible pickup + delivery paths
  const routes = generateRoutes(pickups);

  if (routes.length === 0) {
    return res.status(500).json({ error: 'Could not find valid delivery path.' });
  }

  const minCost = Math.min(...routes.map(r => r.cost));
  res.json({ minimumCost: minCost });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
