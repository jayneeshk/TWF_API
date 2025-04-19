const graph = {
  C1: { C2: 4, L1: 3 },
  C2: { C1: 4, C3: 3, L1: 2.5 },
  C3: { C2: 3, L1: 2 },
  L1: { C1: 3, C2: 2.5, C3: 2 }
};

const productCenterMap = {
  A: "C1", B: "C1", C: "C1",
  D: "C2", E: "C2", F: "C2",
  G: "C3", H: "C3", I: "C3"
};

function getCost(distance, weight) {
  return distance * (weight <= 5 ? 10 : 8);
}

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

function totalWeightPerCenter(order) {
  const centers = { C1: 0, C2: 0, C3: 0 };
  for (const [product, qty] of Object.entries(order)) {
    const center = productCenterMap[product];
    if (center) centers[center] += qty;
  }
  return Object.fromEntries(Object.entries(centers).filter(([_, w]) => w > 0));
}

function generateRoutes(pickups) {
  const routes = [];

  function dfs(path, remaining, currentNode, carriedWeight, costSoFar) {
    if (remaining.length === 0 && currentNode === 'L1') {
      routes.push({ cost: costSoFar });
      return;
    }

    if (currentNode !== 'L1' && carriedWeight > 0) {
      const toL1 = dijkstra(currentNode, 'L1');
      const cost = getCost(toL1, carriedWeight);
      dfs([...path, 'L1'], remaining, 'L1', 0, costSoFar + cost);
    }

    for (let i = 0; i < remaining.length; i++) {
      const next = remaining[i];
      const dist = dijkstra(currentNode, next);
      const nextWeight = pickups[next];
      const cost = getCost(dist, carriedWeight);
      dfs(
        [...path, next],
        remaining.filter((_, idx) => idx !== i),
        next,
        carriedWeight + nextWeight,
        costSoFar + cost
      );
    }
  }

  for (const center of Object.keys(pickups)) {
    const toCenter = dijkstra('L1', center);
    const costToCenter = getCost(toCenter, 0);
    dfs(['L1', center], Object.keys(pickups).filter(c => c !== center), center, pickups[center], costToCenter);
  }

  return routes;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method is allowed' });
  }

  const order = req.body;
  const pickups = totalWeightPerCenter(order);
  if (!Object.keys(pickups).length) {
    return res.status(400).json({ error: 'No valid products in request.' });
  }

  const routes = generateRoutes(pickups);
  if (!routes.length) {
    return res.status(500).json({ error: 'No valid delivery path.' });
  }

  const minCost = Math.min(...routes.map(r => r.cost));
  return res.status(200).json({ minimumCost: minCost });
};