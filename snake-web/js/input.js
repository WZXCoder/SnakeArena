/** 键盘与鼠标输入（方向键用 e.code 识别） */
export function createInputHandler(canvas) {
  const state = {
    quit: false,
    mouseX: 0,
    mouseY: 0,
    keysDown: new Set(),
    codesDown: new Set(),
    virtualDirs: { p1: null, p2: null },
    _clicked: false,
  };

  const rect = () => canvas.getBoundingClientRect();
  const validDirs = new Set(['up', 'down', 'left', 'right']);

  const queueVirtualDirection = (player, direction) => {
    if (!['p1', 'p2'].includes(player) || !validDirs.has(direction)) return;
    state.virtualDirs[player] = direction;
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') state.quit = true;
    state.keysDown.add(e.key.toLowerCase());
    state.codesDown.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    state.keysDown.delete(e.key.toLowerCase());
    state.codesDown.delete(e.code);
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = rect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    state.mouseX = (e.clientX - r.left) * scaleX;
    state.mouseY = (e.clientY - r.top) * scaleY;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      state._clicked = true;
    }
  });

  document.getElementById('mobile-controls')?.addEventListener('pointerdown', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const btn = target?.closest('[data-touch-player][data-touch-dir]');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    queueVirtualDirection(btn.getAttribute('data-touch-player'), btn.getAttribute('data-touch-dir'));
    canvas.focus();
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
    consumeVirtualDirection(player = 'p1') {
      const direction = state.virtualDirs[player] || null;
      state.virtualDirs[player] = null;
      return direction;
    },
    /** 支持 'ArrowUp' / 'arrowup' / 'w' */
    isKey(...keys) {
      return keys.some((k) => {
        if (k.startsWith('Arrow')) return state.codesDown.has(k);
        const lk = k.toLowerCase();
        return state.keysDown.has(lk) || state.codesDown.has(k);
      });
    },
    isArrowUp() {
      return state.codesDown.has('ArrowUp');
    },
    isArrowDown() {
      return state.codesDown.has('ArrowDown');
    },
    isArrowLeft() {
      return state.codesDown.has('ArrowLeft');
    },
    isArrowRight() {
      return state.codesDown.has('ArrowRight');
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
    },
  };
}
