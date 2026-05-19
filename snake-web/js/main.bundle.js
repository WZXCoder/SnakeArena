(() => {
  // js/constants.js
  var WIDTH = 1200;
  var HEIGHT = 600;
  var ROW = 30;
  var COL = 60;
  var CELL_W = Math.floor(WIDTH / COL);
  var CELL_H = Math.floor(HEIGHT / ROW);
  var BG_COLOR = "#ffffff";
  var SNAKE_BODY_COLOR = "#00ff00";
  var SNAKE_HEAD_COLOR = "#ff0000";
  var FOOD_COLOR = "#ffa500";
  var WALL_COLOR = "#000000";
  var BASE_SPEED = 10;
  var SPEED_INCREASE = 5;
  var MAX_SPEED = 30;
  var HUD_SCORE_COLOR = "#ffc800";
  var HUD_INFO_COLOR = "#00b4dc";
  var DIRS = ["right", "down", "left", "up"];
  var ALGOS = [
    "DQN",
    "DDQN",
    "DuelingDQN",
    "PPO",
    "TRPO",
    "A2C",
    "APF",
    "Ax",
    "BFS",
    "Dijkstra",
    "DWA",
    "RRT",
    "RRTx"
  ];
  var SNAKE_PRESETS = [
    { name: "Left (Red/Green)", spawn: { row: Math.floor(ROW / 2), col: Math.floor(COL / 6) }, colors: ["#ff0000", "#00b400"] },
    { name: "Right (Blue/Yellow)", spawn: { row: Math.floor(ROW / 2), col: COL - Math.floor(COL / 6) }, colors: ["#0078ff", "#dcc800"] },
    { name: "Top (Pink/Orange)", spawn: { row: Math.max(1, Math.floor(ROW / 8)), col: Math.floor(COL / 2) }, colors: ["#ff69b4", "#ff8c00"] },
    { name: "Bottom (Green/Purple)", spawn: { row: Math.min(ROW - 2, ROW - Math.max(1, Math.floor(ROW / 8))), col: Math.floor(COL / 2) }, colors: ["#00c800", "#800080"] }
  ];

  // js/renderer.js
  function createRenderer(canvas2) {
    const ctx2 = canvas2.getContext("2d");
    canvas2.width = WIDTH;
    canvas2.height = HEIGHT;
    function drawRect(point, color) {
      ctx2.fillStyle = color;
      ctx2.fillRect(point.col * CELL_W, point.row * CELL_H, CELL_W, CELL_H);
    }
    function clear() {
      ctx2.fillStyle = BG_COLOR;
      ctx2.fillRect(0, 0, WIDTH, HEIGHT);
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
    function drawAlgoLabel(text, head, font = "22px sans-serif") {
      const px = head.col * CELL_W;
      const py = head.row * CELL_H;
      ctx2.font = font;
      const w = ctx2.measureText(text).width;
      const h = 22;
      let offX = CELL_W + 4;
      if (px + offX + w > WIDTH - 6) offX = -w - 6;
      const tx = Math.max(2, Math.min(WIDTH - w - 2, px + offX));
      const ty = Math.max(2, Math.min(HEIGHT - h - 2, py + Math.max(0, (CELL_H - h) / 2)));
      ctx2.lineWidth = 1;
      ctx2.strokeStyle = "#000";
      ctx2.fillStyle = "#fff";
      ctx2.strokeText(text, tx, ty);
      ctx2.fillText(text, tx, ty);
    }
    return { ctx: ctx2, clear, drawRect, drawWalls, drawFood, drawSnake, drawAlgoLabel };
  }

  // js/input.js
  function createInputHandler(canvas2) {
    const state = {
      quit: false,
      mouseX: 0,
      mouseY: 0,
      keysDown: /* @__PURE__ */ new Set(),
      codesDown: /* @__PURE__ */ new Set(),
      virtualDirs: { p1: null, p2: null },
      _clicked: false
    };
    const rect = () => canvas2.getBoundingClientRect();
    const validDirs = /* @__PURE__ */ new Set(["up", "down", "left", "right"]);
    const queueVirtualDirection = (player, direction) => {
      if (!["p1", "p2"].includes(player) || !validDirs.has(direction)) return;
      state.virtualDirs[player] = direction;
    };
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") state.quit = true;
      state.keysDown.add(e.key.toLowerCase());
      state.codesDown.add(e.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      state.keysDown.delete(e.key.toLowerCase());
      state.codesDown.delete(e.code);
    });
    canvas2.addEventListener("mousemove", (e) => {
      const r = rect();
      const scaleX = canvas2.width / r.width;
      const scaleY = canvas2.height / r.height;
      state.mouseX = (e.clientX - r.left) * scaleX;
      state.mouseY = (e.clientY - r.top) * scaleY;
    });
    canvas2.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        state._clicked = true;
      }
    });
    document.getElementById("mobile-controls")?.addEventListener("pointerdown", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const btn = target?.closest("[data-touch-player][data-touch-dir]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      queueVirtualDirection(btn.getAttribute("data-touch-player"), btn.getAttribute("data-touch-dir"));
      canvas2.focus();
    });
    return {
      get quit() {
        return state.quit;
      },
      set quit(v) {
        state.quit = v;
      },
      get mouseX() {
        return state.mouseX;
      },
      get mouseY() {
        return state.mouseY;
      },
      consumeClick() {
        if (state._clicked) {
          state._clicked = false;
          return true;
        }
        return false;
      },
      consumeVirtualDirection(player = "p1") {
        const direction = state.virtualDirs[player] || null;
        state.virtualDirs[player] = null;
        return direction;
      },
      /** 支持 'ArrowUp' / 'arrowup' / 'w' */
      isKey(...keys2) {
        return keys2.some((k) => {
          if (k.startsWith("Arrow")) return state.codesDown.has(k);
          const lk = k.toLowerCase();
          return state.keysDown.has(lk) || state.codesDown.has(k);
        });
      },
      isArrowUp() {
        return state.codesDown.has("ArrowUp");
      },
      isArrowDown() {
        return state.codesDown.has("ArrowDown");
      },
      isArrowLeft() {
        return state.codesDown.has("ArrowLeft");
      },
      isArrowRight() {
        return state.codesDown.has("ArrowRight");
      },
      resetQuit() {
        state.quit = false;
      },
      async pump() {
        await new Promise(requestAnimationFrame);
      },
      clearKeys() {
        state.keysDown.clear();
        state.codesDown.clear();
        state.virtualDirs.p1 = null;
        state.virtualDirs.p2 = null;
      }
    };
  }

  // js/screens/menu-dom.js
  var mainMenu = () => document.getElementById("main-menu");
  var algoMenu = () => document.getElementById("algo-menu");
  var countMenu = () => document.getElementById("count-menu");
  var algoGrid = () => document.getElementById("algo-grid");
  var algoTitle = () => document.getElementById("algo-menu-title");
  var algoSub = () => document.getElementById("algo-menu-sub");
  function hideAll() {
    var _a, _b, _c;
    (_a = mainMenu()) == null ? void 0 : _a.classList.add("hidden");
    (_b = algoMenu()) == null ? void 0 : _b.classList.add("hidden");
    (_c = countMenu()) == null ? void 0 : _c.classList.add("hidden");
  }
  function showMainMenu() {
    var _a;
    hideAll();
    (_a = mainMenu()) == null ? void 0 : _a.classList.remove("hidden");
  }
  function hideAllMenus() {
    hideAll();
  }
  function waitSnakeCountChoice() {
    var _a;
    hideAll();
    (_a = countMenu()) == null ? void 0 : _a.classList.remove("hidden");
    return new Promise((resolve) => {
      const menu = countMenu();
      const backBtn = document.getElementById("count-back");
      if (!menu) {
        resolve(null);
        return;
      }
      const onPick = (e) => {
        const target = e.target instanceof Element ? e.target : null;
        const btn = target == null ? void 0 : target.closest("[data-count]");
        if (!btn) return;
        e.preventDefault();
        cleanup();
        resolve(parseInt(btn.getAttribute("data-count"), 10));
      };
      const onBack = (e) => {
        e.preventDefault();
        cleanup();
        resolve(null);
      };
      const cleanup = () => {
        menu.removeEventListener("click", onPick);
        backBtn == null ? void 0 : backBtn.removeEventListener("click", onBack);
      };
      menu.addEventListener("click", onPick);
      backBtn == null ? void 0 : backBtn.addEventListener("click", onBack);
    });
  }
  function waitAlgorithmChoice(title, subtitle = null) {
    hideAll();
    const menu = algoMenu();
    menu == null ? void 0 : menu.classList.remove("hidden");
    if (algoTitle()) algoTitle().textContent = title;
    const subEl = algoSub();
    if (subtitle) {
      subEl.textContent = subtitle;
      subEl.classList.remove("hidden");
    } else {
      subEl == null ? void 0 : subEl.classList.add("hidden");
    }
    const grid = algoGrid();
    if (grid) {
      grid.innerHTML = "";
      ALGOS.forEach((name) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "menu-btn";
        btn.textContent = name;
        btn.dataset.algo = name;
        grid.appendChild(btn);
      });
    }
    return new Promise((resolve) => {
      const backBtn = document.getElementById("algo-back");
      if (!menu || !grid) {
        resolve(null);
        return;
      }
      const onPick = (e) => {
        const target = e.target instanceof Element ? e.target : null;
        const btn = target == null ? void 0 : target.closest("[data-algo]");
        if (!btn) return;
        e.preventDefault();
        cleanup();
        resolve(btn.getAttribute("data-algo"));
      };
      const onBack = (e) => {
        e.preventDefault();
        cleanup();
        resolve(null);
      };
      const cleanup = () => {
        grid.removeEventListener("click", onPick);
        backBtn == null ? void 0 : backBtn.removeEventListener("click", onBack);
      };
      grid.addEventListener("click", onPick);
      backBtn == null ? void 0 : backBtn.addEventListener("click", onBack);
    });
  }

  // js/point.js
  var Point = class _Point {
    constructor(row, col) {
      this.row = row;
      this.col = col;
    }
    copy() {
      return new _Point(this.row, this.col);
    }
    equals(other) {
      return this.row === other.row && this.col === other.col;
    }
  };

  // js/game-utils.js
  function turnDir(currentDir, action) {
    const idx = DIRS.indexOf(currentDir);
    if (action[1] === 1) return DIRS[(idx + 1) % 4];
    if (action[2] === 1) return DIRS[(idx + 3) % 4];
    return currentDir;
  }
  function actionFromTargetDir(currentDir, targetDir) {
    const idx = DIRS.indexOf(currentDir);
    if (targetDir === currentDir) return [1, 0, 0];
    if (targetDir === DIRS[(idx + 1) % 4]) return [0, 1, 0];
    if (targetDir === DIRS[(idx + 3) % 4]) return [0, 0, 1];
    return [1, 0, 0];
  }
  function stepFromDir(head, direct) {
    const p = head.copy();
    if (direct === "left") p.col -= 1;
    else if (direct === "right") p.col += 1;
    else if (direct === "up") p.row -= 1;
    else if (direct === "down") p.row += 1;
    return p;
  }
  function inBounds(pt, ROW2, COL2) {
    return pt.row >= 0 && pt.row < ROW2 && pt.col >= 0 && pt.col < COL2;
  }
  function dirFromDelta(dr, dc) {
    if (dr === -1 && dc === 0) return "up";
    if (dr === 1 && dc === 0) return "down";
    if (dr === 0 && dc === -1) return "left";
    if (dr === 0 && dc === 1) return "right";
    return "left";
  }

  // js/game-env.js
  var SnakeGameAI = class {
    constructor() {
      this.reset();
      this.frameIteration = 0;
      this._lastStepTime = 0;
    }
    reset() {
      this.head = new Point(Math.floor(ROW / 2), Math.floor(COL / 2));
      this.snakes = [];
      this.score = 0;
      this.direct = "left";
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
      const blocked = /* @__PURE__ */ new Set();
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
      const p = pt != null ? pt : this.head;
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
        BASE_SPEED + Math.floor(this.score / 10) * SPEED_INCREASE
      );
      const interval = 1e3 / speed;
      if (this._lastStepTime && nowMs - this._lastStepTime < interval) {
        return { reward: 0, gameOver: false, score: this.score, stepped: false };
      }
      this._lastStepTime = nowMs;
      this.frameIteration += 1;
      this.snakes.unshift(this.head.copy());
      this.direct = turnDir(this.direct, action);
      if (this.direct === "left") this.head.col -= 1;
      else if (this.direct === "right") this.head.col += 1;
      else if (this.direct === "up") this.head.row -= 1;
      else if (this.direct === "down") this.head.row += 1;
      let reward = 0;
      let gameOver = false;
      if (this.isCollision() || this.frameIteration > 100 * this.snakes.length + 100) {
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
  };
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // js/high-score.js
  var STORAGE_KEY = "snake_high_score";
  function loadHighScore() {
    try {
      const txt = localStorage.getItem(STORAGE_KEY);
      if (!txt) return 0;
      const n = parseInt(txt, 10);
      return Number.isNaN(n) ? 0 : n;
    } catch {
      return 0;
    }
  }
  function saveHighScore(score) {
    localStorage.setItem(STORAGE_KEY, String(Math.floor(score)));
  }
  function updateHighScoreIfNeeded(score) {
    const current = loadHighScore();
    if (score > current) {
      saveHighScore(score);
      return score;
    }
    return current;
  }

  // js/widgets.js
  var Button = class {
    constructor(rect, text, options = {}) {
      var _a, _b, _c, _d, _e, _f, _g;
      this.rect = rect;
      this.text = text;
      this.bg = (_a = options.bg) != null ? _a : "#1e1e1e";
      this.fg = (_b = options.fg) != null ? _b : "#ffffff";
      this.hoverBg = (_c = options.hoverBg) != null ? _c : "#3c3c3c";
      this.border = (_d = options.border) != null ? _d : "#ffffff";
      this.borderWidth = (_e = options.borderWidth) != null ? _e : 2;
      this.radius = (_f = options.radius) != null ? _f : 10;
      this.font = (_g = options.font) != null ? _g : "36px sans-serif";
      this._hovered = false;
    }
    contains(x, y) {
      const { x: rx, y: ry, w, h } = this.rect;
      return x >= rx && x <= rx + w && y >= ry && y <= ry + h;
    }
    setHovered(hovered) {
      this._hovered = hovered;
    }
    draw(ctx2) {
      const { x, y, w, h } = this.rect;
      const bg = this._hovered ? this.hoverBg : this.bg;
      ctx2.save();
      ctx2.fillStyle = bg;
      roundRect(ctx2, x, y, w, h, this.radius);
      ctx2.fill();
      if (this.borderWidth > 0) {
        ctx2.strokeStyle = this.border;
        ctx2.lineWidth = this.borderWidth;
        roundRect(ctx2, x, y, w, h, this.radius);
        ctx2.stroke();
      }
      ctx2.fillStyle = this.fg;
      ctx2.font = this.font;
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillText(this.text, x + w / 2, y + h / 2);
      ctx2.restore();
    }
  };
  function roundRect(ctx2, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx2.beginPath();
    ctx2.moveTo(x + radius, y);
    ctx2.arcTo(x + w, y, x + w, y + h, radius);
    ctx2.arcTo(x + w, y + h, x, y + h, radius);
    ctx2.arcTo(x, y + h, x, y, radius);
    ctx2.arcTo(x, y, x + w, y, radius);
    ctx2.closePath();
  }

  // js/screens/single-player.js
  async function runSinglePlayer(ctx2, renderer2, keys2, onExit) {
    const exitBtn = new Button(
      { x: WIDTH - 120, y: 10, w: 110, h: 36 },
      "Exit",
      { font: "26px sans-serif", bg: "#c83c3c", hoverBg: "#dc5050", border: "#fff", radius: 8 }
    );
    const restartBtn = new Button(
      { x: WIDTH / 2 - 170, y: 340, w: 160, h: 56 },
      "Restart",
      { font: "30px sans-serif", bg: "#1d7a30", hoverBg: "#2a9640", border: "#fff", radius: 10 }
    );
    const gameOverExitBtn = new Button(
      { x: WIDTH / 2 + 10, y: 340, w: 160, h: 56 },
      "Exit",
      { font: "30px sans-serif", bg: "#c83c3c", hoverBg: "#dc5050", border: "#fff", radius: 10 }
    );
    const game = new SnakeGameAI();
    game.reset();
    let targetDir = game.direct;
    let best = loadHighScore();
    let isGameOver = false;
    let finalScore = 0;
    while (true) {
      await keys2.pump();
      if (keys2.quit) {
        await onExit();
        return;
      }
      if (!isGameOver && exitBtn.contains(keys2.mouseX, keys2.mouseY) && keys2.consumeClick()) {
        await onExit();
        return;
      }
      let stepped = false;
      if (!isGameOver) {
        const touchDir = keys2.consumeVirtualDirection("p1");
        if (touchDir) targetDir = touchDir;
        else if (keys2.isArrowUp()) targetDir = "up";
        else if (keys2.isArrowDown()) targetDir = "down";
        else if (keys2.isArrowLeft()) targetDir = "left";
        else if (keys2.isArrowRight()) targetDir = "right";
        const action = actionFromTargetDir(game.direct, targetDir);
        const stepResult = game.playStep(action, performance.now());
        stepped = stepResult.stepped;
        if (stepResult.gameOver) {
          finalScore = game.score;
          best = updateHighScoreIfNeeded(finalScore);
          isGameOver = true;
        }
      } else {
        const restartHovered = restartBtn.contains(keys2.mouseX, keys2.mouseY);
        const exitHovered = gameOverExitBtn.contains(keys2.mouseX, keys2.mouseY);
        restartBtn.setHovered(restartHovered);
        gameOverExitBtn.setHovered(exitHovered);
        if (keys2.consumeClick()) {
          if (restartHovered) {
            game.reset();
            targetDir = game.direct;
            finalScore = 0;
            isGameOver = false;
          } else if (exitHovered) {
            await onExit();
            return;
          }
        }
      }
      renderer2.clear();
      renderer2.drawWalls(game.walls);
      game.snakes.forEach((seg) => renderer2.drawRect(seg, SNAKE_BODY_COLOR));
      renderer2.drawRect(game.head, SNAKE_HEAD_COLOR);
      renderer2.drawFood(game.food);
      ctx2.fillStyle = HUD_INFO_COLOR;
      ctx2.font = "26px sans-serif";
      ctx2.textAlign = "left";
      ctx2.textBaseline = "top";
      ctx2.fillText(`Best: ${best}`, 10, 6);
      ctx2.fillStyle = HUD_SCORE_COLOR;
      ctx2.font = "36px sans-serif";
      ctx2.textAlign = "center";
      ctx2.textBaseline = "top";
      ctx2.fillText(`Score: ${isGameOver ? finalScore : game.score}`, WIDTH / 2, 6);
      if (!isGameOver) {
        exitBtn.setHovered(exitBtn.contains(keys2.mouseX, keys2.mouseY));
        exitBtn.draw(ctx2);
      } else {
        drawGameOverOverlay(ctx2, finalScore, best);
        restartBtn.draw(ctx2);
        gameOverExitBtn.draw(ctx2);
      }
      if (!stepped) {
        await delay(1e3 / 60);
      }
    }
  }
  function drawGameOverOverlay(ctx2, finalScore, best) {
    ctx2.save();
    ctx2.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx2.fillRect(0, 0, WIDTH, 600);
    ctx2.fillStyle = "#ffffff";
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.font = "64px sans-serif";
    ctx2.fillText("Game Over", WIDTH / 2, 210);
    ctx2.font = "36px sans-serif";
    ctx2.fillText(`Final Score: ${finalScore}`, WIDTH / 2, 270);
    ctx2.font = "28px sans-serif";
    ctx2.fillStyle = HUD_INFO_COLOR;
    ctx2.fillText(`Best: ${best}`, WIDTH / 2, 305);
    ctx2.restore();
  }
  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // js/ai/planning-common.js
  function getActionFromPath(head, nextPoint, currentDirection) {
    const dr = nextPoint.row - head.row;
    const dc = nextPoint.col - head.col;
    let targetDir;
    if (dr === -1 && dc === 0) targetDir = "up";
    else if (dr === 1 && dc === 0) targetDir = "down";
    else if (dr === 0 && dc === -1) targetDir = "left";
    else if (dr === 0 && dc === 1) targetDir = "right";
    else return [1, 0, 0];
    return actionFromTargetDir(currentDirection, targetDir);
  }
  function isCollisionIgnoreTail(game, pt) {
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
  function safeRandomAction(game) {
    const head = game.head;
    const direction = game.direct;
    const idx = DIRS.indexOf(direction);
    const testActions = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    for (const act of testActions) {
      let newDir = direction;
      if (act[1] === 1) newDir = DIRS[(idx + 1) % 4];
      else if (act[2] === 1) newDir = DIRS[(idx + 3) % 4];
      const newHead = head.copy();
      if (newDir === "left") newHead.col -= 1;
      else if (newDir === "right") newHead.col += 1;
      else if (newDir === "up") newHead.row -= 1;
      else if (newDir === "down") newHead.row += 1;
      if (!isCollisionIgnoreTail(game, newHead)) return act;
    }
    return [1, 0, 0];
  }
  var ProxyGame = class {
    constructor(base, opponentOccupied) {
      var _a;
      this.head = base.head;
      this.direct = base.direct;
      this.food = base.food;
      this.snakes = base.snakes;
      this._opp = opponentOccupied != null ? opponentOccupied : /* @__PURE__ */ new Set();
      this.walls = [
        ...base.walls,
        ...[...this._opp].map((key) => {
          const [rStr, cStr] = String(key).split(",");
          const r = Number.parseInt(rStr, 10);
          const c = Number.parseInt(cStr, 10);
          if (Number.isNaN(r) || Number.isNaN(c)) return null;
          return new Point(r, c);
        }).filter(Boolean)
      ];
      this.isCollision = (_a = base.isCollision) == null ? void 0 : _a.bind(base);
    }
  };

  // js/ai/bfs.js
  function neighbors(r, c) {
    return [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1]
    ];
  }
  function bfsNextStep(start, target, blocked) {
    const s = `${start.row},${start.col}`;
    const t = `${target.row},${target.col}`;
    if (blocked.has(t)) return null;
    const queue = [[start.row, start.col]];
    const parent = /* @__PURE__ */ new Map([[s, null]]);
    while (queue.length) {
      const [cr, cc] = queue.shift();
      const key = `${cr},${cc}`;
      if (key === t) break;
      for (const [nr, nc] of neighbors(cr, cc)) {
        if (nr < 0 || nr >= ROW || nc < 0 || nc >= COL) continue;
        const nk = `${nr},${nc}`;
        if (parent.has(nk)) continue;
        if (blocked.has(nk)) continue;
        parent.set(nk, [cr, cc]);
        queue.push([nr, nc]);
      }
    }
    if (!parent.has(t)) return null;
    let cur = [target.row, target.col];
    let prev = parent.get(t);
    while (prev && `${prev[0]},${prev[1]}` !== s) {
      cur = prev;
      prev = parent.get(`${cur[0]},${cur[1]}`);
    }
    return new Point(cur[0], cur[1]);
  }
  function bfsControllerAction(gameLike) {
    const blocked = /* @__PURE__ */ new Set();
    for (const w of gameLike.walls) blocked.add(`${w.row},${w.col}`);
    for (const s of gameLike.snakes) blocked.add(`${s.row},${s.col}`);
    if (gameLike._opp) {
      for (const key of gameLike._opp) {
        const [r, c] = String(key).split(",");
        if (r != null && c != null) blocked.add(`${r},${c}`);
      }
    }
    const nxt = bfsNextStep(gameLike.head, gameLike.food, blocked);
    if (!nxt) return [1, 0, 0];
    const dr = nxt.row - gameLike.head.row;
    const dc = nxt.col - gameLike.head.col;
    return actionFromTargetDir(gameLike.direct, dirFromDelta(dr, dc));
  }

  // js/ai/apf.js
  var K_ATT = 1;
  var K_REP = 10;
  var D0 = 3;
  var INF = Infinity;
  var DIR_VEC = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1]
  };
  function distance(p1, p2) {
    var _a, _b, _c, _d;
    const r1 = (_a = p1.row) != null ? _a : p1[0];
    const c1 = (_b = p1.col) != null ? _b : p1[1];
    const r2 = (_c = p2.row) != null ? _c : p2[0];
    const c2 = (_d = p2.col) != null ? _d : p2[1];
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
  function isSafe(pos, walls, snakes, ROW2, COL2) {
    const [r, c] = pos;
    if (r < 0 || r >= ROW2 || c < 0 || c >= COL2) return false;
    for (const w of walls) {
      if (w.row === r && w.col === c) return false;
    }
    for (const s of snakes) {
      if (s.row === r && s.col === c) return false;
    }
    return true;
  }
  function chooseActionApf(game, ROW2, COL2) {
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
    if (isSafe(frontPos, walls, snakes, ROW2, COL2)) {
      cand.front = totalPotential(frontPos, food, walls, snakes);
    }
    if (isSafe(rightPos, walls, snakes, ROW2, COL2)) {
      cand.right = totalPotential(rightPos, food, walls, snakes);
    }
    if (isSafe(leftPos, walls, snakes, ROW2, COL2)) {
      cand.left = totalPotential(leftPos, food, walls, snakes);
    }
    if (Object.keys(cand).length === 0) return [1, 0, 0];
    let best = Object.keys(cand).reduce((a, b) => cand[a] <= cand[b] ? a : b);
    if (cand.front !== void 0 && cand.front === cand[best]) best = "front";
    if (best === "front") return [1, 0, 0];
    if (best === "right") return [0, 1, 0];
    return [0, 0, 1];
  }

  // js/ai/astar.js
  function astarPath(start, target, walls, snakes, ignoreTail = true) {
    var _a, _b;
    const obstacleSet = /* @__PURE__ */ new Set();
    for (const w of walls) obstacleSet.add(`${w.row},${w.col}`);
    for (const s of snakes) obstacleSet.add(`${s.row},${s.col}`);
    if (ignoreTail && snakes.length > 0) {
      const tail = snakes[snakes.length - 1];
      obstacleSet.delete(`${tail.row},${tail.col}`);
    }
    const targetPos = `${target.row},${target.col}`;
    if (obstacleSet.has(targetPos)) return null;
    const startPos = `${start.row},${start.col}`;
    const heuristic = (r, c) => Math.abs(r - target.row) + Math.abs(c - target.col);
    const pq = [{ f: heuristic(start.row, start.col), g: 0, r: start.row, c: start.col }];
    const gScore = /* @__PURE__ */ new Map([[startPos, 0]]);
    const parent = /* @__PURE__ */ new Map();
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ];
    while (pq.length) {
      pq.sort((a, b) => a.f - b.f);
      const { g: curG, r, c } = pq.shift();
      const key = `${r},${c}`;
      if (curG > ((_a = gScore.get(key)) != null ? _a : Infinity)) continue;
      if (key === targetPos) {
        const path = [];
        let cur = [r, c];
        while (`${cur[0]},${cur[1]}` !== startPos) {
          path.push(new Point(cur[0], cur[1]));
          cur = parent.get(`${cur[0]},${cur[1]}`);
        }
        path.reverse();
        return path;
      }
      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= ROW || nc < 0 || nc >= COL) continue;
        const nk = `${nr},${nc}`;
        if (obstacleSet.has(nk)) continue;
        const newG = curG + 1;
        if (newG < ((_b = gScore.get(nk)) != null ? _b : Infinity)) {
          gScore.set(nk, newG);
          parent.set(nk, [r, c]);
          pq.push({ f: newG + heuristic(nr, nc), g: newG, r: nr, c: nc });
        }
      }
    }
    return null;
  }
  function axControllerAction(proxy) {
    const path = astarPath(proxy.head, proxy.food, proxy.walls, proxy.snakes);
    if (path && path.length > 0) {
      return getActionFromPath(proxy.head, path[0], proxy.direct);
    }
    return safeRandomAction(proxy);
  }

  // js/ai/dijkstra.js
  function dijkstraPath(start, target, walls, snakes) {
    var _a, _b;
    const obstacleSet = /* @__PURE__ */ new Set();
    for (const w of walls) obstacleSet.add(`${w.row},${w.col}`);
    for (const s of snakes) obstacleSet.add(`${s.row},${s.col}`);
    const targetPos = `${target.row},${target.col}`;
    if (obstacleSet.has(targetPos)) return null;
    const startPos = `${start.row},${start.col}`;
    const pq = [{ dist: 0, r: start.row, c: start.col }];
    const dist3 = /* @__PURE__ */ new Map([[startPos, 0]]);
    const parent = /* @__PURE__ */ new Map();
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ];
    while (pq.length) {
      pq.sort((a, b) => a.dist - b.dist);
      const { dist: curDist, r, c } = pq.shift();
      const key = `${r},${c}`;
      if (curDist > ((_a = dist3.get(key)) != null ? _a : Infinity)) continue;
      if (key === targetPos) {
        const path = [];
        let cur = [r, c];
        while (`${cur[0]},${cur[1]}` !== startPos) {
          path.push(new Point(cur[0], cur[1]));
          cur = parent.get(`${cur[0]},${cur[1]}`);
        }
        path.reverse();
        return path;
      }
      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= ROW || nc < 0 || nc >= COL) continue;
        const nk = `${nr},${nc}`;
        if (obstacleSet.has(nk)) continue;
        const newDist = curDist + 1;
        if (newDist < ((_b = dist3.get(nk)) != null ? _b : Infinity)) {
          dist3.set(nk, newDist);
          parent.set(nk, [r, c]);
          pq.push({ dist: newDist, r: nr, c: nc });
        }
      }
    }
    return null;
  }
  function dijkstraControllerAction(proxy) {
    const path = dijkstraPath(proxy.head, proxy.food, proxy.walls, proxy.snakes);
    if (path && path.length > 0) {
      return getActionFromPath(proxy.head, path[0], proxy.direct);
    }
    return safeRandomAction(proxy);
  }

  // js/ai/rrt.js
  function dist(p1, p2) {
    return Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
  }
  function gridNeighbors(row, col) {
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ];
    const result = [];
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < ROW && nc >= 0 && nc < COL) result.push([nr, nc]);
    }
    return result;
  }
  function rrtPath(start, target, walls, snakes, maxIter = 1500, goalSampleRate = 0.1) {
    const obstacleSet = /* @__PURE__ */ new Set();
    for (const w of walls) obstacleSet.add(`${w.row},${w.col}`);
    for (const s of snakes) obstacleSet.add(`${s.row},${s.col}`);
    const startPos = [start.row, start.col];
    const targetPos = [target.row, target.col];
    if (obstacleSet.has(`${startPos[0]},${startPos[1]}`) || obstacleSet.has(`${targetPos[0]},${targetPos[1]}`)) {
      return null;
    }
    const nodes = [{ row: startPos[0], col: startPos[1], parent: null }];
    const treePositions = /* @__PURE__ */ new Set([`${startPos[0]},${startPos[1]}`]);
    for (let i = 0; i < maxIter; i++) {
      const sample = Math.random() < goalSampleRate ? targetPos : [Math.floor(Math.random() * ROW), Math.floor(Math.random() * COL)];
      if (obstacleSet.has(`${sample[0]},${sample[1]}`)) continue;
      let nearest = nodes[0];
      let bestD = dist([nearest.row, nearest.col], sample);
      for (const n of nodes) {
        const d = dist([n.row, n.col], sample);
        if (d < bestD) {
          bestD = d;
          nearest = n;
        }
      }
      const candidates = [];
      for (const [nr, nc] of gridNeighbors(nearest.row, nearest.col)) {
        const nk = `${nr},${nc}`;
        if (obstacleSet.has(nk)) continue;
        if (treePositions.has(nk)) continue;
        candidates.push([nr, nc]);
      }
      if (!candidates.length) continue;
      let newPos = candidates[0];
      let minD = dist(newPos, sample);
      for (const p of candidates) {
        const d = dist(p, sample);
        if (d < minD) {
          minD = d;
          newPos = p;
        }
      }
      const newNode = { row: newPos[0], col: newPos[1], parent: nearest };
      nodes.push(newNode);
      treePositions.add(`${newPos[0]},${newPos[1]}`);
      if (newPos[0] === targetPos[0] && newPos[1] === targetPos[1]) {
        const path = [];
        let cur = newNode;
        while (cur.parent) {
          path.push(new Point(cur.row, cur.col));
          cur = cur.parent;
        }
        path.reverse();
        return path;
      }
    }
    return null;
  }
  function rrtControllerAction(proxy) {
    const path = rrtPath(proxy.head, proxy.food, proxy.walls, proxy.snakes);
    if (path && path.length > 0) {
      return getActionFromPath(proxy.head, path[0], proxy.direct);
    }
    return safeRandomAction(proxy);
  }

  // js/ai/rrtx.js
  function dist2(p1, p2) {
    return Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
  }
  function gridNeighbors2(row, col) {
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ];
    const result = [];
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < ROW && nc >= 0 && nc < COL) result.push([nr, nc]);
    }
    return result;
  }
  function propagateCost(node, allNodes) {
    const queue = [node];
    while (queue.length) {
      const cur = queue.shift();
      cur.cost = cur.parent ? cur.parent.cost + 1 : 0;
      for (const n of allNodes) {
        if (n.parent === cur) queue.push(n);
      }
    }
  }
  function rrtStarPath(start, target, walls, snakes, maxIter = 1500, goalSampleRate = 0.1) {
    const obstacleSet = /* @__PURE__ */ new Set();
    for (const w of walls) obstacleSet.add(`${w.row},${w.col}`);
    let ignoreTail = null;
    if (snakes.length > 1) {
      const tail = snakes[snakes.length - 1];
      ignoreTail = `${tail.row},${tail.col}`;
    }
    for (const s of snakes) {
      const pos = `${s.row},${s.col}`;
      if (ignoreTail && pos === ignoreTail) continue;
      obstacleSet.add(pos);
    }
    const startPos = [start.row, start.col];
    const targetPos = [target.row, target.col];
    if (obstacleSet.has(`${startPos[0]},${startPos[1]}`) || obstacleSet.has(`${targetPos[0]},${targetPos[1]}`)) {
      return null;
    }
    const nodes = [{ row: startPos[0], col: startPos[1], parent: null, cost: 0 }];
    const treePositions = /* @__PURE__ */ new Set([`${startPos[0]},${startPos[1]}`]);
    let targetNode = null;
    for (let i = 0; i < maxIter; i++) {
      const sample = Math.random() < goalSampleRate ? targetPos : [Math.floor(Math.random() * ROW), Math.floor(Math.random() * COL)];
      if (obstacleSet.has(`${sample[0]},${sample[1]}`)) continue;
      let nearest = nodes[0];
      let bestD = dist2([nearest.row, nearest.col], sample);
      for (const n of nodes) {
        const d = dist2([n.row, n.col], sample);
        if (d < bestD) {
          bestD = d;
          nearest = n;
        }
      }
      const candidates = [];
      for (const [nr, nc] of gridNeighbors2(nearest.row, nearest.col)) {
        const nk = `${nr},${nc}`;
        if (obstacleSet.has(nk)) continue;
        if (treePositions.has(nk)) continue;
        candidates.push([nr, nc]);
      }
      if (!candidates.length) continue;
      let newPos = candidates[0];
      let minD = dist2(newPos, sample);
      for (const p of candidates) {
        const d = dist2(p, sample);
        if (d < minD) {
          minD = d;
          newPos = p;
        }
      }
      const [newRow, newCol] = newPos;
      const neighborNodes = [];
      for (const [nbR, nbC] of gridNeighbors2(newRow, newCol)) {
        const nk = `${nbR},${nbC}`;
        if (!treePositions.has(nk)) continue;
        for (const node of nodes) {
          if (node.row === nbR && node.col === nbC) {
            neighborNodes.push(node);
            break;
          }
        }
      }
      let bestParent = nearest;
      let bestCost = nearest.cost + 1;
      for (const candidate of neighborNodes) {
        if (candidate.cost + 1 < bestCost) {
          bestCost = candidate.cost + 1;
          bestParent = candidate;
        }
      }
      const newNode = { row: newRow, col: newCol, parent: bestParent, cost: bestCost };
      nodes.push(newNode);
      treePositions.add(`${newRow},${newCol}`);
      for (const neighbor of neighborNodes) {
        if (neighbor === bestParent) continue;
        if (newNode.cost + 1 < neighbor.cost) {
          neighbor.parent = newNode;
          propagateCost(neighbor, nodes);
        }
      }
      if (newRow === targetPos[0] && newCol === targetPos[1]) {
        if (!targetNode || newNode.cost < targetNode.cost) targetNode = newNode;
      }
    }
    if (!targetNode) return null;
    const path = [];
    let cur = targetNode;
    while (cur.parent) {
      path.push(new Point(cur.row, cur.col));
      cur = cur.parent;
    }
    path.reverse();
    return path;
  }
  function rrtxControllerAction(proxy) {
    const path = rrtStarPath(proxy.head, proxy.food, proxy.walls, proxy.snakes);
    if (path && path.length > 0) {
      return getActionFromPath(proxy.head, path[0], proxy.direct);
    }
    return safeRandomAction(proxy);
  }

  // js/ai/dwa.js
  function isCollisionIgnoreTail2(game, pt) {
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
  function dwaDecision(game, alpha = 2, beta = 1, gamma = 0.5) {
    const head = game.head;
    const direction = game.direct;
    const food = game.food;
    const clockWise = ["right", "down", "left", "up"];
    const idx = clockWise.indexOf(direction);
    const actionList = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    const names = ["straight", "right", "left"];
    let bestAction = [1, 0, 0];
    let bestScore = -Infinity;
    for (let i = 0; i < actionList.length; i++) {
      const actVec = actionList[i];
      let newDir = direction;
      if (actVec[1] === 1) newDir = clockWise[(idx + 1) % 4];
      else if (actVec[2] === 1) newDir = clockWise[(idx + 3) % 4];
      const newHead = head.copy();
      if (newDir === "left") newHead.col -= 1;
      else if (newDir === "right") newHead.col += 1;
      else if (newDir === "up") newHead.row -= 1;
      else if (newDir === "down") newHead.row += 1;
      if (isCollisionIgnoreTail2(game, newHead)) continue;
      const distToFood = Math.hypot(newHead.row - food.row, newHead.col - food.col);
      const headingScore = 1 / (distToFood + 0.1);
      const minObsDist = minObstacleDistance(game, newHead);
      const clearanceScore = Math.min(1, minObsDist / 5);
      const velocityScore = names[i] === "straight" ? 1 : 0.8;
      const totalScore = alpha * headingScore + beta * clearanceScore + gamma * velocityScore;
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestAction = actVec;
      }
    }
    return bestAction;
  }

  // js/ai/state.js
  function getState(game) {
    const head = game.head;
    const pointL = new Point(head.row, head.col - 1);
    const pointR = new Point(head.row, head.col + 1);
    const pointU = new Point(head.row - 1, head.col);
    const pointD = new Point(head.row + 1, head.col);
    const dirL = game.direct === "left";
    const dirR = game.direct === "right";
    const dirU = game.direct === "up";
    const dirD = game.direct === "down";
    return [
      dirR && game.isCollision(pointR) || dirL && game.isCollision(pointL) || dirU && game.isCollision(pointU) || dirD && game.isCollision(pointD),
      dirU && game.isCollision(pointR) || dirD && game.isCollision(pointL) || dirL && game.isCollision(pointU) || dirR && game.isCollision(pointD),
      dirD && game.isCollision(pointR) || dirU && game.isCollision(pointL) || dirR && game.isCollision(pointU) || dirL && game.isCollision(pointD),
      dirL,
      dirR,
      dirU,
      dirD,
      game.food.col < game.head.col,
      game.food.col > game.head.col,
      game.food.row < game.head.row,
      game.food.row > game.head.row
    ].map((v) => v ? 1 : 0);
  }

  // js/ai/onnx-rl.js
  var import_meta = {};
  var RL_ALGOS = {
    DQN: { file: "dqn.onnx", inputName: "input" },
    DDQN: { file: "ddqn.onnx", inputName: "input" },
    DUELINGDQN: { file: "dueling_dqn.onnx", inputName: "input" },
    PPO: { file: "ppo.onnx", inputName: "input" },
    TRPO: { file: "trpo.onnx", inputName: "input" },
    A2C: { file: "a2c.onnx", inputName: "input" }
  };
  var sessionCache = /* @__PURE__ */ new Map();
  var loadingPromises = /* @__PURE__ */ new Map();
  var retryAfterTs = /* @__PURE__ */ new Map();
  var RETRY_DELAY_MS = 3e3;
  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }
  function resolveModelUrlCandidates(fileName) {
    const baseCandidates = unique([
      typeof import_meta !== "undefined" && import_meta.url || null,
      typeof document !== "undefined" && document.baseURI || null,
      typeof window !== "undefined" && (window.location == null ? void 0 : window.location.href) || null
    ]).map((base) => new URL(".", base).href);
    const pathCandidates = ["models/", "./models/", "../models/", "/models/"];
    const urls = [];
    for (const base of baseCandidates) {
      for (const prefix of pathCandidates) {
        urls.push(new URL(`${prefix}${fileName}`, base).href);
      }
    }
    return unique(urls);
  }
  async function probeFirstModelUrl(fileName) {
    const candidates = resolveModelUrlCandidates(fileName);
    for (const url of candidates) {
      try {
        const resp = await fetch(url, { method: "HEAD" });
        if (resp.ok) return url;
      } catch (_) {
      }
    }
    return null;
  }
  async function loadSession(algoUpper) {
    if (sessionCache.has(algoUpper)) return sessionCache.get(algoUpper);
    if (loadingPromises.has(algoUpper)) return loadingPromises.get(algoUpper);
    const now = Date.now();
    const retryTs = retryAfterTs.get(algoUpper) || 0;
    if (now < retryTs) return null;
    const meta = RL_ALGOS[algoUpper];
    if (!meta) return null;
    if (typeof ort === "undefined") {
      console.warn("ONNX Runtime Web \u672A\u52A0\u8F7D");
      return null;
    }
    const promise = (async () => {
      try {
        const modelUrl = await probeFirstModelUrl(meta.file);
        if (!modelUrl) {
          retryAfterTs.set(algoUpper, Date.now() + RETRY_DELAY_MS);
          console.warn(`\u65E0\u6CD5\u627E\u5230 ONNX \u6A21\u578B\u6587\u4EF6 ${meta.file}\uFF0C\u8BF7\u786E\u8BA4\u5DF2\u653E\u5728 models/ \u76EE\u5F55`);
          return null;
        }
        const session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ["wasm"]
        });
        const inputName = session.inputNames.includes(meta.inputName) ? meta.inputName : session.inputNames[0];
        const outputName = session.outputNames[0];
        if (!inputName || !outputName) {
          retryAfterTs.set(algoUpper, Date.now() + RETRY_DELAY_MS);
          console.warn(`ONNX \u6A21\u578B ${meta.file} \u7F3A\u5C11\u6709\u6548\u8F93\u5165/\u8F93\u51FA\u5B9A\u4E49`);
          return null;
        }
        const loaded = {
          session,
          meta: { ...meta, inputName, outputName }
        };
        sessionCache.set(algoUpper, loaded);
        return loaded;
      } catch (e) {
        retryAfterTs.set(algoUpper, Date.now() + RETRY_DELAY_MS);
        console.warn(`\u65E0\u6CD5\u52A0\u8F7D ONNX \u6A21\u578B ${meta.file}:`, e);
        return null;
      } finally {
        loadingPromises.delete(algoUpper);
      }
    })();
    loadingPromises.set(algoUpper, promise);
    return promise;
  }
  function createOnnxController(algoName) {
    const algoUpper = algoName.toUpperCase();
    loadSession(algoUpper).catch(() => {
    });
    return {
      async nextAction(gameLike) {
        try {
          const loaded = await loadSession(algoUpper);
          if (!loaded) return [1, 0, 0];
          const state = getState(gameLike);
          const input = new Float32Array(state);
          const tensor = new ort.Tensor("float32", input, [1, 11]);
          const feeds = { [loaded.meta.inputName]: tensor };
          const results = await loaded.session.run(feeds);
          const output = results[loaded.meta.outputName] == null ? void 0 : results[loaded.meta.outputName].data;
          if (!output || output.length < 3) return [1, 0, 0];
          let move = 0;
          let maxVal = output[0];
          for (let i = 1; i < Math.min(3, output.length); i++) {
            if (output[i] > maxVal) {
              maxVal = output[i];
              move = i;
            }
          }
          const act = [0, 0, 0];
          act[move] = 1;
          return act;
        } catch (e) {
          sessionCache.delete(algoUpper);
          console.warn(`${algoUpper} \u63A8\u7406\u5931\u8D25\uFF0C\u56DE\u9000\u5230\u9ED8\u8BA4\u52A8\u4F5C:`, e);
          return [1, 0, 0];
        }
      }
    };
  }

  // js/ai/controllers.js
  var GameLikeForAI = class {
    constructor(head, direct, food, walls, body, opponentOccupied) {
      this.head = head;
      this.direct = direct;
      this.food = food;
      this.walls = walls;
      this.snakes = body;
      this._opp = opponentOccupied;
    }
    isCollision(pt = null) {
      const p = pt != null ? pt : this.head;
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
  };
  function wrapSync(fn) {
    return { nextAction: (g) => fn(g) };
  }
  function wrapAsync(ctrl) {
    return {
      nextAction: async (g) => ctrl.nextAction(g)
    };
  }
  function buildController(algoName) {
    const upper = algoName.trim().toUpperCase();
    if (upper === "BFS") return wrapSync(bfsControllerAction);
    if (upper === "APF") {
      return wrapSync((g) => chooseActionApf(g, ROW, COL));
    }
    if (upper === "AX") {
      return wrapSync((g) => {
        const proxy = new ProxyGame(g, g._opp);
        return axControllerAction(proxy);
      });
    }
    if (upper === "DIJKSTRA") {
      return wrapSync((g) => {
        const proxy = new ProxyGame(g, g._opp);
        return dijkstraControllerAction(proxy);
      });
    }
    if (upper === "RRT") {
      return wrapSync((g) => {
        const proxy = new ProxyGame(g, g._opp);
        return rrtControllerAction(proxy);
      });
    }
    if (upper === "RRTX") {
      return wrapSync((g) => {
        const proxy = new ProxyGame(g, g._opp);
        return rrtxControllerAction(proxy);
      });
    }
    if (upper === "DWA") {
      return wrapSync((g) => {
        const proxy = new ProxyGame(g, g._opp);
        return dwaDecision(proxy);
      });
    }
    if (["DQN", "DDQN", "DUELINGDQN", "PPO", "TRPO", "A2C"].includes(upper)) {
      return wrapAsync(createOnnxController(upper));
    }
    return wrapSync(bfsControllerAction);
  }

  // js/pvp-core.js
  var Snake = class {
    constructor(spawn) {
      this.spawn = spawn.copy();
      this.reset();
    }
    reset() {
      this.head = this.spawn.copy();
      this.body = [];
      this.direct = "left";
      this.score = 0;
    }
    occupied() {
      const s = /* @__PURE__ */ new Set([`${this.head.row},${this.head.col}`]);
      for (const p of this.body) s.add(`${p.row},${p.col}`);
      return s;
    }
  };
  function generateWalls(avoid) {
    const totalCells = ROW * COL;
    const numWalls = Math.floor(totalCells * 0.01);
    const candidates = [];
    for (let r = 0; r < ROW; r++) {
      for (let c = 0; c < COL; c++) {
        if (!avoid.has(`${r},${c}`)) candidates.push([r, c]);
      }
    }
    shuffle2(candidates);
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
  function shuffle2(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  async function runMatch(renderer2, options) {
    const {
      modeTitle,
      snake1Colors = ["#ff0000", "#00b400"],
      snake2Colors = ["#0078ff", "#dcc800"],
      snake2Ai = null,
      onExit,
      keys: keys2
    } = options;
    const exitBtn = new Button(
      { x: WIDTH - 120, y: 10, w: 110, h: 36 },
      "Exit",
      { font: "26px sans-serif", bg: "#c83c3c", hoverBg: "#dc5050", border: "#fff", radius: 8 }
    );
    const s1 = new Snake(new Point(Math.floor(ROW / 2), Math.floor(COL / 6)));
    const s2 = new Snake(new Point(Math.floor(ROW / 2), COL - Math.floor(COL / 6)));
    let matchP1 = 0;
    let matchP2 = 0;
    let walls = [];
    let food = new Point(0, 0);
    let targetDir1 = "left";
    let targetDir2 = "left";
    const roundReset = () => {
      const avoid = /* @__PURE__ */ new Set([...s1.occupied(), ...s2.occupied()]);
      walls = generateWalls(avoid);
      const occ = new Set(avoid);
      for (const w of walls) occ.add(`${w.row},${w.col}`);
      food = genFood(occ);
    };
    const occupiedAll = () => {
      const occ = /* @__PURE__ */ new Set([...s1.occupied(), ...s2.occupied()]);
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
        const elapsedS = (now - startTime) / 1e3;
        const timeLeft = Math.max(0, 30 - elapsedS);
        if (timeLeft <= 0) roundOver = true;
        await keys2.pump();
        if (keys2.quit) {
          onExit == null ? void 0 : onExit();
          return;
        }
        if (exitBtn.contains(keys2.mouseX, keys2.mouseY) && keys2.consumeClick()) {
          onExit == null ? void 0 : onExit();
          return;
        }
        const touchDir1 = keys2.consumeVirtualDirection("p1");
        if (touchDir1) targetDir1 = touchDir1;
        else if (keys2.isKey("w")) targetDir1 = "up";
        else if (keys2.isKey("s")) targetDir1 = "down";
        else if (keys2.isKey("a")) targetDir1 = "left";
        else if (keys2.isKey("d")) targetDir1 = "right";
        if (!snake2Ai) {
          const touchDir2 = keys2.consumeVirtualDirection("p2");
          if (touchDir2) targetDir2 = touchDir2;
          else if (keys2.isArrowUp()) targetDir2 = "up";
          else if (keys2.isArrowDown()) targetDir2 = "down";
          else if (keys2.isArrowLeft()) targetDir2 = "left";
          else if (keys2.isArrowRight()) targetDir2 = "right";
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
        drawMatchFrame(renderer2, renderer2.ctx, {
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
          keys: keys2
        });
        await delay2(1e3 / 15);
      }
      if (s1.score > s2.score) matchP1 += 1;
      else if (s2.score > s1.score) matchP2 += 1;
      else {
        matchP1 += 1;
        matchP2 += 1;
      }
      const pauseEnd = performance.now() + 3e3;
      while (performance.now() < pauseEnd) {
        await keys2.pump();
        if (keys2.quit || exitBtn.contains(keys2.mouseX, keys2.mouseY) && keys2.consumeClick()) {
          onExit == null ? void 0 : onExit();
          return;
        }
        renderer2.clear();
        const pauseCtx = renderer2.ctx;
        pauseCtx.fillStyle = HUD_SCORE_COLOR;
        pauseCtx.font = "40px sans-serif";
        pauseCtx.textAlign = "center";
        pauseCtx.fillText(
          `Round ${roundIdx} Over  |  Match ${matchP1}-${matchP2}`,
          WIDTH / 2,
          HEIGHT / 2
        );
        exitBtn.setHovered(exitBtn.contains(keys2.mouseX, keys2.mouseY));
        exitBtn.draw(pauseCtx);
        await delay2(1e3 / 30);
      }
    }
  }
  async function runAiBrawlMatch(renderer2, options) {
    const { modeTitle, participants, onExit, keys: keys2 } = options;
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
      "Exit",
      { font: "22px sans-serif", bg: "#c83c3c", hoverBg: "#dc5050", border: "#fff", radius: 8 }
    );
    const roundReset = () => {
      const avoid = /* @__PURE__ */ new Set();
      for (const s of snakes) {
        for (const k of s.occupied()) avoid.add(k);
      }
      walls = generateWalls(avoid);
      const occ = new Set(avoid);
      for (const w of walls) occ.add(`${w.row},${w.col}`);
      food = genFood(occ);
    };
    const occupiedAll = () => {
      const occ = /* @__PURE__ */ new Set();
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
        const timeLeft = Math.max(0, 30 - (now - startTime) / 1e3);
        if (timeLeft <= 0) roundOver = true;
        await keys2.pump();
        if (keys2.quit || exitBtn.contains(keys2.mouseX, keys2.mouseY) && keys2.consumeClick()) {
          onExit == null ? void 0 : onExit();
          return;
        }
        const actions = [];
        for (let i = 0; i < n; i++) {
          const opp = /* @__PURE__ */ new Set();
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
            opp
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
          const other = /* @__PURE__ */ new Set();
          for (let j = 0; j < n; j++) {
            if (j !== i) {
              for (const k of snakes[j].occupied()) other.add(k);
            }
          }
          const nh = nextHeads[i];
          if (!inBounds(nh, ROW, COL) || wallOcc.has(`${nh.row},${nh.col}`) || selfBody.has(`${nh.row},${nh.col}`) || other.has(`${nh.row},${nh.col}`)) {
            die[i] = true;
          }
        }
        const cellTo = /* @__PURE__ */ new Map();
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
        renderer2.clear();
        renderer2.drawWalls(walls);
        renderer2.drawFood(food);
        for (let i = 0; i < n; i++) {
          renderer2.drawSnake(snakes[i].head, snakes[i].body, colors[i][0], colors[i][1]);
          renderer2.drawAlgoLabel(labels[i], snakes[i].head);
        }
        const brawlCtx = renderer2.ctx;
        brawlCtx.fillStyle = HUD_INFO_COLOR;
        brawlCtx.font = "22px sans-serif";
        brawlCtx.textAlign = "left";
        brawlCtx.textBaseline = "top";
        brawlCtx.fillText(
          `${modeTitle}  Round ${roundIdx}/3  Time ${timeLeft.toFixed(1)}s`,
          10,
          6
        );
        const scoreParts = labels.map((lab, j) => `${lab.slice(0, 8)}:${snakes[j].score}`);
        brawlCtx.fillStyle = HUD_SCORE_COLOR;
        brawlCtx.font = "40px sans-serif";
        brawlCtx.textAlign = "center";
        brawlCtx.textBaseline = "top";
        brawlCtx.fillText(scoreParts.join("  "), WIDTH / 2, 30);
        const matchParts = labels.map((lab, j) => `${lab.slice(0, 6)}:${matchScores[j]}`);
        brawlCtx.font = "22px sans-serif";
        brawlCtx.textAlign = "left";
        brawlCtx.fillStyle = HUD_INFO_COLOR;
        brawlCtx.textBaseline = "top";
        brawlCtx.fillText(`Match  ${matchParts.join("  ")}`, 10, 30);
        exitBtn.setHovered(exitBtn.contains(keys2.mouseX, keys2.mouseY));
        exitBtn.draw(brawlCtx);
        await delay2(1e3 / 15);
      }
      const scores = snakes.map((s) => s.score);
      const mx = Math.max(...scores);
      const winners = scores.map((v, i) => v === mx ? i : -1).filter((i) => i >= 0);
      if (winners.length === 1) matchScores[winners[0]] += 1;
      else winners.forEach((i) => matchScores[i] += 1);
      const pauseEnd = performance.now() + 3e3;
      while (performance.now() < pauseEnd) {
        await keys2.pump();
        if (keys2.quit || exitBtn.contains(keys2.mouseX, keys2.mouseY) && keys2.consumeClick()) {
          onExit == null ? void 0 : onExit();
          return;
        }
        renderer2.clear();
        const pauseCtx2 = renderer2.ctx;
        let msg = `Round ${roundIdx} Over  |  Match: ${labels.map((l, i) => `${l}:${matchScores[i]}`).join(" ")}`;
        pauseCtx2.fillStyle = HUD_SCORE_COLOR;
        pauseCtx2.font = msg.length > 80 ? "22px sans-serif" : "40px sans-serif";
        pauseCtx2.textAlign = "center";
        if (pauseCtx2.measureText(msg).width > WIDTH - 20) {
          msg = `Round ${roundIdx} Over  |  Match ${matchScores.join("-")}`;
        }
        pauseCtx2.fillText(msg, WIDTH / 2, HEIGHT / 2);
        exitBtn.draw(pauseCtx2);
        await delay2(1e3 / 30);
      }
    }
  }
  function drawMatchFrame(renderer2, ctx2, data) {
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
      keys: keys2
    } = data;
    renderer2.clear();
    renderer2.drawWalls(walls);
    renderer2.drawFood(food);
    renderer2.drawSnake(s1.head, s1.body, snake1Colors[0], snake1Colors[1]);
    renderer2.drawSnake(s2.head, s2.body, snake2Colors[0], snake2Colors[1]);
    ctx2.fillStyle = HUD_INFO_COLOR;
    ctx2.font = "26px sans-serif";
    ctx2.textAlign = "left";
    ctx2.textBaseline = "top";
    ctx2.fillText(`${modeTitle}  Round ${roundIdx}/3  Time ${timeLeft.toFixed(1)}s`, 10, 6);
    ctx2.fillStyle = HUD_SCORE_COLOR;
    ctx2.font = "40px sans-serif";
    ctx2.textAlign = "center";
    ctx2.textBaseline = "top";
    ctx2.fillText(`P1 ${s1.score} : ${s2.score} P2`, WIDTH / 2, 30);
    ctx2.font = "26px sans-serif";
    ctx2.textAlign = "left";
    ctx2.fillStyle = HUD_INFO_COLOR;
    ctx2.textBaseline = "top";
    ctx2.fillText(`Match  P1 ${matchP1} - ${matchP2} P2`, 10, 30);
    exitBtn.setHovered(exitBtn.contains(keys2.mouseX, keys2.mouseY));
    exitBtn.draw(ctx2);
  }
  function delay2(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // js/screens/vs-ai.js
  async function runVsAiFlow(ctx2, renderer2, keys2, onExit) {
    const algo = await waitAlgorithmChoice("Choose AI Algorithm");
    if (!algo) return;
    hideAllMenus();
    const controller = buildController(algo);
    await runMatch(renderer2, {
      modeTitle: `Play vs AI (${algo})`,
      snake2Ai: controller,
      onExit,
      keys: keys2
    });
  }

  // js/screens/ai-brawl.js
  async function runAiBrawlFlow(ctx2, renderer2, keys2, onExit) {
    const count = await waitSnakeCountChoice();
    if (!count) return;
    const presets = SNAKE_PRESETS.slice(0, count);
    const participants = [];
    for (let slotIdx = 0; slotIdx < presets.length; slotIdx++) {
      const preset = presets[slotIdx];
      const algo = await waitAlgorithmChoice(
        "AI Brawl \u2014 Choose algorithm",
        `Snake ${slotIdx + 1} / ${count}  (${preset.name})`
      );
      if (!algo) return;
      participants.push([
        new Point(preset.spawn.row, preset.spawn.col),
        preset.colors,
        algo,
        buildController(algo)
      ]);
    }
    hideAllMenus();
    await runAiBrawlMatch(renderer2, {
      modeTitle: "AI Brawl",
      participants,
      onExit,
      keys: keys2
    });
  }

  // js/main.js
  var canvas = document.getElementById("game-canvas");
  var loadErrorEl = document.getElementById("load-error");
  var mainMenuEl = document.getElementById("main-menu");
  var mobileControlsEl = document.getElementById("mobile-controls");
  function showLoadError(msg) {
    console.error(msg);
    if (loadErrorEl) {
      loadErrorEl.textContent = msg;
      loadErrorEl.classList.remove("hidden");
    }
  }
  function clearLoadError() {
    loadErrorEl == null ? void 0 : loadErrorEl.classList.add("hidden");
  }
  if (!canvas || !mainMenuEl) {
    showLoadError("\u9875\u9762\u5143\u7D20\u52A0\u8F7D\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u5237\u65B0\u91CD\u8BD5");
    throw new Error("required DOM missing");
  }
  var renderer = createRenderer(canvas);
  var ctx = renderer.ctx;
  var keys = createInputHandler(canvas);
  canvas.addEventListener("click", () => canvas.focus());
  var gameRunning = false;
  function setMobileControls(mode) {
    const active = ["single", "two", "vsai"].includes(mode);
    mobileControlsEl?.classList.toggle("hidden", !active);
    mobileControlsEl?.classList.toggle("two-players", mode === "two");
    mobileControlsEl?.setAttribute("aria-hidden", active ? "false" : "true");
  }
  async function runGameMode(mode) {
    if (gameRunning) return;
    gameRunning = true;
    clearLoadError();
    hideAllMenus();
    keys.resetQuit();
    keys.clearKeys();
    setMobileControls(mode);
    canvas.focus();
    const backToMenu = async () => {
      keys.resetQuit();
      keys.clearKeys();
      setMobileControls(null);
      showMainMenu();
      gameRunning = false;
    };
    try {
      if (mode === "single") {
        await runSinglePlayer(ctx, renderer, keys, backToMenu);
      } else if (mode === "two") {
        await runMatch(renderer, {
          modeTitle: "Two Players",
          snake2Ai: null,
          onExit: backToMenu,
          keys
        });
        await backToMenu();
      } else if (mode === "vsai") {
        await runVsAiFlow(ctx, renderer, keys, backToMenu);
        await backToMenu();
      } else if (mode === "brawl") {
        await runAiBrawlFlow(ctx, renderer, keys, backToMenu);
        await backToMenu();
      } else {
        throw new Error(`\u672A\u77E5\u6A21\u5F0F: ${mode}`);
      }
    } catch (err) {
      console.error(err);
      showLoadError(`\u65E0\u6CD5\u5F00\u59CB\u6E38\u620F: ${err.message}`);
      await backToMenu();
    }
  }
  function bindMainMenu() {
    mainMenuEl.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const btn = target == null ? void 0 : target.closest("[data-mode]");
      if (!btn || gameRunning) return;
      e.preventDefault();
      e.stopPropagation();
      const mode = btn.getAttribute("data-mode");
      if (mode) {
        runGameMode(mode);
      }
    });
  }
  function init() {
    bindMainMenu();
    showMainMenu();
    canvas.focus();
  }
  window.addEventListener("error", (e) => {
    showLoadError(`\u811A\u672C\u9519\u8BEF: ${e.message}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    var _a;
    showLoadError(`\u8FD0\u884C\u9519\u8BEF: ${((_a = e.reason) == null ? void 0 : _a.message) || e.reason}`);
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
