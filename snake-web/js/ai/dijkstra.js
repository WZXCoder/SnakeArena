import { Point } from '../point.js';
import { ROW, COL } from '../constants.js';
import { getActionFromPath, safeRandomAction } from './planning-common.js';

export function dijkstraPath(start, target, walls, snakes) {
  const obstacleSet = new Set();
  for (const w of walls) obstacleSet.add(`${w.row},${w.col}`);
  for (const s of snakes) obstacleSet.add(`${s.row},${s.col}`);

  const targetPos = `${target.row},${target.col}`;
  if (obstacleSet.has(targetPos)) return null;

  const startPos = `${start.row},${start.col}`;
  const pq = [{ dist: 0, r: start.row, c: start.col }];
  const dist = new Map([[startPos, 0]]);
  const parent = new Map();
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (pq.length) {
    pq.sort((a, b) => a.dist - b.dist);
    const { dist: curDist, r, c } = pq.shift();
    const key = `${r},${c}`;
    if (curDist > (dist.get(key) ?? Infinity)) continue;
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
      const newDist = curDist + 1;
      if (newDist < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, newDist);
        parent.set(nk, [r, c]);
        pq.push({ dist: newDist, r: nr, c: nc });
      }
    }
  }
  return null;
}

export function dijkstraControllerAction(proxy) {
  const path = dijkstraPath(proxy.head, proxy.food, proxy.walls, proxy.snakes);
  if (path && path.length > 0) {
    return getActionFromPath(proxy.head, path[0], proxy.direct);
  }
  return safeRandomAction(proxy);
}
