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

export function rrtPath(start, target, walls, snakes, maxIter = 1500, goalSampleRate = 0.1) {
  const obstacleSet = new Set();
  for (const w of walls) obstacleSet.add(`${w.row},${w.col}`);
  for (const s of snakes) obstacleSet.add(`${s.row},${s.col}`);

  const startPos = [start.row, start.col];
  const targetPos = [target.row, target.col];
  if (
    obstacleSet.has(`${startPos[0]},${startPos[1]}`) ||
    obstacleSet.has(`${targetPos[0]},${targetPos[1]}`)
  ) {
    return null;
  }

  const nodes = [{ row: startPos[0], col: startPos[1], parent: null }];
  const treePositions = new Set([`${startPos[0]},${startPos[1]}`]);

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

    const newNode = { row: newPos[0], col: newPos[1], parent: nearest };
    nodes.push(newNode);
    treePositions.add(`${newPos[0]},${newPos[1]}`);

    if (newPos[0] === targetPos[0] && newPos[1] === targetPos[1]) {
      const path = [];
      let cur = newNode;
      while (cur.parent) {
        path.push(new Point(cur.row, cur.col));
        cur = cur.parent;
      }
      path.reverse();
      return path;
    }
  }
  return null;
}

export function rrtControllerAction(proxy) {
  const path = rrtPath(proxy.head, proxy.food, proxy.walls, proxy.snakes);
  if (path && path.length > 0) {
    return getActionFromPath(proxy.head, path[0], proxy.direct);
  }
  return safeRandomAction(proxy);
}
