from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Protocol

import pygame

from game_env import (
    Point,
    ROW,
    COL,
    WIDTH,
    HEIGHT,
    CELL_W,
    CELL_H,
    BG_COLOR,
    FOOD_COLOR,
    WALL_COLOR,
    BLACK,
)

from ui_widgets import Button


HUD_SCORE_COLOR = (255, 200, 0)
HUD_INFO_COLOR = (0, 180, 220)

DIRS = ["right", "down", "left", "up"]


def _turn_dir(current_dir: str, action) -> str:
    # action: [straight, right, left]
    idx = DIRS.index(current_dir)
    if action[1] == 1:
        return DIRS[(idx + 1) % 4]
    if action[2] == 1:
        return DIRS[(idx - 1) % 4]
    return current_dir


def _step_from_dir(head: Point, direct: str) -> Point:
    p = head.copy()
    if direct == "left":
        p.col -= 1
    elif direct == "right":
        p.col += 1
    elif direct == "up":
        p.row -= 1
    elif direct == "down":
        p.row += 1
    return p


def _in_bounds(pt: Point) -> bool:
    return 0 <= pt.row < ROW and 0 <= pt.col < COL


def _generate_walls(avoid: set[tuple[int, int]]) -> list[Point]:
    total_cells = ROW * COL
    num_walls = int(total_cells * 0.01)
    candidates = [
        (r, c)
        for r in range(ROW)
        for c in range(COL)
        if (r, c) not in avoid
    ]
    selected = random.sample(candidates, min(num_walls, len(candidates)))
    return [Point(r, c) for (r, c) in selected]


def _gen_food(occupied: set[tuple[int, int]]) -> Point:
    candidates = [
        (r, c)
        for r in range(ROW)
        for c in range(COL)
        if (r, c) not in occupied
    ]
    if not candidates:
        return Point(-1, -1)
    r, c = random.choice(candidates)
    return Point(r, c)


def _nearest_free_cell(preferred: Point, occupied: set[tuple[int, int]]) -> Point:
    if _in_bounds(preferred) and (preferred.row, preferred.col) not in occupied:
        return preferred.copy()

    candidates = [
        (abs(r - preferred.row) + abs(c - preferred.col), r, c)
        for r in range(ROW)
        for c in range(COL)
        if (r, c) not in occupied
    ]
    if not candidates:
        return preferred.copy()
    _dist, r, c = min(candidates)
    return Point(r, c)


@dataclass
class Snake:
    head: Point
    body: list[Point]  # body segments, excludes head
    direct: str
    score: int
    spawn: Point

    @staticmethod
    def create(spawn: Point) -> "Snake":
        return Snake(head=spawn.copy(), body=[], direct="left", score=0, spawn=spawn.copy())

    def reset(self) -> None:
        self.head = self.spawn.copy()
        self.body = []
        self.direct = "left"
        self.score = 0

    def occupied(self) -> set[tuple[int, int]]:
        s = {(self.head.row, self.head.col)}
        for p in self.body:
            s.add((p.row, p.col))
        return s


class ActionProvider(Protocol):
    def next_action(self, game_like) -> list[int]:
        ...


class _GameLikeForAI:
    """
    给原有 agent_*.py 的 get_state 复用：它只依赖 head/direct/food/walls/snakes/is_collision/Point。
    snakes 语义与 SnakeGameAI 一致：不含 head 的身体段。
    """

    def __init__(
        self,
        head: Point,
        direct: str,
        food: Point,
        walls: list[Point],
        body: list[Point],
        opponent_occupied: set[tuple[int, int]],
    ):
        self.head = head
        self.direct = direct
        self.food = food
        self.walls = walls
        self.snakes = body
        self._opp = opponent_occupied

    def is_collision(self, pt: Point | None = None) -> bool:
        if pt is None:
            pt = self.head
        if not _in_bounds(pt):
            return True
        if (pt.row, pt.col) in self._opp:
            return True
        for w in self.walls:
            if w.row == pt.row and w.col == pt.col:
                return True
        for s in self.snakes:
            if s.row == pt.row and s.col == pt.col:
                return True
        return False


def _action_from_target_dir(current_dir: str, target_dir: str) -> list[int]:
    idx = DIRS.index(current_dir)
    if target_dir == current_dir:
        return [1, 0, 0]
    if target_dir == DIRS[(idx + 1) % 4]:
        return [0, 1, 0]
    if target_dir == DIRS[(idx - 1) % 4]:
        return [0, 0, 1]
    return [1, 0, 0]


def run_match(
    screen: pygame.Surface,
    *,
    mode_title: str,
    snake1_colors=((255, 0, 0), (0, 180, 0)),  # head, body
    snake2_colors=((0, 120, 255), (220, 200, 0)),
    snake2_ai: ActionProvider | None = None,
) -> None:
    clock = pygame.time.Clock()
    font_big = pygame.font.SysFont(None, 40)
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

    s1 = Snake.create(Point(ROW // 2, COL // 6))
    s2 = Snake.create(Point(ROW // 2, COL - COL // 6))

    match_p1 = 0
    match_p2 = 0

    def round_reset() -> tuple[list[Point], Point]:
        avoid = set()
        avoid |= s1.occupied()
        avoid |= s2.occupied()
        walls = _generate_walls(avoid)
        occ = set(avoid)
        for w in walls:
            occ.add((w.row, w.col))
        food = _gen_food(occ)
        return walls, food

    def respawn(s: Snake) -> None:
        blocked = occupied_all() - s.occupied()
        if _in_bounds(food):
            blocked.add((food.row, food.col))
        s.head = _nearest_free_cell(s.spawn, blocked)
        s.body = []
        s.direct = "left"
        s.score = 0

    def occupied_all() -> set[tuple[int, int]]:
        occ = set()
        occ |= s1.occupied()
        occ |= s2.occupied()
        for w in walls:
            occ.add((w.row, w.col))
        return occ

    walls, food = round_reset()

    target_dir_1 = s1.direct
    target_dir_2 = s2.direct

    for round_idx in range(1, 4):
        # 每局开始：分数清零+复活+重置地图
        s1.reset()
        s2.reset()
        walls, food = round_reset()
        target_dir_1 = s1.direct
        target_dir_2 = s2.direct

        start_ticks = pygame.time.get_ticks()
        round_over = False

        while not round_over:
            now = pygame.time.get_ticks()
            elapsed_s = (now - start_ticks) / 1000.0
            time_left = max(0.0, 30.0 - elapsed_s)
            if time_left <= 0.0:
                round_over = True

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return
                if exit_btn.is_clicked(event):
                    return
                if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    return
                if event.type == pygame.KEYDOWN:
                    # Snake 1: WASD
                    if event.key == pygame.K_w:
                        target_dir_1 = "up"
                    elif event.key == pygame.K_s:
                        target_dir_1 = "down"
                    elif event.key == pygame.K_a:
                        target_dir_1 = "left"
                    elif event.key == pygame.K_d:
                        target_dir_1 = "right"

                    # Snake 2: Arrow keys (仅当不是 AI)
                    if snake2_ai is None:
                        if event.key == pygame.K_UP:
                            target_dir_2 = "up"
                        elif event.key == pygame.K_DOWN:
                            target_dir_2 = "down"
                        elif event.key == pygame.K_LEFT:
                            target_dir_2 = "left"
                        elif event.key == pygame.K_RIGHT:
                            target_dir_2 = "right"

            a1 = _action_from_target_dir(s1.direct, target_dir_1)
            if snake2_ai is None:
                a2 = _action_from_target_dir(s2.direct, target_dir_2)
            else:
                game_like = _GameLikeForAI(
                    head=s2.head,
                    direct=s2.direct,
                    food=food,
                    walls=walls,
                    body=s2.body,
                    opponent_occupied=s1.occupied(),
                )
                a2 = snake2_ai.next_action(game_like)

            s1.direct = _turn_dir(s1.direct, a1)
            s2.direct = _turn_dir(s2.direct, a2)

            next1 = _step_from_dir(s1.head, s1.direct)
            next2 = _step_from_dir(s2.head, s2.direct)

            s1_occ_body = {(p.row, p.col) for p in s1.body[:-1]}
            s2_occ_body = {(p.row, p.col) for p in s2.body[:-1]}
            wall_occ = {(w.row, w.col) for w in walls}

            def would_die(next_head: Point, self_body: set[tuple[int, int]], other_occ_all: set[tuple[int, int]]) -> bool:
                if not _in_bounds(next_head):
                    return True
                if (next_head.row, next_head.col) in wall_occ:
                    return True
                if (next_head.row, next_head.col) in self_body:
                    return True
                if (next_head.row, next_head.col) in other_occ_all:
                    return True
                return False

            s1_next_die = would_die(next1, s1_occ_body, s2.occupied())
            s2_next_die = would_die(next2, s2_occ_body, s1.occupied())

            # 头碰头：都死
            if next1.row == next2.row and next1.col == next2.col:
                s1_next_die = True
                s2_next_die = True

            if s1_next_die:
                respawn(s1)
                target_dir_1 = s1.direct
            else:
                s1.body.insert(0, s1.head.copy())
                s1.head = next1

            if s2_next_die:
                respawn(s2)
                target_dir_2 = s2.direct
            else:
                s2.body.insert(0, s2.head.copy())
                s2.head = next2

            # 吃食物：增长（不弹尾）+ 加分
            ate1 = (not s1_next_die) and (s1.head == food)
            ate2 = (not s2_next_die) and (s2.head == food)

            if ate1:
                s1.score += 1
            else:
                if not s1_next_die and s1.body:
                    s1.body.pop()

            if ate2:
                s2.score += 1
            else:
                if not s2_next_die and s2.body:
                    s2.body.pop()

            if ate1 or ate2:
                occ = occupied_all()
                food = _gen_food(occ)

            # Draw
            screen.fill(BG_COLOR)
            for w in walls:
                pygame.draw.rect(
                    screen,
                    WALL_COLOR,
                    (w.col * CELL_W, w.row * CELL_H, CELL_W, CELL_H),
                )
            if _in_bounds(food):
                pygame.draw.rect(
                    screen,
                    FOOD_COLOR,
                    (food.col * CELL_W, food.row * CELL_H, CELL_W, CELL_H),
                )

            # Snake 1
            s1_head_c, s1_body_c = snake1_colors
            pygame.draw.rect(
                screen,
                s1_head_c,
                (s1.head.col * CELL_W, s1.head.row * CELL_H, CELL_W, CELL_H),
            )
            for seg in s1.body:
                pygame.draw.rect(
                    screen,
                    s1_body_c,
                    (seg.col * CELL_W, seg.row * CELL_H, CELL_W, CELL_H),
                )

            # Snake 2
            s2_head_c, s2_body_c = snake2_colors
            pygame.draw.rect(
                screen,
                s2_head_c,
                (s2.head.col * CELL_W, s2.head.row * CELL_H, CELL_W, CELL_H),
            )
            for seg in s2.body:
                pygame.draw.rect(
                    screen,
                    s2_body_c,
                    (seg.col * CELL_W, seg.row * CELL_H, CELL_W, CELL_H),
                )

            hud_left = font_small.render(
                f"{mode_title}  Round {round_idx}/3  Time {time_left:0.1f}s",
                True,
                HUD_INFO_COLOR,
            )
            screen.blit(hud_left, (10, 10))

            hud_mid = font_big.render(f"P1 {s1.score} : {s2.score} P2", True, HUD_SCORE_COLOR)
            screen.blit(hud_mid, hud_mid.get_rect(midtop=(WIDTH // 2, 40)))

            hud_match = font_small.render(f"Match  P1 {match_p1} - {match_p2} P2", True, HUD_INFO_COLOR)
            screen.blit(hud_match, (10, 40))

            exit_btn.draw(screen)
            pygame.display.flip()
            clock.tick(15)

        # 结算本局大比分
        if s1.score > s2.score:
            match_p1 += 1
        elif s2.score > s1.score:
            match_p2 += 1
        else:
            match_p1 += 1
            match_p2 += 1

        # 局间短暂停留（仍可退出）
        pause_until = pygame.time.get_ticks() + 3000
        while pygame.time.get_ticks() < pause_until:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return
                if exit_btn.is_clicked(event):
                    return
                if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    return
            screen.fill(BG_COLOR)
            msg = font_big.render(
                f"Round {round_idx} Over  |  Match {match_p1}-{match_p2}",
                True,
                HUD_SCORE_COLOR,
            )
            screen.blit(msg, msg.get_rect(center=(WIDTH // 2, HEIGHT // 2)))
            exit_btn.draw(screen)
            pygame.display.flip()
            clock.tick(30)


def _blit_algo_label(
    screen: pygame.Surface,
    font: pygame.font.Font,
    text: str,
    head: Point,
) -> None:
    """在蛇头旁固定标注算法名称（靠右；贴边则改到左侧）。"""
    px = head.col * CELL_W
    py = head.row * CELL_H
    fg = (255, 255, 255)
    outline = (0, 0, 0)
    surf = font.render(text, True, fg)
    w, h = surf.get_size()
    off_x = CELL_W + 4
    if px + off_x + w > WIDTH - 6:
        off_x = -w - 6
    tx = max(2, min(WIDTH - w - 2, px + off_x))
    ty = max(2, min(HEIGHT - h - 2, py + max(0, (CELL_H - h) // 2)))
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        o = font.render(text, True, outline)
        screen.blit(o, (tx + dx, ty + dy))
    screen.blit(surf, (tx, ty))


def run_ai_brawl_match(
    screen: pygame.Surface,
    *,
    mode_title: str,
    participants: list[
        tuple[
            Point,
            tuple[tuple[int, int, int], tuple[int, int, int]],
            str,
            ActionProvider,
        ]
    ],
) -> None:
    """
    多 AI 混战：规则与双人/Play vs AI 一致（3 局×30 秒、死亡复活、头对头同死、大比分结算）。
    participants: (出生点, (头色, 身色), 显示用算法名, 控制器)
    """
    clock = pygame.time.Clock()
    font_big = pygame.font.SysFont(None, 40)
    font_small = pygame.font.SysFont(None, 22)
    font_label = pygame.font.SysFont(None, 22)

    exit_btn = Button(
        pygame.Rect(WIDTH - 120, 10, 110, 36),
        "Exit",
        font_small,
        bg=(200, 60, 60),
        hover_bg=(220, 80, 80),
        border=(255, 255, 255),
        radius=8,
    )

    snakes: list[Snake] = [Snake.create(sp) for sp, _c, _l, _p in participants]
    colors = [c for _sp, c, _l, _p in participants]
    labels = [lab for _sp, _c, lab, _p in participants]
    controllers = [ctl for _sp, _c, _l, ctl in participants]
    n = len(snakes)
    match_scores = [0] * n

    def round_reset() -> tuple[list[Point], Point]:
        avoid: set[tuple[int, int]] = set()
        for s in snakes:
            avoid |= s.occupied()
        walls = _generate_walls(avoid)
        occ = set(avoid)
        for w in walls:
            occ.add((w.row, w.col))
        food = _gen_food(occ)
        return walls, food

    def respawn(s: Snake) -> None:
        blocked = occupied_all() - s.occupied()
        if _in_bounds(food):
            blocked.add((food.row, food.col))
        s.head = _nearest_free_cell(s.spawn, blocked)
        s.body = []
        s.direct = "left"
        s.score = 0

    def occupied_all() -> set[tuple[int, int]]:
        occ: set[tuple[int, int]] = set()
        for s in snakes:
            occ |= s.occupied()
        for w in walls:
            occ.add((w.row, w.col))
        return occ

    walls, food = round_reset()

    for round_idx in range(1, 4):
        for s in snakes:
            s.reset()
        walls, food = round_reset()

        start_ticks = pygame.time.get_ticks()
        round_over = False

        while not round_over:
            now = pygame.time.get_ticks()
            elapsed_s = (now - start_ticks) / 1000.0
            time_left = max(0.0, 30.0 - elapsed_s)
            if time_left <= 0.0:
                round_over = True

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return
                if exit_btn.is_clicked(event):
                    return
                if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    return

            actions: list[list[int]] = []
            for i in range(n):
                opp: set[tuple[int, int]] = set()
                for j in range(n):
                    if j != i:
                        opp |= snakes[j].occupied()
                gl = _GameLikeForAI(
                    head=snakes[i].head,
                    direct=snakes[i].direct,
                    food=food,
                    walls=walls,
                    body=snakes[i].body,
                    opponent_occupied=opp,
                )
                actions.append(controllers[i].next_action(gl))

            for i in range(n):
                snakes[i].direct = _turn_dir(snakes[i].direct, actions[i])

            next_heads = [_step_from_dir(snakes[i].head, snakes[i].direct) for i in range(n)]
            wall_occ = {(w.row, w.col) for w in walls}

            def would_die(
                next_head: Point,
                self_body: set[tuple[int, int]],
                other_occ_all: set[tuple[int, int]],
            ) -> bool:
                if not _in_bounds(next_head):
                    return True
                if (next_head.row, next_head.col) in wall_occ:
                    return True
                if (next_head.row, next_head.col) in self_body:
                    return True
                if (next_head.row, next_head.col) in other_occ_all:
                    return True
                return False

            die = [False] * n
            for i in range(n):
                self_body = {(p.row, p.col) for p in snakes[i].body[:-1]}
                other: set[tuple[int, int]] = set()
                for j in range(n):
                    if j != i:
                        other |= snakes[j].occupied()
                if would_die(next_heads[i], self_body, other):
                    die[i] = True

            cell_to: dict[tuple[int, int], list[int]] = {}
            for i in range(n):
                nh = next_heads[i]
                key = (nh.row, nh.col)
                cell_to.setdefault(key, []).append(i)
            for _cell, idxs in cell_to.items():
                if len(idxs) >= 2:
                    for i in idxs:
                        die[i] = True

            for i in range(n):
                if die[i]:
                    respawn(snakes[i])
                else:
                    snakes[i].body.insert(0, snakes[i].head.copy())
                    snakes[i].head = next_heads[i]

            ate_any = False
            for i in range(n):
                if die[i]:
                    continue
                if snakes[i].head == food:
                    snakes[i].score += 1
                    ate_any = True
                else:
                    if snakes[i].body:
                        snakes[i].body.pop()

            if ate_any:
                food = _gen_food(occupied_all())

            screen.fill(BG_COLOR)
            for w in walls:
                pygame.draw.rect(
                    screen,
                    WALL_COLOR,
                    (w.col * CELL_W, w.row * CELL_H, CELL_W, CELL_H),
                )
            if _in_bounds(food):
                pygame.draw.rect(
                    screen,
                    FOOD_COLOR,
                    (food.col * CELL_W, food.row * CELL_H, CELL_W, CELL_H),
                )

            for i in range(n):
                hc, bc = colors[i]
                pygame.draw.rect(
                    screen,
                    hc,
                    (snakes[i].head.col * CELL_W, snakes[i].head.row * CELL_H, CELL_W, CELL_H),
                )
                for seg in snakes[i].body:
                    pygame.draw.rect(
                        screen,
                        bc,
                        (seg.col * CELL_W, seg.row * CELL_H, CELL_W, CELL_H),
                    )
                _blit_algo_label(screen, font_label, labels[i], snakes[i].head)

            hud_left = font_small.render(
                f"{mode_title}  Round {round_idx}/3  Time {time_left:0.1f}s",
                True,
                HUD_INFO_COLOR,
            )
            screen.blit(hud_left, (10, 10))

            score_parts = [f"{labels[j][:8]}:{snakes[j].score}" for j in range(n)]
            hud_mid = font_big.render("  ".join(score_parts), True, HUD_SCORE_COLOR)
            screen.blit(hud_mid, hud_mid.get_rect(midtop=(WIDTH // 2, 38)))

            match_parts = [f"{labels[j][:6]}:{match_scores[j]}" for j in range(n)]
            hud_match = font_small.render("Match  " + "  ".join(match_parts), True, HUD_INFO_COLOR)
            screen.blit(hud_match, (10, 36))

            exit_btn.draw(screen)
            pygame.display.flip()
            clock.tick(15)

        scores = [snakes[i].score for i in range(n)]
        mx = max(scores)
        winners = [i for i, v in enumerate(scores) if v == mx]
        if len(winners) == 1:
            match_scores[winners[0]] += 1
        else:
            for i in winners:
                match_scores[i] += 1

        pause_until = pygame.time.get_ticks() + 3000
        while pygame.time.get_ticks() < pause_until:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return
                if exit_btn.is_clicked(event):
                    return
                if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    return
            screen.fill(BG_COLOR)
            msg = font_big.render(
                f"Round {round_idx} Over  |  Match: " + " ".join(f"{labels[i]}:{match_scores[i]}" for i in range(n)),
                True,
                HUD_SCORE_COLOR,
            )
            if msg.get_width() > WIDTH - 20:
                msg = font_small.render(
                    f"Round {round_idx} Over  |  Match " + str(match_scores),
                    True,
                    HUD_SCORE_COLOR,
                )
            screen.blit(msg, msg.get_rect(center=(WIDTH // 2, HEIGHT // 2)))
            exit_btn.draw(screen)
            pygame.display.flip()
            clock.tick(30)
