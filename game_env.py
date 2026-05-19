import pygame
import random

WIDTH = 1200
HEIGHT = 600
ROW = 30
COL = 60
CELL_W = int(WIDTH / COL)
CELL_H = int(HEIGHT / ROW)

# 固定颜色
BG_COLOR = (255, 255, 255)
SNAKE_BODY_COLOR = (0, 255, 0)
SNAKE_HEAD_COLOR = (255, 0, 0)
FOOD_COLOR = (255, 165, 0)
WALL_COLOR = (0, 0, 0)
BLACK = (0, 0, 0)

# 游戏初始速度档位
BASE_SPEED = 10
SPEED_INCREASE = 5
MAX_SPEED = 30

class Point:
    def __init__(self, row, col):
        self.row = row
        self.col = col
    def copy(self):
        return Point(self.row, self.col)
    def __eq__(self, other):
        if not isinstance(other, Point):
            return False
        return self.row == other.row and self.col == other.col

class SnakeGameAI:
    def __init__(self, is_training=True):
        pygame.init()
        self.font_big = pygame.font.SysFont(None, 100)
        self.font_small = pygame.font.SysFont(None, 30)
        self.window = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption('强化学习贪吃蛇')
        self.clock = pygame.time.Clock()
        self.is_training = is_training
        self.reset()

    def reset(self):
        self.head = Point(row=ROW // 2, col=COL // 2)
        self.snakes = []
        self.score = 0
        self.direct = 'left'
        self.walls = self._generate_walls()
        self.food = self._gen_food()
        self.frame_iteration = 0
        return self.score

    def _generate_walls(self):
        total_cells = ROW * COL
        num_walls = int(total_cells * 0.01)
        walls = []
        candidates = [Point(r, c) for r in range(ROW) for c in range(COL) if not (r == self.head.row and c == self.head.col)]
        selected = random.sample(candidates, min(num_walls, len(candidates)))
        walls.extend(selected)
        return walls

    def _gen_food(self):
        occupied = {(self.head.row, self.head.col)}
        occupied.update((s.row, s.col) for s in self.snakes)
        occupied.update((w.row, w.col) for w in self.walls)
        candidates = [
            (r, c)
            for r in range(ROW)
            for c in range(COL)
            if (r, c) not in occupied
        ]
        if not candidates:
            return self.head.copy()
        r, c = random.choice(candidates)
        return Point(r, c)

    def is_collision(self, pt=None, ignore_tail=False):
        if pt is None:
            pt = self.head
        # 撞墙或越界
        if pt.col < 0 or pt.row < 0 or pt.col >= COL or pt.row >= ROW:
            return True
        if pt in self.walls:
            return True
        snakes = self.snakes[:-1] if ignore_tail and self.snakes else self.snakes
        if pt in snakes:
            return True
        return False

    def play_step(self, action, process_events=True):
        self.frame_iteration += 1
        if process_events:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return -10, True, self.score

        # [直走, 右转, 左转]
        clock_wise = ['right', 'down', 'left', 'up']
        idx = clock_wise.index(self.direct)

        if action[1] == 1:
            self.direct = clock_wise[(idx + 1) % 4] # 右转
        elif action[2] == 1:
            self.direct = clock_wise[(idx - 1) % 4] # 左转

        # 移动蛇头
        self.snakes.insert(0, self.head.copy())
        if self.direct == 'left':
            self.head.col -= 1
        elif self.direct == 'right':
            self.head.col += 1
        elif self.direct == 'up':
            self.head.row -= 1
        elif self.direct == 'down':
            self.head.row += 1

        reward = 0
        game_over = False

        # 死亡判定 (加入超时判定，防止AI无限绕圈不吃食物)
        if self.is_collision(ignore_tail=True) or self.frame_iteration > 100 * len(self.snakes) + 100:
            game_over = True
            reward = -10
            return reward, game_over, self.score

        # 吃食物判定
        ate_food = (self.head == self.food)
        if ate_food:
            self.food = self._gen_food()
            self.score += 1
            reward = 10
            # 已移除音效代码
        else:
            self.snakes.pop()

        self._update_ui()
        
        # 控制帧率
        if self.is_training:
            self.clock.tick(100) # 训练时全速运行
        else:
            # 测试时使用你原有的阶梯速度
            speed = BASE_SPEED + (self.score // 10) * SPEED_INCREASE
            self.clock.tick(min(speed, MAX_SPEED))

        return reward, game_over, self.score

    def _update_ui(self):
        self.window.fill(BG_COLOR)
        for w in self.walls:
            self._draw_rect(w, WALL_COLOR)
        for seg in self.snakes:
            self._draw_rect(seg, SNAKE_BODY_COLOR)
        self._draw_rect(self.head, SNAKE_HEAD_COLOR)
        self._draw_rect(self.food, FOOD_COLOR)

        score_surface = self.font_small.render(f"Score: {self.score}", True, BLACK)
        self.window.blit(score_surface, (10, 10))
        pygame.display.flip()

    def _draw_rect(self, point, color):
        left = point.col * CELL_W
        top = point.row * CELL_H
        pygame.draw.rect(self.window, color, (left, top, CELL_W, CELL_H))