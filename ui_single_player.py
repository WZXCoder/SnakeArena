from __future__ import annotations

import pygame

from game_env import (
    SnakeGameAI,
    BG_COLOR,
    SNAKE_BODY_COLOR,
    SNAKE_HEAD_COLOR,
    FOOD_COLOR,
    WALL_COLOR,
    BLACK,
    CELL_W,
    CELL_H,
    WIDTH,
    HEIGHT,
)

from ui_high_score import load_high_score, update_high_score_if_needed
from ui_widgets import Button


HUD_SCORE_COLOR = (255, 200, 0)
HUD_INFO_COLOR = (0, 180, 220)


def _get_action_from_direction(current_dir: str, target_dir: str):
    clock_wise = ["right", "down", "left", "up"]
    idx = clock_wise.index(current_dir)

    if target_dir == current_dir:
        return [1, 0, 0]
    if target_dir == clock_wise[(idx + 1) % 4]:
        return [0, 1, 0]
    if target_dir == clock_wise[(idx - 1) % 4]:
        return [0, 0, 1]
    return [1, 0, 0]


def run_single_player(screen: pygame.Surface) -> None:
    clock = pygame.time.Clock()
    font_title = pygame.font.SysFont(None, 36)
    font_small = pygame.font.SysFont(None, 26)

    exit_btn = Button(
        pygame.Rect(WIDTH - 120, 10, 110, 36),
        "Exit",
        font_small,
        bg=(200, 60, 60),
        hover_bg=(220, 80, 80),
        border=(255, 255, 255),
        radius=8,
    )

    game = SnakeGameAI(is_training=False)
    game.reset()

    # 不改原文件：运行时把环境的窗口/渲染接管到我们的 screen 上
    game.window = screen

    def _draw_rect(point, color):
        left = point.col * CELL_W
        top = point.row * CELL_H
        pygame.draw.rect(screen, color, (left, top, CELL_W, CELL_H))

    game._draw_rect = _draw_rect  # type: ignore[attr-defined]

    target_dir = game.direct
    best = load_high_score()

    def _update_ui_custom():
        screen.fill(BG_COLOR)
        for w in game.walls:
            _draw_rect(w, WALL_COLOR)
        for seg in game.snakes:
            _draw_rect(seg, SNAKE_BODY_COLOR)
        _draw_rect(game.head, SNAKE_HEAD_COLOR)
        _draw_rect(game.food, FOOD_COLOR)

        # HUD：左上最高分、顶部中间当前分、右上 Exit
        best_surf = font_small.render(f"Best: {best}", True, HUD_INFO_COLOR)
        screen.blit(best_surf, (10, 10))

        score_surf = font_title.render(f"Score: {game.score}", True, HUD_SCORE_COLOR)
        score_rect = score_surf.get_rect(midtop=(WIDTH // 2, 8))
        screen.blit(score_surf, score_rect)

        exit_btn.draw(screen)
        pygame.display.flip()

    game._update_ui = _update_ui_custom  # type: ignore[attr-defined]

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return
            if exit_btn.is_clicked(event):
                return
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    return
                if event.key in (pygame.K_UP, pygame.K_w):
                    target_dir = "up"
                elif event.key in (pygame.K_DOWN, pygame.K_s):
                    target_dir = "down"
                elif event.key in (pygame.K_LEFT, pygame.K_a):
                    target_dir = "left"
                elif event.key in (pygame.K_RIGHT, pygame.K_d):
                    target_dir = "right"

        action = _get_action_from_direction(game.direct, target_dir)
        _reward, done, score = game.play_step(action, process_events=False)
        if done:
            best = update_high_score_if_needed(score)
            game.reset()
            target_dir = game.direct

        clock.tick(60)

