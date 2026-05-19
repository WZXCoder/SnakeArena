import {
  WIDTH,
  SNAKE_BODY_COLOR,
  SNAKE_HEAD_COLOR,
  HUD_SCORE_COLOR,
  HUD_INFO_COLOR,
} from '../constants.js';
import { SnakeGameAI } from '../game-env.js';
import { actionFromTargetDir } from '../game-utils.js';
import { loadHighScore, updateHighScoreIfNeeded } from '../high-score.js';
import { Button } from '../widgets.js';

export async function runSinglePlayer(ctx, renderer, keys, onExit) {
  const exitBtn = new Button(
    { x: WIDTH - 120, y: 10, w: 110, h: 36 },
    'Exit',
    { font: '26px sans-serif', bg: '#c83c3c', hoverBg: '#dc5050', border: '#fff', radius: 8 },
  );
  const restartBtn = new Button(
    { x: WIDTH / 2 - 170, y: 340, w: 160, h: 56 },
    'Restart',
    { font: '30px sans-serif', bg: '#1d7a30', hoverBg: '#2a9640', border: '#fff', radius: 10 },
  );
  const gameOverExitBtn = new Button(
    { x: WIDTH / 2 + 10, y: 340, w: 160, h: 56 },
    'Exit',
    { font: '30px sans-serif', bg: '#c83c3c', hoverBg: '#dc5050', border: '#fff', radius: 10 },
  );

  const game = new SnakeGameAI();
  game.reset();
  let targetDir = game.direct;
  let best = loadHighScore();
  let isGameOver = false;
  let finalScore = 0;

  while (true) {
    await keys.pump();
    if (keys.quit) {
      await onExit();
      return;
    }
    if (!isGameOver && exitBtn.contains(keys.mouseX, keys.mouseY) && keys.consumeClick()) {
      await onExit();
      return;
    }

    let stepped = false;
    if (!isGameOver) {
      // 方向键控制（↑↓←→）
      const touchDir = keys.consumeVirtualDirection('p1');
      if (touchDir) targetDir = touchDir;
      else if (keys.isArrowUp()) targetDir = 'up';
      else if (keys.isArrowDown()) targetDir = 'down';
      else if (keys.isArrowLeft()) targetDir = 'left';
      else if (keys.isArrowRight()) targetDir = 'right';

      const action = actionFromTargetDir(game.direct, targetDir);
      const stepResult = game.playStep(action, performance.now());
      stepped = stepResult.stepped;

      if (stepResult.gameOver) {
        finalScore = game.score;
        best = updateHighScoreIfNeeded(finalScore);
        isGameOver = true;
      }
    } else {
      const restartHovered = restartBtn.contains(keys.mouseX, keys.mouseY);
      const exitHovered = gameOverExitBtn.contains(keys.mouseX, keys.mouseY);
      restartBtn.setHovered(restartHovered);
      gameOverExitBtn.setHovered(exitHovered);

      if (keys.consumeClick()) {
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

    renderer.clear();
    renderer.drawWalls(game.walls);
    game.snakes.forEach((seg) => renderer.drawRect(seg, SNAKE_BODY_COLOR));
    renderer.drawRect(game.head, SNAKE_HEAD_COLOR);
    renderer.drawFood(game.food);

    ctx.fillStyle = HUD_INFO_COLOR;
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Best: ${best}`, 10, 6);

    ctx.fillStyle = HUD_SCORE_COLOR;
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${isGameOver ? finalScore : game.score}`, WIDTH / 2, 6);

    if (!isGameOver) {
      exitBtn.setHovered(exitBtn.contains(keys.mouseX, keys.mouseY));
      exitBtn.draw(ctx);
    } else {
      drawGameOverOverlay(ctx, finalScore, best);
      restartBtn.draw(ctx);
      gameOverExitBtn.draw(ctx);
    }

    if (!stepped) {
      await delay(1000 / 60);
    }
  }
}

function drawGameOverOverlay(ctx, finalScore, best) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(0, 0, WIDTH, 600);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '64px sans-serif';
  ctx.fillText('Game Over', WIDTH / 2, 210);

  ctx.font = '36px sans-serif';
  ctx.fillText(`Final Score: ${finalScore}`, WIDTH / 2, 270);

  ctx.font = '28px sans-serif';
  ctx.fillStyle = HUD_INFO_COLOR;
  ctx.fillText(`Best: ${best}`, WIDTH / 2, 305);
  ctx.restore();
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
