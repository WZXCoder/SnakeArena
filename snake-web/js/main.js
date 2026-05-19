import { createRenderer } from './renderer.js';
import { createInputHandler } from './input.js';
import { hideAllMenus, showMainMenu } from './screens/menu-dom.js';
import { runSinglePlayer } from './screens/single-player.js';
import { runMatch } from './pvp-core.js';
import { runVsAiFlow } from './screens/vs-ai.js';
import { runAiBrawlFlow } from './screens/ai-brawl.js';

const canvas = document.getElementById('game-canvas');
const loadErrorEl = document.getElementById('load-error');
const mainMenuEl = document.getElementById('main-menu');
const mobileControlsEl = document.getElementById('mobile-controls');

function showLoadError(msg) {
  console.error(msg);
  if (loadErrorEl) {
    loadErrorEl.textContent = msg;
    loadErrorEl.classList.remove('hidden');
  }
}

function clearLoadError() {
  loadErrorEl?.classList.add('hidden');
}

if (!canvas || !mainMenuEl) {
  showLoadError('页面元素加载不完整，请刷新重试');
  throw new Error('required DOM missing');
}

const renderer = createRenderer(canvas);
const ctx = renderer.ctx;
const keys = createInputHandler(canvas);

canvas.addEventListener('click', () => canvas.focus());

let gameRunning = false;

function setMobileControls(mode) {
  const active = ['single', 'two', 'vsai'].includes(mode);
  mobileControlsEl?.classList.toggle('hidden', !active);
  mobileControlsEl?.classList.toggle('two-players', mode === 'two');
  mobileControlsEl?.setAttribute('aria-hidden', active ? 'false' : 'true');
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
    if (mode === 'single') {
      await runSinglePlayer(ctx, renderer, keys, backToMenu);
    } else if (mode === 'two') {
      await runMatch(renderer, {
        modeTitle: 'Two Players',
        snake2Ai: null,
        onExit: backToMenu,
        keys,
      });
      await backToMenu();
    } else if (mode === 'vsai') {
      await runVsAiFlow(ctx, renderer, keys, backToMenu);
      await backToMenu();
    } else if (mode === 'brawl') {
      await runAiBrawlFlow(ctx, renderer, keys, backToMenu);
      await backToMenu();
    } else {
      throw new Error(`未知模式: ${mode}`);
    }
  } catch (err) {
    console.error(err);
    showLoadError(`无法开始游戏: ${err.message}`);
    await backToMenu();
  }
}

/** 主菜单点击（事件委托，只绑定一次） */
function bindMainMenu() {
  mainMenuEl.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const btn = target?.closest('[data-mode]');
    if (!btn || gameRunning) return;
    e.preventDefault();
    e.stopPropagation();
    const mode = btn.getAttribute('data-mode');
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

window.addEventListener('error', (e) => {
  showLoadError(`脚本错误: ${e.message}`);
});

window.addEventListener('unhandledrejection', (e) => {
  showLoadError(`运行错误: ${e.reason?.message || e.reason}`);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
