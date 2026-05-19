/** 对应 ui_high_score.py，使用 localStorage 持久化 */
const STORAGE_KEY = 'snake_high_score';

export function loadHighScore() {
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    if (!txt) return 0;
    const n = parseInt(txt, 10);
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

export function saveHighScore(score) {
  localStorage.setItem(STORAGE_KEY, String(Math.floor(score)));
}

export function updateHighScoreIfNeeded(score) {
  const current = loadHighScore();
  if (score > current) {
    saveHighScore(score);
    return score;
  }
  return current;
}
