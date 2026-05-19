from __future__ import annotations

import pygame

from game_env import WIDTH, HEIGHT, BG_COLOR, BLACK

HUD_TITLE_COLOR = (255, 200, 0)

from ui_ai_brawl import run_ai_brawl_flow
from ui_single_player import run_single_player
from ui_pvp_core import run_match
from ui_vs_ai import run_vs_ai
from ui_widgets import Button


def main() -> None:
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Snake Game")
    clock = pygame.time.Clock()

    font_title = pygame.font.SysFont(None, 86)
    font_btn = pygame.font.SysFont(None, 36)

    btn_w, btn_h = 320, 62
    center_x = WIDTH // 2
    start_y = HEIGHT // 2 - 40
    gap = 22

    single_btn = Button(
        pygame.Rect(center_x - btn_w // 2, start_y, btn_w, btn_h),
        "Single Player",
        font_btn,
        bg=(30, 120, 60),
        hover_bg=(50, 160, 80),
    )
    two_btn = Button(
        pygame.Rect(center_x - btn_w // 2, start_y + (btn_h + gap), btn_w, btn_h),
        "Two Players",
        font_btn,
        bg=(30, 80, 140),
        hover_bg=(50, 110, 190),
    )
    ai_btn = Button(
        pygame.Rect(center_x - btn_w // 2, start_y + 2 * (btn_h + gap), btn_w, btn_h),
        "Play vs AI",
        font_btn,
        bg=(120, 70, 30),
        hover_bg=(160, 95, 40),
    )
    brawl_btn = Button(
        pygame.Rect(center_x - btn_w // 2, start_y + 3 * (btn_h + gap), btn_w, btn_h),
        "AI Brawl",
        font_btn,
        bg=(90, 40, 120),
        hover_bg=(120, 55, 160),
    )

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                running = False

            if single_btn.is_clicked(event):
                run_single_player(screen)
            if two_btn.is_clicked(event):
                run_match(screen, mode_title="Two Players", snake2_ai=None)
            if ai_btn.is_clicked(event):
                run_vs_ai(screen)
            if brawl_btn.is_clicked(event):
                run_ai_brawl_flow(screen)

        screen.fill(BG_COLOR)
        title = font_title.render("Snake Game", True, HUD_TITLE_COLOR)
        screen.blit(title, title.get_rect(center=(WIDTH // 2, HEIGHT // 2 - 180)))

        single_btn.draw(screen)
        two_btn.draw(screen)
        ai_btn.draw(screen)
        brawl_btn.draw(screen)

        pygame.display.flip()
        clock.tick(60)

    pygame.quit()


if __name__ == "__main__":
    main()

