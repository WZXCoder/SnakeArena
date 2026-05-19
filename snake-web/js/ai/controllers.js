import { ROW, COL } from '../constants.js';
import { ProxyGame } from './planning-common.js';
import { bfsControllerAction } from './bfs.js';
import { chooseActionApf } from './apf.js';
import { axControllerAction } from './astar.js';
import { dijkstraControllerAction } from './dijkstra.js';
import { rrtControllerAction } from './rrt.js';
import { rrtxControllerAction } from './rrtx.js';
import { dwaDecision } from './dwa.js';
import { createOnnxController } from './onnx-rl.js';
import { Point } from '../point.js';

/** 对应 ui_pvp_core._GameLikeForAI */
export class GameLikeForAI {
  constructor(head, direct, food, walls, body, opponentOccupied) {
    this.head = head;
    this.direct = direct;
    this.food = food;
    this.walls = walls;
    this.snakes = body;
    this._opp = opponentOccupied;
  }

  isCollision(pt = null) {
    const p = pt ?? this.head;
    if (p.row < 0 || p.row >= ROW || p.col < 0 || p.col >= COL) return true;
    if (this._opp.has(`${p.row},${p.col}`)) return true;
    for (const w of this.walls) {
      if (w.row === p.row && w.col === p.col) return true;
    }
    for (const s of this.snakes) {
      if (s.row === p.row && s.col === p.col) return true;
    }
    return false;
  }
}

function wrapSync(fn) {
  return { nextAction: (g) => fn(g) };
}

function wrapAsync(ctrl) {
  return {
    nextAction: async (g) => ctrl.nextAction(g),
  };
}

export function buildController(algoName) {
  const upper = algoName.trim().toUpperCase();

  if (upper === 'BFS') return wrapSync(bfsControllerAction);
  if (upper === 'APF') {
    return wrapSync((g) => chooseActionApf(g, ROW, COL));
  }
  if (upper === 'AX') {
    return wrapSync((g) => {
      const proxy = new ProxyGame(g, g._opp);
      return axControllerAction(proxy);
    });
  }
  if (upper === 'DIJKSTRA') {
    return wrapSync((g) => {
      const proxy = new ProxyGame(g, g._opp);
      return dijkstraControllerAction(proxy);
    });
  }
  if (upper === 'RRT') {
    return wrapSync((g) => {
      const proxy = new ProxyGame(g, g._opp);
      return rrtControllerAction(proxy);
    });
  }
  if (upper === 'RRTX') {
    return wrapSync((g) => {
      const proxy = new ProxyGame(g, g._opp);
      return rrtxControllerAction(proxy);
    });
  }
  if (upper === 'DWA') {
    return wrapSync((g) => {
      const proxy = new ProxyGame(g, g._opp);
      return dwaDecision(proxy);
    });
  }
  if (['DQN', 'DDQN', 'DUELINGDQN', 'PPO', 'TRPO', 'A2C'].includes(upper)) {
    return wrapAsync(createOnnxController(upper));
  }
  return wrapSync(bfsControllerAction);
}

export { Point };
