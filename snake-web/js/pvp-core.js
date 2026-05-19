import { Point } from './point.js';
import {
  ROW,
  COL,
  WIDTH,
  HEIGHT,
  CELL_W,
  CELL_H,
  BG_COLOR,
  FOOD_COLOR,
  WALL_COLOR,
  HUD_SCORE_COLOR,
  HUD_INFO_COLOR,
} from './constants.js';
import { turnDir, actionFromTargetDir, stepFromDir, inBounds } from './game-utils.js';
import { GameLikeForAI } from './ai/controllers.js';
import { Button } from './widgets.js';

export class Snake {
  constructor(spawn) {
    this.spawn = spawn.copy();
    this.reset();
  }

  reset() {
    this.head = this.spawn.copy();
    this.body = [];
    this.direct = 'left';
    this.score = 0;
  }

  occupied() {
    const s = new Set([`${this.head.row},${this.head.col}`]);
    for (const p of this.body) s.add(`${p.row},${p.col}`);
    return s;
  }
}

function generateWalls(avoid) {
  const totalCells = ROW * COL;
  const numWalls = Math.floor(totalCells * 0.01);
  const candidates = [];
  for (let r = 0; r < ROW; r++) {
    for (let c = 0; c < COL; c++) {
      if (!avoid.has(`${r},${c}`)) candidates.push([r, c]);
    }
  }
  shuffle(candidates);
  return candidates.slice(0, Math.min(numWalls, candidates.length)).map(([r, c]) => new Point(r, c));
}

function genFood(occupied) {
  const candidates = [];
  for (let r = 0; r < ROW; r++) {
    for (let c = 0; c < COL; c++) {
      if (!occupied.has(`${r},${c}`)) {
        candidates.push(new Point(r, c));
      }
    }
  }
  if (candidates.length === 0) {
    return new Point(Math.floor(ROW / 2), Math.floor(COL / 2));
  }
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export async function runMatch(renderer, options) {
  const {
    modeTitle,
    snake1Colors = ['#ff0000', '#00b400'],
    snake2Colors = ['#0078ff', '#dcc800'],
    snake2Ai = null,
    onExit,
    keys,
  } = options;

  const exitBtn = new Button(
    { x: WIDTH - 120, y: 10, w: 110, h: 36 },
    'Exit',
    { font: '26px sans-serif', bg: '#c83c3c', hoverBg: '#dc5050', border: '#fff', radius: 8 },
  );

  const s1 = new Snake(new Point(Math.floor(ROW / 2), Math.floor(COL / 6)));
  const s2 = new Snake(new Point(Math.floor(ROW / 2), COL - Math.floor(COL / 6)));

  let matchP1 = 0;
  let matchP2 = 0;
  let walls = [];
  let food = new Point(0, 0);
  let targetDir1 = 'left';
  let targetDir2 = 'left';

  const roundReset = () => {
    const avoid = new Set([...s1.occupied(), ...s2.occupied()]);
    walls = generateWalls(avoid);
    const occ = new Set(avoid);
    for (const w of walls) occ.add(`${w.row},${w.col}`);
    food = genFood(occ);
  };

  const occupiedAll = () => {
    const occ = new Set([...s1.occupied(), ...s2.occupied()]);
    for (const w of walls) occ.add(`${w.row},${w.col}`);
    return occ;
  };

  roundReset();

  for (let roundIdx = 1; roundIdx <= 3; roundIdx++) {
    s1.reset();
    s2.reset();
    roundReset();
    targetDir1 = s1.direct;
    targetDir2 = s2.direct;

    let startTime = performance.now();
    let roundOver = false;

    while (!roundOver) {
      const now = performance.now();
      const elapsedS = (now - startTime) / 1000;
      const timeLeft = Math.max(0, 30 - elapsedS);
      if (timeLeft <= 0) roundOver = true;

      await keys.pump();
      if (keys.quit) {
        onExit?.();
        return;
      }
      if (exitBtn.contains(keys.mouseX, keys.mouseY) && keys.consumeClick()) {
        onExit?.();
        return;
      }

      const touchDir1 = keys.consumeVirtualDirection('p1');
      if (touchDir1) targetDir1 = touchDir1;
      else if (keys.isKey('w')) targetDir1 = 'up';
      else if (keys.isKey('s')) targetDir1 = 'down';
      else if (keys.isKey('a')) targetDir1 = 'left';
      else if (keys.isKey('d')) targetDir1 = 'right';
      if (!snake2Ai) {
        const touchDir2 = keys.consumeVirtualDirection('p2');
        if (touchDir2) targetDir2 = touchDir2;
        else if (keys.isArrowUp()) targetDir2 = 'up';
        else if (keys.isArrowDown()) targetDir2 = 'down';
        else if (keys.isArrowLeft()) targetDir2 = 'left';
        else if (keys.isArrowRight()) targetDir2 = 'right';
      }

      const a1 = actionFromTargetDir(s1.direct, targetDir1);
      let a2;
      if (!snake2Ai) {
        a2 = actionFromTargetDir(s2.direct, targetDir2);
      } else {
        const gl = new GameLikeForAI(s2.head, s2.direct, food, walls, s2.body, s1.occupied());
        a2 = await snake2Ai.nextAction(gl);
      }

      s1.direct = turnDir(s1.direct, a1);
      s2.direct = turnDir(s2.direct, a2);

      const next1 = stepFromDir(s1.head, s1.direct);
      const next2 = stepFromDir(s2.head, s2.direct);

      const s1OccBody = new Set(s1.body.map((p) => `${p.row},${p.col}`));
      const s2OccBody = new Set(s2.body.map((p) => `${p.row},${p.col}`));
      const wallOcc = new Set(walls.map((w) => `${w.row},${w.col}`));

      const wouldDie = (nextHead, selfBody, otherOcc) => {
        if (!inBounds(nextHead, ROW, COL)) return true;
        const k = `${nextHead.row},${nextHead.col}`;
        if (wallOcc.has(k)) return true;
        if (selfBody.has(k)) return true;
        if (otherOcc.has(k)) return true;
        return false;
      };

      let s1Die = wouldDie(next1, s1OccBody, s2.occupied());
      let s2Die = wouldDie(next2, s2OccBody, s1.occupied());

      if (next1.row === next2.row && next1.col === next2.col) {
        s1Die = true;
        s2Die = true;
      }

      if (s1Die) {
        s1.reset();
        targetDir1 = s1.direct;
      } else {
        s1.body.unshift(s1.head.copy());
        s1.head = next1;
      }

      if (s2Die) {
        s2.reset();
        targetDir2 = s2.direct;
      } else {
        s2.body.unshift(s2.head.copy());
        s2.head = next2;
      }

      const ate1 = !s1Die && s1.head.equals(food);
      const ate2 = !s2Die && s2.head.equals(food);

      if (ate1) s1.score += 1;
      else if (!s1Die && s1.body.length) s1.body.pop();

      if (ate2) s2.score += 1;
      else if (!s2Die && s2.body.length) s2.body.pop();

      if (ate1 || ate2) food = genFood(occupiedAll());

      drawMatchFrame(renderer, renderer.ctx, {
        walls,
        food,
        s1,
        s2,
        snake1Colors,
        snake2Colors,
        modeTitle,
        roundIdx,
        timeLeft,
        matchP1,
        matchP2,
        exitBtn,
        keys,
      });

      await delay(1000 / 15);
    }

    if (s1.score > s2.score) matchP1 += 1;
    else if (s2.score > s1.score) matchP2 += 1;
    else {
      matchP1 += 1;
      matchP2 += 1;
    }

    const pauseEnd = performance.now() + 3000;
    while (performance.now() < pauseEnd) {
      await keys.pump();
      if (keys.quit || (exitBtn.contains(keys.mouseX, keys.mouseY) && keys.consumeClick())) {
        onExit?.();
        return;
      }
      renderer.clear();
      const pauseCtx = renderer.ctx;
      pauseCtx.fillStyle = HUD_SCORE_COLOR;
      pauseCtx.font = '40px sans-serif';
      pauseCtx.textAlign = 'center';
      pauseCtx.fillText(
        `Round ${roundIdx} Over  |  Match ${matchP1}-${matchP2}`,
        WIDTH / 2,
        HEIGHT / 2,
      );
      exitBtn.setHovered(exitBtn.contains(keys.mouseX, keys.mouseY));
      exitBtn.draw(pauseCtx);
      await delay(1000 / 30);
    }
  }
}

export async function runAiBrawlMatch(renderer, options) {
  const { modeTitle, participants, onExit, keys } = options;
  const n = participants.length;
  const snakes = participants.map(([spawn]) => new Snake(spawn));
  const colors = participants.map(([, c]) => c);
  const labels = participants.map(([, , lab]) => lab);
  const controllers = participants.map(([, , , ctl]) => ctl);
  const matchScores = new Array(n).fill(0);

  let walls = [];
  let food = new Point(0, 0);

  const exitBtn = new Button(
    { x: WIDTH - 120, y: 10, w: 110, h: 36 },
    'Exit',
    { font: '22px sans-serif', bg: '#c83c3c', hoverBg: '#dc5050', border: '#fff', radius: 8 },
  );

  const roundReset = () => {
    const avoid = new Set();
    for (const s of snakes) {
      for (const k of s.occupied()) avoid.add(k);
    }
    walls = generateWalls(avoid);
    const occ = new Set(avoid);
    for (const w of walls) occ.add(`${w.row},${w.col}`);
    food = genFood(occ);
  };

  const occupiedAll = () => {
    const occ = new Set();
    for (const s of snakes) {
      for (const k of s.occupied()) occ.add(k);
    }
    for (const w of walls) occ.add(`${w.row},${w.col}`);
    return occ;
  };

  roundReset();

  for (let roundIdx = 1; roundIdx <= 3; roundIdx++) {
    for (const s of snakes) s.reset();
    roundReset();

    let startTime = performance.now();
    let roundOver = false;

    while (!roundOver) {
      const now = performance.now();
      const timeLeft = Math.max(0, 30 - (now - startTime) / 1000);
      if (timeLeft <= 0) roundOver = true;

      await keys.pump();
      if (keys.quit || (exitBtn.contains(keys.mouseX, keys.mouseY) && keys.consumeClick())) {
        onExit?.();
        return;
      }

      const actions = [];
      for (let i = 0; i < n; i++) {
        const opp = new Set();
        for (let j = 0; j < n; j++) {
          if (j !== i) {
            for (const k of snakes[j].occupied()) opp.add(k);
          }
        }
        const gl = new GameLikeForAI(
          snakes[i].head,
          snakes[i].direct,
          food,
          walls,
          snakes[i].body,
          opp,
        );
        actions.push(await controllers[i].nextAction(gl));
      }

      for (let i = 0; i < n; i++) {
        snakes[i].direct = turnDir(snakes[i].direct, actions[i]);
      }

      const nextHeads = snakes.map((s, i) => stepFromDir(s.head, s.direct));
      const wallOcc = new Set(walls.map((w) => `${w.row},${w.col}`));
      const die = new Array(n).fill(false);

      for (let i = 0; i < n; i++) {
        const selfBody = new Set(snakes[i].body.map((p) => `${p.row},${p.col}`));
        const other = new Set();
        for (let j = 0; j < n; j++) {
          if (j !== i) {
            for (const k of snakes[j].occupied()) other.add(k);
          }
        }
        const nh = nextHeads[i];
        if (
          !inBounds(nh, ROW, COL) ||
          wallOcc.has(`${nh.row},${nh.col}`) ||
          selfBody.has(`${nh.row},${nh.col}`) ||
          other.has(`${nh.row},${nh.col}`)
        ) {
          die[i] = true;
        }
      }

      const cellTo = new Map();
      for (let i = 0; i < n; i++) {
        const key = `${nextHeads[i].row},${nextHeads[i].col}`;
        if (!cellTo.has(key)) cellTo.set(key, []);
        cellTo.get(key).push(i);
      }
      for (const idxs of cellTo.values()) {
        if (idxs.length >= 2) {
          for (const i of idxs) die[i] = true;
        }
      }

      for (let i = 0; i < n; i++) {
        if (die[i]) snakes[i].reset();
        else {
          snakes[i].body.unshift(snakes[i].head.copy());
          snakes[i].head = nextHeads[i];
        }
      }

      let ateAny = false;
      for (let i = 0; i < n; i++) {
        if (die[i]) continue;
        if (snakes[i].head.equals(food)) {
          snakes[i].score += 1;
          ateAny = true;
        } else if (snakes[i].body.length) {
          snakes[i].body.pop();
        }
      }
      if (ateAny) food = genFood(occupiedAll());

      renderer.clear();
      renderer.drawWalls(walls);
      renderer.drawFood(food);
      for (let i = 0; i < n; i++) {
        renderer.drawSnake(snakes[i].head, snakes[i].body, colors[i][0], colors[i][1]);
        renderer.drawAlgoLabel(labels[i], snakes[i].head);
      }

      const brawlCtx = renderer.ctx;
      brawlCtx.fillStyle = HUD_INFO_COLOR;
      brawlCtx.font = '22px sans-serif';
      brawlCtx.textAlign = 'left';
      brawlCtx.textBaseline = 'top';
      brawlCtx.fillText(
        `${modeTitle}  Round ${roundIdx}/3  Time ${timeLeft.toFixed(1)}s`,
        10,
        6,
      );

      const scoreParts = labels.map((lab, j) => `${lab.slice(0, 8)}:${snakes[j].score}`);
      brawlCtx.fillStyle = HUD_SCORE_COLOR;
      brawlCtx.font = '40px sans-serif';
      brawlCtx.textAlign = 'center';
      brawlCtx.textBaseline = 'top';
      brawlCtx.fillText(scoreParts.join('  '), WIDTH / 2, 30);

      const matchParts = labels.map((lab, j) => `${lab.slice(0, 6)}:${matchScores[j]}`);
      brawlCtx.font = '22px sans-serif';
      brawlCtx.textAlign = 'left';
      brawlCtx.fillStyle = HUD_INFO_COLOR;
      brawlCtx.textBaseline = 'top';
      brawlCtx.fillText(`Match  ${matchParts.join('  ')}`, 10, 30);

      exitBtn.setHovered(exitBtn.contains(keys.mouseX, keys.mouseY));
      exitBtn.draw(brawlCtx);

      await delay(1000 / 15);
    }

    const scores = snakes.map((s) => s.score);
    const mx = Math.max(...scores);
    const winners = scores.map((v, i) => (v === mx ? i : -1)).filter((i) => i >= 0);
    if (winners.length === 1) matchScores[winners[0]] += 1;
    else winners.forEach((i) => (matchScores[i] += 1));

    const pauseEnd = performance.now() + 3000;
    while (performance.now() < pauseEnd) {
      await keys.pump();
      if (keys.quit || (exitBtn.contains(keys.mouseX, keys.mouseY) && keys.consumeClick())) {
        onExit?.();
        return;
      }
      renderer.clear();
      const pauseCtx2 = renderer.ctx;
      let msg = `Round ${roundIdx} Over  |  Match: ${labels.map((l, i) => `${l}:${matchScores[i]}`).join(' ')}`;
      pauseCtx2.fillStyle = HUD_SCORE_COLOR;
      pauseCtx2.font = msg.length > 80 ? '22px sans-serif' : '40px sans-serif';
      pauseCtx2.textAlign = 'center';
      if (pauseCtx2.measureText(msg).width > WIDTH - 20) {
        msg = `Round ${roundIdx} Over  |  Match ${matchScores.join('-')}`;
      }
      pauseCtx2.fillText(msg, WIDTH / 2, HEIGHT / 2);
      exitBtn.draw(pauseCtx2);
      await delay(1000 / 30);
    }
  }
}

function drawMatchFrame(renderer, ctx, data) {
  const {
    walls,
    food,
    s1,
    s2,
    snake1Colors,
    snake2Colors,
    modeTitle,
    roundIdx,
    timeLeft,
    matchP1,
    matchP2,
    exitBtn,
    keys,
  } = data;

  renderer.clear();
  renderer.drawWalls(walls);
  renderer.drawFood(food);
  renderer.drawSnake(s1.head, s1.body, snake1Colors[0], snake1Colors[1]);
  renderer.drawSnake(s2.head, s2.body, snake2Colors[0], snake2Colors[1]);

  ctx.fillStyle = HUD_INFO_COLOR;
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${modeTitle}  Round ${roundIdx}/3  Time ${timeLeft.toFixed(1)}s`, 10, 6);

  ctx.fillStyle = HUD_SCORE_COLOR;
  ctx.font = '40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`P1 ${s1.score} : ${s2.score} P2`, WIDTH / 2, 30);

  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = HUD_INFO_COLOR;
  ctx.textBaseline = 'top';
  ctx.fillText(`Match  P1 ${matchP1} - ${matchP2} P2`, 10, 30);

  exitBtn.setHovered(exitBtn.contains(keys.mouseX, keys.mouseY));
  exitBtn.draw(ctx);
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function setPvpCtx() {
  /* 保留 API 兼容 */
}
