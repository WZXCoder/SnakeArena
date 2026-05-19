import { Point } from '../point.js';
import { SNAKE_PRESETS } from '../constants.js';
import { waitAlgorithmChoice, waitSnakeCountChoice, hideAllMenus } from './menu-dom.js';
import { buildController } from '../ai/controllers.js';
import { runAiBrawlMatch } from '../pvp-core.js';

export async function runAiBrawlFlow(ctx, renderer, keys, onExit) {
  const count = await waitSnakeCountChoice();
  if (!count) return;

  const presets = SNAKE_PRESETS.slice(0, count);
  const participants = [];

  for (let slotIdx = 0; slotIdx < presets.length; slotIdx++) {
    const preset = presets[slotIdx];
    const algo = await waitAlgorithmChoice(
      'AI Brawl — Choose algorithm',
      `Snake ${slotIdx + 1} / ${count}  (${preset.name})`,
    );
    if (!algo) return;
    participants.push([
      new Point(preset.spawn.row, preset.spawn.col),
      preset.colors,
      algo,
      buildController(algo),
    ]);
  }

  hideAllMenus();
  await runAiBrawlMatch(renderer, {
    modeTitle: 'AI Brawl',
    participants,
    onExit,
    keys,
  });
}
