from __future__ import annotations

import pygame

from game_env import WIDTH, HEIGHT, BG_COLOR, Point, ROW, COL

HUD_TITLE_COLOR = (255, 200, 0)

from ui_ai_controllers import build_controller
from ui_pvp_core import run_ai_brawl_match
from ui_vs_ai import choose_algorithm
from ui_widgets import Button

# 与 Play vs AI 外观一致：左红绿、右蓝黄；三/四条扩展色
SNAKE_PRESETS: list[tuple[str, Point, tuple[tuple[int, int, int], tuple[int, int, int]]]] = [
    ("Left (Red/Green)", Point(ROW // 2, COL // 6), ((255, 0, 0), (0, 180, 0))),
    ("Right (Blue/Yellow)", Point(ROW // 2, COL - COL // 6), ((0, 120, 255), (220, 200, 0))),
    ("Top (Pink/Orange)", Point(max(1, ROW // 8), COL // 2), ((255, 105, 180), (255, 140, 0))),
    ("Bottom (Green/Purple)", Point(min(ROW - 2, ROW - max(1, ROW // 8)), COL // 2), ((0, 200, 0), (128, 0, 128))),
]


def _choose_snake_count(screen: pygame.Surface) -> int | None:
    clock = pygame.time.Clock()
    font_title = pygame.font.SysFont(None, 52)
    font_small = pygame.font.SysFont(None, 30)

    back_btn = Button(
        pygame.Rect(20, 20, 110, 36),
        "Back",
        font_small,
        bg=(50, 50, 50),
        hover_bg=(80, 80, 80),
        border=(255, 255, 255),
        radius=8,
    )

    opts = [
        ("Two", 2),
        ("Three", 3),
        ("Four", 4),
    ]
    bw, bh = 200, 50
    gap = 24
    total_w = len(opts) * bw + (len(opts) - 1) * gap
    left = (WIDTH - total_w) // 2
    top = 220
    btns: list[tuple[int, Button]] = []
    for i, (label, n) in enumerate(opts):
        rect = pygame.Rect(left + i * (bw + gap), top, bw, bh)
        btns.append((n, Button(rect, label, font_small, bg=(90, 40, 120), hover_bg=(120, 55, 160))))

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return None
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                return None
            if back_btn.is_clicked(event):
                return None
            for n, btn in btns:
                if btn.is_clicked(event):
                    return n

        screen.fill(BG_COLOR)
        t = font_title.render("AI Brawl — Choose snake count", True, HUD_TITLE_COLOR)
        screen.blit(t, t.get_rect(center=(WIDTH // 2, 120)))
        back_btn.draw(screen)
        for _n, btn in btns:
            btn.draw(screen)
        pygame.display.flip()
        clock.tick(60)


def run_ai_brawl_flow(screen: pygame.Surface) -> None:
    count = _choose_snake_count(screen)
    if count is None:
        return

    presets = SNAKE_PRESETS[:count]
    participants: list[tuple[Point, tuple[tuple[int, int, int], tuple[int, int, int]], str, object]] = []

    for slot_idx, (_slot_name, spawn, colors) in enumerate(presets):
        algo = choose_algorithm(
            screen,
            title="AI Brawl — Choose algorithm",
            subtitle=f"Snake {slot_idx + 1} / {count}  ({_slot_name})",
        )
        if not algo:
            return
        participants.append((spawn, colors, algo, build_controller(algo)))

    run_ai_brawl_match(
        screen,
        mode_title="AI Brawl",
        participants=participants,
    )
