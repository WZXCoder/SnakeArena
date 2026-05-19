import { Point } from '../point.js';
import { ROW, COL } from '../constants.js';
import { getActionFromPath, isCollisionIgnoreTail, safeRandomAction } from './planning-common.js';

export function astarPath(start, target, walls, snakes, ignoreTail = true) {
  const obstacleSet = new Set();
  for (const w of walls) obstacleSet.add(`${w.row},${w.col}`);
  for (const s of snakes) obstacleSet.add(`${s.row},${s.col}`);

  if (ignoreTail && snakes.length > 0) {
    const tail = snakes[snakes.length - 1];
    obstacleSet.delete(`${tail.row},${tail.col}`);
  }

  const targetPos = `${target.row},${target.col}`;
  if (obstacleSet.has(targetPos)) return null;

  const startPos = `${start.row},${start.col}`;
  const heuristic = (r, c) =>
    Math.abs(r - target.row) + Math.abs(c - target.col);

  const pq = [{ f: heuristic(start.row, start.col), g: 0, r: start.row, c: start.col }];
  const gScore = new Map([[startPos, 0]]);
  const parent = new Map();
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (pq.length) {
    pq.sort((a, b) => a.f - b.f);
    const { g: curG, r, c } = pq.shift();
    const key = `${r},${c}`;
    if (curG > (gScore.get(key) ?? Infinity)) continue;
    if (key === targetPos) {
      const path = [];
      let cur = [r, c];
      while (`${cur[0]},${cur[1]}` !== startPos) {
        path.push(new Point(cur[0], cur[1]));
        cur = parent.get(`${cur[0]},${cur[1]}`);
      }
      path.reverse();
      return path;
    }
    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= ROW || nc < 0 || nc >= COL) continue;
      const nk = `${nr},${nc}`;
      if (obstacleSet.has(nk)) continue;
      const newG = curG + 1;
      if (newG < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, newG);
        parent.set(nk, [r, c]);
        pq.push({ f: newG + heuristic(nr, nc), g: newG, r: nr, c: nc });
      }
    }
  }
  return null;
}

export function axControllerAction(proxy) {
  const path = astarPath(proxy.head, proxy.food, proxy.walls, proxy.snakes);
  if (path && path.length > 0) {
    return getActionFromPath(proxy.head, path[0], proxy.direct);
  }
  return safeRandomAction(proxy);
}
