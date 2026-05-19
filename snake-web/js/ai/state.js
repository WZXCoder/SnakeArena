import { Point } from '../point.js';

/** 与 agent_DQN.get_state 一致 */
export function getState(game) {
  const head = game.head;
  const pointL = new Point(head.row, head.col - 1);
  const pointR = new Point(head.row, head.col + 1);
  const pointU = new Point(head.row - 1, head.col);
  const pointD = new Point(head.row + 1, head.col);

  const dirL = game.direct === 'left';
  const dirR = game.direct === 'right';
  const dirU = game.direct === 'up';
  const dirD = game.direct === 'down';

  return [
    (dirR && game.isCollision(pointR)) ||
      (dirL && game.isCollision(pointL)) ||
      (dirU && game.isCollision(pointU)) ||
      (dirD && game.isCollision(pointD)),
    (dirU && game.isCollision(pointR)) ||
      (dirD && game.isCollision(pointL)) ||
      (dirL && game.isCollision(pointU)) ||
      (dirR && game.isCollision(pointD)),
    (dirD && game.isCollision(pointR)) ||
      (dirU && game.isCollision(pointL)) ||
      (dirR && game.isCollision(pointU)) ||
      (dirL && game.isCollision(pointD)),
    dirL,
    dirR,
    dirU,
    dirD,
    game.food.col < game.head.col,
    game.food.col > game.head.col,
    game.food.row < game.head.row,
    game.food.row > game.head.row,
  ].map((v) => (v ? 1 : 0));
}
