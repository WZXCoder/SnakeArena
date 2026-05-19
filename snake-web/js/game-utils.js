import { DIRS } from './constants.js';

export function turnDir(currentDir, action) {
  const idx = DIRS.indexOf(currentDir);
  if (action[1] === 1) return DIRS[(idx + 1) % 4];
  if (action[2] === 1) return DIRS[(idx + 3) % 4];
  return currentDir;
}

export function actionFromTargetDir(currentDir, targetDir) {
  const idx = DIRS.indexOf(currentDir);
  if (targetDir === currentDir) return [1, 0, 0];
  if (targetDir === DIRS[(idx + 1) % 4]) return [0, 1, 0];
  if (targetDir === DIRS[(idx + 3) % 4]) return [0, 0, 1];
  return [1, 0, 0];
}

export function stepFromDir(head, direct) {
  const p = head.copy();
  if (direct === 'left') p.col -= 1;
  else if (direct === 'right') p.col += 1;
  else if (direct === 'up') p.row -= 1;
  else if (direct === 'down') p.row += 1;
  return p;
}

export function inBounds(pt, ROW, COL) {
  return pt.row >= 0 && pt.row < ROW && pt.col >= 0 && pt.col < COL;
}

export function dirFromDelta(dr, dc) {
  if (dr === -1 && dc === 0) return 'up';
  if (dr === 1 && dc === 0) return 'down';
  if (dr === 0 && dc === -1) return 'left';
  if (dr === 0 && dc === 1) return 'right';
  return 'left';
}
