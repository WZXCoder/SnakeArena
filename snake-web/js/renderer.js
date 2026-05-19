import {
  WIDTH,
  HEIGHT,
  CELL_W,
  CELL_H,
  BG_COLOR,
  WALL_COLOR,
  FOOD_COLOR,
} from './constants.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  function drawRect(point, color) {
    ctx.fillStyle = color;
    ctx.fillRect(point.col * CELL_W, point.row * CELL_H, CELL_W, CELL_H);
  }

  function clear() {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawWalls(walls) {
    walls.forEach((w) => drawRect(w, WALL_COLOR));
  }

  function drawFood(food) {
    drawRect(food, FOOD_COLOR);
  }

  function drawSnake(head, body, headColor, bodyColor) {
    drawRect(head, headColor);
    body.forEach((seg) => drawRect(seg, bodyColor));
  }

  function drawAlgoLabel(text, head, font = '22px sans-serif') {
    const px = head.col * CELL_W;
    const py = head.row * CELL_H;
    ctx.font = font;
    const w = ctx.measureText(text).width;
    const h = 22;
    let offX = CELL_W + 4;
    if (px + offX + w > WIDTH - 6) offX = -w - 6;
    const tx = Math.max(2, Math.min(WIDTH - w - 2, px + offX));
    const ty = Math.max(2, Math.min(HEIGHT - h - 2, py + Math.max(0, (CELL_H - h) / 2)));
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    ctx.strokeText(text, tx, ty);
    ctx.fillText(text, tx, ty);
  }

  return { ctx, clear, drawRect, drawWalls, drawFood, drawSnake, drawAlgoLabel };
}
