import { Point } from '../point.js';
import { ROW, COL } from '../constants.js';
import { getActionFromPath, safeRandomAction } from './planning-common.js';

function dist(p1, p2) {
  return Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
}

function gridNeighbors(row, col) {
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  const result = [];
  for (const [dr, dc] of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < ROW && nc >= 0 && nc < COL) result.push([nr, nc]);
  }
  return result;
}

function propagateCost(node, allNodes) {
  const queue = [node];
  while (queue.length) {
    const cur = queue.shift();
    cur.cost = cur.parent ? cur.parent.cost + 1 : 0;
    for (const n of allNodes) {
      if (n.parent === cur) queue.push(n);
    }
  }
}

export function rrtStarPath(
  start,
  target,
  walls,
  snakes,
  maxIter = 1500,
  goalSampleRate = 0.1,
) {
  const obstacleSet = new Set();
  for (const w of walls) obstacleSet.add(`${w.row},${w.col}`);
  let ignoreTail = null;
  if (snakes.length > 1) {
    const tail = snakes[snakes.length - 1];
    ignoreTail = `${tail.row},${tail.col}`;
  }
  for (const s of snakes) {
    const pos = `${s.row},${s.col}`;
    if (ignoreTail && pos === ignoreTail) continue;
    obstacleSet.add(pos);
  }

  const startPos = [start.row, start.col];
  const targetPos = [target.row, target.col];
  if (
    obstacleSet.has(`${startPos[0]},${startPos[1]}`) ||
    obstacleSet.has(`${targetPos[0]},${targetPos[1]}`)
  ) {
    return null;
  }

  const nodes = [{ row: startPos[0], col: startPos[1], parent: null, cost: 0 }];
  const treePositions = new Set([`${startPos[0]},${startPos[1]}`]);
  let targetNode = null;

  for (let i = 0; i < maxIter; i++) {
    const sample =
      Math.random() < goalSampleRate
        ? targetPos
        : [Math.floor(Math.random() * ROW), Math.floor(Math.random() * COL)];
    if (obstacleSet.has(`${sample[0]},${sample[1]}`)) continue;

    let nearest = nodes[0];
    let bestD = dist([nearest.row, nearest.col], sample);
    for (const n of nodes) {
      const d = dist([n.row, n.col], sample);
      if (d < bestD) {
        bestD = d;
        nearest = n;
      }
    }

    const candidates = [];
    for (const [nr, nc] of gridNeighbors(nearest.row, nearest.col)) {
      const nk = `${nr},${nc}`;
      if (obstacleSet.has(nk)) continue;
      if (treePositions.has(nk)) continue;
      candidates.push([nr, nc]);
    }
    if (!candidates.length) continue;

    let newPos = candidates[0];
    let minD = dist(newPos, sample);
    for (const p of candidates) {
      const d = dist(p, sample);
      if (d < minD) {
        minD = d;
        newPos = p;
      }
    }
    const [newRow, newCol] = newPos;

    const neighborNodes = [];
    for (const [nbR, nbC] of gridNeighbors(newRow, newCol)) {
      const nk = `${nbR},${nbC}`;
      if (!treePositions.has(nk)) continue;
      for (const node of nodes) {
        if (node.row === nbR && node.col === nbC) {
          neighborNodes.push(node);
          break;
        }
      }
    }

    let bestParent = nearest;
    let bestCost = nearest.cost + 1;
    for (const candidate of neighborNodes) {
      if (candidate.cost + 1 < bestCost) {
        bestCost = candidate.cost + 1;
        bestParent = candidate;
      }
    }

    const newNode = { row: newRow, col: newCol, parent: bestParent, cost: bestCost };
    nodes.push(newNode);
    treePositions.add(`${newRow},${newCol}`);

    for (const neighbor of neighborNodes) {
      if (neighbor === bestParent) continue;
      if (newNode.cost + 1 < neighbor.cost) {
        neighbor.parent = newNode;
        propagateCost(neighbor, nodes);
      }
    }

    if (newRow === targetPos[0] && newCol === targetPos[1]) {
      if (!targetNode || newNode.cost < targetNode.cost) targetNode = newNode;
    }
  }

  if (!targetNode) return null;
  const path = [];
  let cur = targetNode;
  while (cur.parent) {
    path.push(new Point(cur.row, cur.col));
    cur = cur.parent;
  }
  path.reverse();
  return path;
}

export function rrtxControllerAction(proxy) {
  const path = rrtStarPath(proxy.head, proxy.food, proxy.walls, proxy.snakes);
  if (path && path.length > 0) {
    return getActionFromPath(proxy.head, path[0], proxy.direct);
  }
  return safeRandomAction(proxy);
}
