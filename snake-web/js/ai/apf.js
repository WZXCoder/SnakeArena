/** 对应 play_APF.py */
const K_ATT = 1.0;
const K_REP = 10.0;
const D0 = 3.0;
const INF = Infinity;

const DIR_VEC = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

function distance(p1, p2) {
  const r1 = p1.row ?? p1[0];
  const c1 = p1.col ?? p1[1];
  const r2 = p2.row ?? p2[0];
  const c2 = p2.col ?? p2[1];
  return Math.hypot(r1 - r2, c1 - c2);
}

function attractivePotential(pos, food) {
  return K_ATT * distance(pos, food);
}

function repulsivePotential(pos, obstacles) {
  let U = 0;
  for (const obs of obstacles) {
    const d = distance(pos, obs);
    if (d === 0) return INF;
    if (d < D0) U += 0.5 * K_REP * (1 / d - 1 / D0) ** 2;
  }
  return U;
}

function totalPotential(pos, food, walls, snakes) {
  const obstacles = [];
  for (const w of walls) obstacles.push([w.row, w.col]);
  for (const s of snakes) obstacles.push([s.row, s.col]);
  return attractivePotential(pos, food) + repulsivePotential(pos, obstacles);
}

function isSafe(pos, walls, snakes, ROW, COL) {
  const [r, c] = pos;
  if (r < 0 || r >= ROW || c < 0 || c >= COL) return false;
  for (const w of walls) {
    if (w.row === r && w.col === c) return false;
  }
  for (const s of snakes) {
    if (s.row === r && s.col === c) return false;
  }
  return true;
}

export function chooseActionApf(game, ROW, COL) {
  const head = game.head;
  const direction = game.direct;
  const food = game.food;
  const walls = game.walls;
  const snakes = game.snakes;

  const frontVec = DIR_VEC[direction];
  const [dr, dc] = frontVec;
  const rightVec = [dc, -dr];
  const leftVec = [-dc, dr];

  const frontPos = [head.row + frontVec[0], head.col + frontVec[1]];
  const rightPos = [head.row + rightVec[0], head.col + rightVec[1]];
  const leftPos = [head.row + leftVec[0], head.col + leftVec[1]];

  const cand = {};
  if (isSafe(frontPos, walls, snakes, ROW, COL)) {
    cand.front = totalPotential(frontPos, food, walls, snakes);
  }
  if (isSafe(rightPos, walls, snakes, ROW, COL)) {
    cand.right = totalPotential(rightPos, food, walls, snakes);
  }
  if (isSafe(leftPos, walls, snakes, ROW, COL)) {
    cand.left = totalPotential(leftPos, food, walls, snakes);
  }

  if (Object.keys(cand).length === 0) return [1, 0, 0];

  let best = Object.keys(cand).reduce((a, b) => (cand[a] <= cand[b] ? a : b));
  if (cand.front !== undefined && cand.front === cand[best]) best = 'front';

  if (best === 'front') return [1, 0, 0];
  if (best === 'right') return [0, 1, 0];
  return [0, 0, 1];
}
