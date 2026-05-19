import { WIDTH, HEIGHT, BG_COLOR, HUD_TITLE_COLOR } from '../constants.js';
import { Button } from '../widgets.js';

export function createLauncherScreen(ctx, keys, onSelect) {
  const centerX = WIDTH / 2;
  const startY = HEIGHT / 2 - 40;
  const btnW = 320;
  const btnH = 62;
  const gap = 22;

  const buttons = [
    new Button(
      { x: centerX - btnW / 2, y: startY, w: btnW, h: btnH },
      'Single Player',
      { font: '36px sans-serif', bg: '#1e783c', hoverBg: '#32a050' },
    ),
    new Button(
      { x: centerX - btnW / 2, y: startY + btnH + gap, w: btnW, h: btnH },
      'Two Players',
      { font: '36px sans-serif', bg: '#1e508c', hoverBg: '#326ebe' },
    ),
    new Button(
      { x: centerX - btnW / 2, y: startY + 2 * (btnH + gap), w: btnW, h: btnH },
      'Play vs AI',
      { font: '36px sans-serif', bg: '#78461e', hoverBg: '#a05f28' },
    ),
    new Button(
      { x: centerX - btnW / 2, y: startY + 3 * (btnH + gap), w: btnW, h: btnH },
      'AI Brawl',
      { font: '36px sans-serif', bg: '#5a2878', hoverBg: '#7837a0' },
    ),
  ];

  const modes = ['single', 'two', 'vsai', 'brawl'];

  return async function tick() {
    await keys.pump();
    if (keys.quit) return 'quit';

    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      btn.setHovered(btn.contains(keys.mouseX, keys.mouseY));
      if (btn.contains(keys.mouseX, keys.mouseY) && keys.consumeClick()) {
        onSelect(modes[i]);
        return modes[i];
      }
    }

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = HUD_TITLE_COLOR;
    ctx.font = '86px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Snake Game', WIDTH / 2, HEIGHT / 2 - 180);

    buttons.forEach((b) => b.draw(ctx));
    return null;
  };
}
