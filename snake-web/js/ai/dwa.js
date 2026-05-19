/** 对应 play_DWA.py */
import { ROW, COL } from '../constants.js';

function isCollisionIgnoreTail(game, pt) {
  if (pt.row < 0 || pt.row >= ROW || pt.col < 0 || pt.col >= COL) return true;
  for (const w of game.walls) {
    if (pt.row === w.row && pt.col === w.col) return true;
  }
  const snakes = game.snakes;
  if (snakes.length <= 1) {
    for (const s of snakes) {
      if (pt.row === s.row && pt.col === s.col) return true;
    }
    return false;
  }
  const tail = snakes[snakes.length - 1];
  for (let i = 0; i < snakes.length; i++) {
    const s = snakes[i];
    if (i === snakes.length - 1 && s.row === tail.row && s.col === tail.col) continue;
    if (pt.row === s.row && pt.col === s.col) return true;
  }
  return false;
}

function minObstacleDistance(game, pt) {
  let minDist = Infinity;
  for (const w of game.walls) {
    const d = Math.abs(pt.row - w.row) + Math.abs(pt.col - w.col);
    if (d < minDist) minDist = d;
  }
  const snakes = game.snakes;
  if (snakes.length > 1) {
    const tail = snakes[snakes.length - 1];
    for (let i = 0; i < snakes.length; i++) {
      const s = snakes[i];
      if (i === snakes.length - 1 && s.row === tail.row && s.col === tail.col) continue;
      const d = Math.abs(pt.row - s.row) + Math.abs(pt.col - s.col);
      if (d < minDist) minDist = d;
    }
  }
  return minDist;
}

export function dwaDecision(game, alpha = 2.0, beta = 1.0, gamma = 0.5) {
  const head = game.head;
  const direction = game.direct;
  const food = game.food;
  const clockWise = ['right', 'down', 'left', 'up'];
  const idx = clockWise.indexOf(direction);

  const actionList = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const names = ['straight', 'right', 'left'];

  let bestAction = [1, 0, 0];
  let bestScore = -Infinity;

  for (let i = 0; i < actionList.length; i++) {
    const actVec = actionList[i];
    let newDir = direction;
    if (actVec[1] === 1) newDir = clockWise[(idx + 1) % 4];
    else if (actVec[2] === 1) newDir = clockWise[(idx + 3) % 4];

    const newHead = head.copy();
    if (newDir === 'left') newHead.col -= 1;
    else if (newDir === 'right') newHead.col += 1;
    else if (newDir === 'up') newHead.row -= 1;
    else if (newDir === 'down') newHead.row += 1;

    if (isCollisionIgnoreTail(game, newHead)) continue;

    const distToFood = Math.hypot(newHead.row - food.row, newHead.col - food.col);
    const headingScore = 1.0 / (distToFood + 0.1);
    const minObsDist = minObstacleDistance(game, newHead);
    const clearanceScore = Math.min(1.0, minObsDist / 5.0);
    const velocityScore = names[i] === 'straight' ? 1.0 : 0.8;
    const totalScore = alpha * headingScore + beta * clearanceScore + gamma * velocityScore;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestAction = actVec;
    }
  }
  return bestAction;
}
