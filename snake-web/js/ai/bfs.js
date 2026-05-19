import { Point } from '../point.js';
import { ROW, COL } from '../constants.js';
import { actionFromTargetDir, dirFromDelta } from '../game-utils.js';

function neighbors(r, c) {
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];
}

export function bfsNextStep(start, target, blocked) {
  const s = `${start.row},${start.col}`;
  const t = `${target.row},${target.col}`;
  if (blocked.has(t)) return null;

  const queue = [[start.row, start.col]];
  const parent = new Map([[s, null]]);

  while (queue.length) {
    const [cr, cc] = queue.shift();
    const key = `${cr},${cc}`;
    if (key === t) break;
    for (const [nr, nc] of neighbors(cr, cc)) {
      if (nr < 0 || nr >= ROW || nc < 0 || nc >= COL) continue;
      const nk = `${nr},${nc}`;
      if (parent.has(nk)) continue;
      if (blocked.has(nk)) continue;
      parent.set(nk, [cr, cc]);
      queue.push([nr, nc]);
    }
  }

  if (!parent.has(t)) return null;
  let cur = [target.row, target.col];
  let prev = parent.get(t);
  while (prev && `${prev[0]},${prev[1]}` !== s) {
    cur = prev;
    prev = parent.get(`${cur[0]},${cur[1]}`);
  }
  return new Point(cur[0], cur[1]);
}

export function bfsControllerAction(gameLike) {
  const blocked = new Set();
  for (const w of gameLike.walls) blocked.add(`${w.row},${w.col}`);
  for (const s of gameLike.snakes) blocked.add(`${s.row},${s.col}`);
  if (gameLike._opp) {
    for (const key of gameLike._opp) {
      const [r, c] = String(key).split(',');
      if (r != null && c != null) blocked.add(`${r},${c}`);
    }
  }

  const nxt = bfsNextStep(gameLike.head, gameLike.food, blocked);
  if (!nxt) return [1, 0, 0];
  const dr = nxt.row - gameLike.head.row;
  const dc = nxt.col - gameLike.head.col;
  return actionFromTargetDir(gameLike.direct, dirFromDelta(dr, dc));
}
