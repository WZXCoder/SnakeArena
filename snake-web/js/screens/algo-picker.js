import { WIDTH, HEIGHT, BG_COLOR, HUD_TITLE_COLOR, ALGOS } from '../constants.js';
import { Button } from '../widgets.js';

export async function chooseAlgorithm(ctx, keys, title, subtitle = null) {
  const backBtn = new Button(
    { x: 20, y: 20, w: 110, h: 36 },
    'Back',
    { font: '26px sans-serif', bg: '#323232', hoverBg: '#505050', border: '#fff', radius: 8 },
  );

  const cols = 3;
  const gap = 16;
  const bw = 240;
  const bh = 44;
  const totalW = cols * bw + (cols - 1) * gap;
  const left = (WIDTH - totalW) / 2;
  const top = subtitle ? 160 : 140;

  const buttons = ALGOS.map((name, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    return {
      name,
      btn: new Button(
        { x: left + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh },
        name,
        { font: '26px sans-serif', bg: '#145078', hoverBg: '#1e6ea0' },
      ),
    };
  });

  while (true) {
    await keys.pump();
    if (keys.quit) return null;

    if (backBtn.contains(keys.mouseX, keys.mouseY) && keys.consumeClick()) return null;

    for (const { name, btn } of buttons) {
      btn.setHovered(btn.contains(keys.mouseX, keys.mouseY));
      if (btn.contains(keys.mouseX, keys.mouseY) && keys.consumeClick()) return name;
    }

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = HUD_TITLE_COLOR;
    ctx.font = '52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, WIDTH / 2, 70);

    if (subtitle) {
      ctx.font = '28px sans-serif';
      ctx.fillText(subtitle, WIDTH / 2, 118);
    }

    backBtn.setHovered(backBtn.contains(keys.mouseX, keys.mouseY));
    backBtn.draw(ctx);
    buttons.forEach(({ btn }) => btn.draw(ctx));
  }
}

export async function chooseSnakeCount(ctx, keys) {
  const backBtn = new Button(
    { x: 20, y: 20, w: 110, h: 36 },
    'Back',
    { font: '30px sans-serif', bg: '#323232', hoverBg: '#505050', border: '#fff', radius: 8 },
  );

  const opts = [
    ['Two', 2],
    ['Three', 3],
    ['Four', 4],
  ];
  const bw = 200;
  const bh = 50;
  const gap = 24;
  const totalW = opts.length * bw + (opts.length - 1) * gap;
  const left = (WIDTH - totalW) / 2;
  const top = 220;

  const btns = opts.map(([label, n], i) => ({
    n,
    btn: new Button(
      { x: left + i * (bw + gap), y: top, w: bw, h: bh },
      label,
      { font: '30px sans-serif', bg: '#5a2878', hoverBg: '#7837a0' },
    ),
  }));

  while (true) {
    await keys.pump();
    if (keys.quit) return null;
    if (backBtn.contains(keys.mouseX, keys.mouseY) && keys.consumeClick()) return null;

    for (const { n, btn } of btns) {
      btn.setHovered(btn.contains(keys.mouseX, keys.mouseY));
      if (btn.contains(keys.mouseX, keys.mouseY) && keys.consumeClick()) return n;
    }

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = HUD_TITLE_COLOR;
    ctx.font = '52px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AI Brawl — Choose snake count', WIDTH / 2, 120);
    backBtn.draw(ctx);
    btns.forEach(({ btn }) => btn.draw(ctx));
  }
}
