import { waitAlgorithmChoice, hideAllMenus } from './menu-dom.js';
import { buildController } from '../ai/controllers.js';
import { runMatch } from '../pvp-core.js';

export async function runVsAiFlow(ctx, renderer, keys, onExit) {
  const algo = await waitAlgorithmChoice('Choose AI Algorithm');
  if (!algo) return;

  hideAllMenus();
  const controller = buildController(algo);
  await runMatch(renderer, {
    modeTitle: `Play vs AI (${algo})`,
    snake2Ai: controller,
    onExit,
    keys,
  });
}
