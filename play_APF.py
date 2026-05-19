import pygame
import sys
import math
from game_env import SnakeGameAI, Point, ROW, COL

# ===========================
# APF 参数（可调整）
# ===========================
K_ATT = 1.0          # 引力系数
K_REP = 10.0         # 斥力系数
D0 = 3.0             # 斥力影响距离（障碍物超过此距离忽略）
INF = float('inf')

# 方向向量映射 (row, col)
DIR_VEC = {
    'up':    (-1,  0),
    'down':  ( 1,  0),
    'left':  ( 0, -1),
    'right': ( 0,  1)
}

def distance(p1, p2):
    """计算两个点或坐标元组的欧几里得距离"""
    if isinstance(p1, Point):
        r1, c1 = p1.row, p1.col
    else:
        r1, c1 = p1
    if isinstance(p2, Point):
        r2, c2 = p2.row, p2.col
    else:
        r2, c2 = p2
    return math.hypot(r1 - r2, c1 - c2)

def attractive_potential(pos, food, k_att=K_ATT):
    """引力势场：与食物距离成线性正比，距离越近势能越低，吸引蛇向食物移动"""
    d = distance(pos, food)
    return k_att * d

def repulsive_potential(pos, obstacles, k_rep=K_REP, d0=D0):
    """
    斥力势场：障碍物（墙壁、蛇身）在 d0 范围内产生排斥。
    采用经典 APF 斥力函数：U = 0.5 * k_rep * (1/d - 1/d0)^2
    """
    U = 0.0
    for obs in obstacles:
        d = distance(pos, obs)
        if d == 0:
            return INF          # 与障碍物重合，不可行走
        if d < d0:
            U += 0.5 * k_rep * (1.0/d - 1.0/d0) ** 2
    return U

def total_potential(pos, food, walls, snakes):
    """计算某位置的势场总值 = 引力势场 + 斥力势场"""
    obstacles = []
    # 墙壁
    for w in walls:
        obstacles.append((w.row, w.col))
    # 蛇身（全部视作障碍，包括尾部）
    for s in snakes:
        obstacles.append((s.row, s.col))
    return attractive_potential(pos, food) + repulsive_potential(pos, obstacles)

def is_safe(pos, walls, snakes):
    """检查坐标是否在网格内且不是墙壁或蛇身"""
    r, c = pos
    if r < 0 or r >= ROW or c < 0 or c >= COL:
        return False
    # 墙壁检查
    for w in walls:
        if w.row == r and w.col == c:
            return False
    # 蛇身检查（这里蛇身包括除蛇头外的所有身体段）
    for s in snakes:
        if s.row == r and s.col == c:
            return False
    return True

def choose_action_apf(game):
    """
    根据当前游戏状态，计算蛇头前方、左方、右方三个候选格子的势场值，
    选择势场最小的安全格子，并返回对应的动作 [直走, 右转, 左转]。
    """
    head = game.head
    direction = game.direct
    food = game.food
    walls = game.walls
    snakes = game.snakes

    # 当前朝向的向量
    front_vec = DIR_VEC[direction]
    dr, dc = front_vec
    # 右转90°（顺时针）：(dc, -dr)
    right_vec = (dc, -dr)
    # 左转90°（逆时针）：(-dc, dr)
    left_vec = (-dc, dr)

    # 三个候选坐标
    front_pos = (head.row + front_vec[0], head.col + front_vec[1])
    right_pos = (head.row + right_vec[0], head.col + right_vec[1])
    left_pos = (head.row + left_vec[0], head.col + left_vec[1])

    # 计算每个候选格子的安全性及势场值
    cand = {}
    if is_safe(front_pos, walls, snakes):
        cand['front'] = total_potential(front_pos, food, walls, snakes)
    if is_safe(right_pos, walls, snakes):
        cand['right'] = total_potential(right_pos, food, walls, snakes)
    if is_safe(left_pos, walls, snakes):
        cand['left'] = total_potential(left_pos, food, walls, snakes)

    # 如果没有安全格子，只能直走（等死）
    if not cand:
        return [1, 0, 0]

    # 选择势场最小的方向，若势场相同则优先保持直走
    best = min(cand, key=lambda k: cand[k])
    if 'front' in cand and cand['front'] == cand[best]:
        best = 'front'          # 平局时优先直走

    # 转换为动作
    if best == 'front':
        return [1, 0, 0]
    elif best == 'right':
        return [0, 1, 0]
    else:  # best == 'left'
        return [0, 0, 1]

def main():
    game = SnakeGameAI(is_training=False)
    game.reset()
    print("APF 人工势场法贪吃蛇运行中... 按 ESC 或关闭窗口退出。")

    running = True
    while running:
        # 使用 APF 决策下一步动作
        action = choose_action_apf(game)

        reward, game_over, score = game.play_step(action)

        if game_over:
            print(f"游戏结束！最终得分: {score}")
            game.reset()
            print("新一局开始...")

        # 事件处理（退出）
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
                break
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                    break

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()