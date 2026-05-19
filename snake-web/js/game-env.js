import { Point } from './point.js';
import {
  ROW,
  COL,
  BASE_SPEED,
  SPEED_INCREASE,
  MAX_SPEED,
} from './constants.js';
import { turnDir } from './game-utils.js';

/** 对应 game_env.SnakeGameAI（无 Pygame 依赖） */
export class SnakeGameAI {
  constructor() {
    this.reset();
    this.frameIteration = 0;
    this._lastStepTime = 0;
  }

  reset() {
    this.head = new Point(Math.floor(ROW / 2), Math.floor(COL / 2));
    this.snakes = [];
    this.score = 0;
    this.direct = 'left';
    this.walls = this._generateWalls();
    this.food = this._genFood();
    this.frameIteration = 0;
    return this.score;
  }

  _generateWalls() {
    const totalCells = ROW * COL;
    const numWalls = Math.floor(totalCells * 0.01);
    const candidates = [];
    for (let r = 0; r < ROW; r++) {
      for (let c = 0; c < COL; c++) {
        if (r === this.head.row && c === this.head.col) continue;
        candidates.push(new Point(r, c));
      }
    }
    shuffle(candidates);
    return candidates.slice(0, Math.min(numWalls, candidates.length));
  }

  _genFood() {
    const blocked = new Set();
    blocked.add(`${this.head.row},${this.head.col}`);
    this.snakes.forEach((s) => blocked.add(`${s.row},${s.col}`));
    this.walls.forEach((w) => blocked.add(`${w.row},${w.col}`));

    const candidates = [];
    for (let r = 0; r < ROW; r++) {
      for (let c = 0; c < COL; c++) {
        if (!blocked.has(`${r},${c}`)) {
          candidates.push(new Point(r, c));
        }
      }
    }
    if (candidates.length === 0) {
      return this.head.copy();
    }
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }

  isCollision(pt = null) {
    const p = pt ?? this.head;
    if (p.col < 0 || p.row < 0 || p.col >= COL || p.row >= ROW) return true;
    if (this.walls.some((w) => w.equals(p))) return true;
    if (this.snakes.some((s) => s.equals(p))) return true;
    return false;
  }

  /**
   * @returns {{ reward: number, gameOver: boolean, score: number, stepped: boolean }}
   */
  playStep(action, nowMs) {
    const speed = Math.min(
      MAX_SPEED,
      BASE_SPEED + Math.floor(this.score / 10) * SPEED_INCREASE,
    );
    const interval = 1000 / speed;
    if (this._lastStepTime && nowMs - this._lastStepTime < interval) {
      return { reward: 0, gameOver: false, score: this.score, stepped: false };
    }
    this._lastStepTime = nowMs;

    this.frameIteration += 1;

    this.snakes.unshift(this.head.copy());
    this.direct = turnDir(this.direct, action);

    if (this.direct === 'left') this.head.col -= 1;
    else if (this.direct === 'right') this.head.col += 1;
    else if (this.direct === 'up') this.head.row -= 1;
    else if (this.direct === 'down') this.head.row += 1;

    let reward = 0;
    let gameOver = false;

    if (
      this.isCollision() ||
      this.frameIteration > 100 * this.snakes.length + 100
    ) {
      gameOver = true;
      reward = -10;
      return { reward, gameOver, score: this.score, stepped: true };
    }

    const ateFood = this.head.equals(this.food);
    if (ateFood) {
      this.food = this._genFood();
      this.score += 1;
      reward = 10;
    } else {
      this.snakes.pop();
    }

    return { reward, gameOver, score: this.score, stepped: true };
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
