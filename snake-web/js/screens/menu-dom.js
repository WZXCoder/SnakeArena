import { ALGOS } from '../constants.js';

const mainMenu = () => document.getElementById('main-menu');
const algoMenu = () => document.getElementById('algo-menu');
const countMenu = () => document.getElementById('count-menu');
const algoGrid = () => document.getElementById('algo-grid');
const algoTitle = () => document.getElementById('algo-menu-title');
const algoSub = () => document.getElementById('algo-menu-sub');

function hideAll() {
  mainMenu()?.classList.add('hidden');
  algoMenu()?.classList.add('hidden');
  countMenu()?.classList.add('hidden');
}

export function showMainMenu() {
  hideAll();
  mainMenu()?.classList.remove('hidden');
}

export function hideAllMenus() {
  hideAll();
}

/** @returns {Promise<number|null>} */
export function waitSnakeCountChoice() {
  hideAll();
  countMenu()?.classList.remove('hidden');

  return new Promise((resolve) => {
    const menu = countMenu();
    const backBtn = document.getElementById('count-back');
    if (!menu) {
      resolve(null);
      return;
    }

    const onPick = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const btn = target?.closest('[data-count]');
      if (!btn) return;
      e.preventDefault();
      cleanup();
      resolve(parseInt(btn.getAttribute('data-count'), 10));
    };

    const onBack = (e) => {
      e.preventDefault();
      cleanup();
      resolve(null);
    };

    const cleanup = () => {
      menu.removeEventListener('click', onPick);
      backBtn?.removeEventListener('click', onBack);
    };

    menu.addEventListener('click', onPick);
    backBtn?.addEventListener('click', onBack);
  });
}

/** @returns {Promise<string|null>} 算法名 */
export function waitAlgorithmChoice(title, subtitle = null) {
  hideAll();
  const menu = algoMenu();
  menu?.classList.remove('hidden');

  if (algoTitle()) algoTitle().textContent = title;
  const subEl = algoSub();
  if (subtitle) {
    subEl.textContent = subtitle;
    subEl.classList.remove('hidden');
  } else {
    subEl?.classList.add('hidden');
  }

  const grid = algoGrid();
  if (grid) {
    grid.innerHTML = '';
    ALGOS.forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-btn';
      btn.textContent = name;
      btn.dataset.algo = name;
      grid.appendChild(btn);
    });
  }

  return new Promise((resolve) => {
    const backBtn = document.getElementById('algo-back');
    if (!menu || !grid) {
      resolve(null);
      return;
    }

    const onPick = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const btn = target?.closest('[data-algo]');
      if (!btn) return;
      e.preventDefault();
      cleanup();
      resolve(btn.getAttribute('data-algo'));
    };

    const onBack = (e) => {
      e.preventDefault();
      cleanup();
      resolve(null);
    };

    const cleanup = () => {
      grid.removeEventListener('click', onPick);
      backBtn?.removeEventListener('click', onBack);
    };

    grid.addEventListener('click', onPick);
    backBtn?.addEventListener('click', onBack);
  });
}
