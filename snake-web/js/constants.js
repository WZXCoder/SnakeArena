/** 与 game_env.py 一致的常量 */
export const WIDTH = 1200;
export const HEIGHT = 600;
export const ROW = 30;
export const COL = 60;
export const CELL_W = Math.floor(WIDTH / COL);
export const CELL_H = Math.floor(HEIGHT / ROW);

export const BG_COLOR = '#ffffff';
export const SNAKE_BODY_COLOR = '#00ff00';
export const SNAKE_HEAD_COLOR = '#ff0000';
export const FOOD_COLOR = '#ffa500';
export const WALL_COLOR = '#000000';
export const BLACK = '#000000';

export const BASE_SPEED = 10;
export const SPEED_INCREASE = 5;
export const MAX_SPEED = 30;

export const HUD_TITLE_COLOR = '#ffc800';
export const HUD_SCORE_COLOR = '#ffc800';
export const HUD_INFO_COLOR = '#00b4dc';

export const DIRS = ['right', 'down', 'left', 'up'];

export const ALGOS = [
  'DQN',
  'DDQN',
  'DuelingDQN',
  'PPO',
  'TRPO',
  'A2C',
  'APF',
  'Ax',
  'BFS',
  'Dijkstra',
  'DWA',
  'RRT',
  'RRTx',
];

export const SNAKE_PRESETS = [
  { name: 'Left (Red/Green)', spawn: { row: Math.floor(ROW / 2), col: Math.floor(COL / 6) }, colors: ['#ff0000', '#00b400'] },
  { name: 'Right (Blue/Yellow)', spawn: { row: Math.floor(ROW / 2), col: COL - Math.floor(COL / 6) }, colors: ['#0078ff', '#dcc800'] },
  { name: 'Top (Pink/Orange)', spawn: { row: Math.max(1, Math.floor(ROW / 8)), col: Math.floor(COL / 2) }, colors: ['#ff69b4', '#ff8c00'] },
  { name: 'Bottom (Green/Purple)', spawn: { row: Math.min(ROW - 2, ROW - Math.max(1, Math.floor(ROW / 8))), col: Math.floor(COL / 2) }, colors: ['#00c800', '#800080'] },
];
