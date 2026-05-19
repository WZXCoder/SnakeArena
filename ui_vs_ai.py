from __future__ import annotations

import pygame

from game_env import WIDTH, HEIGHT, BG_COLOR, BLACK

HUD_TITLE_COLOR = (255, 200, 0)

from ui_ai_controllers import build_controller
from ui_pvp_core import run_match
from ui_widgets import Button


ALGOS = [
    "DQN",
    "DDQN",
    "DuelingDQN",
    "PPO",
    "TRPO",
    "A2C",
    "APF",
    "Ax",
    "BFS",
    "Dijkstra",
    "DWA",
    "RRT",
    "RRTx",
]


def choose_algorithm(screen: pygame.Surface, *, title: str, subtitle: str | None = None) -> str | None:
    """算法网格选择；title/subtitle 可自定义（供 Play vs AI / AI Brawl 复用）。"""
    clock = pygame.time.Clock()
    font_title = pygame.font.SysFont(None, 52)
    font_sub = pygame.font.SysFont(None, 28)
    font_small = pygame.font.SysFont(None, 26)

    back_btn = Button(
        pygame.Rect(20, 20, 110, 36),
        "Back",
        font_small,
        bg=(50, 50, 50),
        hover_bg=(80, 80, 80),
        border=(255, 255, 255),
        radius=8,
    )

    buttons: list[tuple[str, Button]] = []
    cols = 3
    gap = 16
    bw = 240
    bh = 44
    total_w = cols * bw + (cols - 1) * gap
    left = (WIDTH - total_w) // 2
    top = 160 if subtitle else 140
    for idx, name in enumerate(ALGOS):
        r = idx // cols
        c = idx % cols
        rect = pygame.Rect(left + c * (bw + gap), top + r * (bh + gap), bw, bh)
        buttons.append((name, Button(rect, name, font_small, bg=(20, 80, 120), hover_bg=(30, 110, 160))))

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return None
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                return None
            if back_btn.is_clicked(event):
                return None
            for name, btn in buttons:
                if btn.is_clicked(event):
                    return name

        screen.fill(BG_COLOR)
        title_surf = font_title.render(title, True, HUD_TITLE_COLOR)
        screen.blit(title_surf, title_surf.get_rect(center=(WIDTH // 2, 70)))
        if subtitle:
            sub_surf = font_sub.render(subtitle, True, HUD_TITLE_COLOR)
            screen.blit(sub_surf, sub_surf.get_rect(center=(WIDTH // 2, 118)))
        back_btn.draw(screen)
        for _name, btn in buttons:
            btn.draw(screen)
        pygame.display.flip()
        clock.tick(60)


def _choose_algo(screen: pygame.Surface) -> str | None:
    return choose_algorithm(screen, title="Choose AI Algorithm")


def run_vs_ai(screen: pygame.Surface) -> None:
    algo = _choose_algo(screen)
    if not algo:
        return
    controller = build_controller(algo)
    run_match(screen, mode_title=f"Play vs AI ({algo})", snake2_ai=controller)

