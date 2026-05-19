import { Point } from '../point.js';
import { ROW, COL } from '../constants.js';
import { DIRS } from '../constants.js';
import { actionFromTargetDir } from '../game-utils.js';

export function getActionFromPath(head, nextPoint, currentDirection) {
  const dr = nextPoint.row - head.row;
  const dc = nextPoint.col - head.col;
  let targetDir;
  if (dr === -1 && dc === 0) targetDir = 'up';
  else if (dr === 1 && dc === 0) targetDir = 'down';
  else if (dr === 0 && dc === -1) targetDir = 'left';
  else if (dr === 0 && dc === 1) targetDir = 'right';
  else return [1, 0, 0];
  return actionFromTargetDir(currentDirection, targetDir);
}

export function isCollisionIgnoreTail(game, pt) {
  if (pt.row < 0 || pt.row >= ROW || pt.col < 0 || pt.col >= COL) return true;
  for (const w of game.walls) {
    if (pt.row === w.row && pt.col === w.col) return true;
  }
  const snakes = game.snakes;
  const tail = snakes.length > 0 ? snakes[snakes.length - 1] : null;
  for (const s of snakes) {
    if (tail && s.row === tail.row && s.col === tail.col) continue;
    if (pt.row === s.row && pt.col === s.col) return true;
  }
  return false;
}

export function safeRandomAction(game) {
  const head = game.head;
  const direction = game.direct;
  const idx = DIRS.indexOf(direction);
  const testActions = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (const act of testActions) {
    let newDir = direction;
    if (act[1] === 1) newDir = DIRS[(idx + 1) % 4];
    else if (act[2] === 1) newDir = DIRS[(idx + 3) % 4];
    const newHead = head.copy();
    if (newDir === 'left') newHead.col -= 1;
    else if (newDir === 'right') newHead.col += 1;
    else if (newDir === 'up') newHead.row -= 1;
    else if (newDir === 'down') newHead.row += 1;
    if (!isCollisionIgnoreTail(game, newHead)) return act;
  }
  return [1, 0, 0];
}

export class ProxyGame {
  constructor(base, opponentOccupied) {
    this.head = base.head;
    this.direct = base.direct;
    this.food = base.food;
    this.snakes = base.snakes;
    this._opp = opponentOccupied ?? new Set();
    this.walls = [
      ...base.walls,
      ...[...this._opp]
        .map((key) => {
          const [rStr, cStr] = String(key).split(',');
          const r = Number.parseInt(rStr, 10);
          const c = Number.parseInt(cStr, 10);
          if (Number.isNaN(r) || Number.isNaN(c)) return null;
          return new Point(r, c);
        })
        .filter(Boolean),
    ];
    this.isCollision = base.isCollision?.bind(base);
  }
}
