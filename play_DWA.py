import pygame
import sys
import math
from game_env import SnakeGameAI, Point, ROW, COL


# ------------------------------------------------------------
#  DWA（动态窗口法）应用于贪吃蛇
# ------------------------------------------------------------
# 思路：每一步，蛇有三种可能的动作（直走、右转、左转）。
# 将每个动作看作一个候选“速度指令”，评估其对应的下一位置：
#   - heading：     新位置离食物有多近
#   - clearance：   新位置周围的障碍物距离（安全性）
#   - velocity：    鼓励直走，减少无用转弯
# 加权求和后选择得分最高的动作，即为 DWA 决策。
# ------------------------------------------------------------

def _is_collision_ignore_tail(game, pt):
    """
    判断 pt 是否会撞墙、越界或撞到蛇身（忽略蛇尾，因为移动后尾部会缩进）。
    这样评估更准确，避免因尾巴暂时占据而误判为危险方向。
    """
    # 越界
    if pt.row < 0 or pt.row >= ROW or pt.col < 0 or pt.col >= COL:
        return True
    # 撞墙
    for w in game.walls:
        if pt.row == w.row and pt.col == w.col:
            return True
    # 撞蛇身（忽略尾巴，除非蛇身长度 <= 1 即没有尾巴）
    snakes = game.snakes
    if len(snakes) <= 1:
        # 没有身体或只有一段，按正常碰撞检查
        for s in snakes:
            if pt.row == s.row and pt.col == s.col:
                return True
        return False

    tail = snakes[-1]  # 当前尾巴位置
    for i, s in enumerate(snakes):
        # 忽略尾巴位置（移动后它会离开）
        if i == len(snakes) - 1 and s.row == tail.row and s.col == tail.col:
            continue
        if pt.row == s.row and pt.col == s.col:
            return True
    return False


def _min_obstacle_distance(game, pt):
    """
    计算 pt 到所有障碍物（墙壁 + 除尾巴外的蛇身）的最小曼哈顿距离。
    用于 clearance 评价，距离越远越安全。
    """
    min_dist = float('inf')

    # 到所有墙壁的距离
    for w in game.walls:
        d = abs(pt.row - w.row) + abs(pt.col - w.col)
        if d < min_dist:
            min_dist = d

    # 到蛇身（忽略尾巴）的距离
    snakes = game.snakes
    if len(snakes) > 1:
        tail = snakes[-1]
        for i, s in enumerate(snakes):
            if i == len(snakes) - 1 and s.row == tail.row and s.col == tail.col:
                continue  # 忽略尾巴
            d = abs(pt.row - s.row) + abs(pt.col - s.col)
            if d < min_dist:
                min_dist = d
    elif len(snakes) == 1:
        # 蛇身只有一段，检查它（它也是尾巴，但移动后不会立即消失？实际上移动前身体只有1段，
        # 移动时先插入head副本，然后移动head，再判断是否吃食物，最后pop或不pop。
        # 如果蛇身长度为1，移动后一定会pop（除非吃食物），所以它也会消失。
        # 保守起见我们仍然占用，但为了安全可以忽略，因为吃食物时尾巴不消失但食物不在身体上。
        # 这里选择忽略它，保持与 ignore_tail 逻辑一致。
        pass
    # 注意：边界也看作障碍物，但 pt 已在网格内，不处理。

    return min_dist


def dwa_decision(game, alpha=2.0, beta=1.0, gamma=0.5):
    """
    根据动态窗口法选择贪吃蛇的下一步动作。

    参数：
        game : SnakeGameAI 实例
        alpha, beta, gamma : 评价函数权重

    返回：
        action : [直走, 右转, 左转]  e.g. [1,0,0]
    """
    head = game.head
    direction = game.direct
    food = game.food

    # 方向映射（顺时针顺序）
    clock_wise = ['right', 'down', 'left', 'up']
    idx = clock_wise.index(direction)

    # 三个候选动作：[直走, 右转, 左转]
    action_list = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ]

    best_action = [1, 0, 0]  # 默认直走
    best_score = -float('inf')

    for action, act_vec in zip(['straight', 'right', 'left'], action_list):
        # 计算新方向
        if act_vec[1] == 1:      # 右转
            new_dir = clock_wise[(idx + 1) % 4]
        elif act_vec[2] == 1:    # 左转
            new_dir = clock_wise[(idx - 1) % 4]
        else:                    # 直走
            new_dir = direction

        # 计算新蛇头位置
        new_head = head.copy()
        if new_dir == 'left':
            new_head.col -= 1
        elif new_dir == 'right':
            new_head.col += 1
        elif new_dir == 'up':
            new_head.row -= 1
        elif new_dir == 'down':
            new_head.row += 1

        # 如果新位置会撞障碍物（忽略尾巴），直接跳过该动作
        if _is_collision_ignore_tail(game, new_head):
            continue

        # ----- 评价指标 -----
        # 1. heading：朝向食物，距离越近分数越高
        dist_to_food = math.hypot(new_head.row - food.row, new_head.col - food.col)
        heading_score = 1.0 / (dist_to_food + 0.1)   # 避免除零

        # 2. clearance：到最近障碍物的曼哈顿距离，归一化到 [0, 1]
        min_obs_dist = _min_obstacle_distance(game, new_head)
        clearance_score = min(1.0, min_obs_dist / 5.0)   # 5格以上视为满分

        # 3. velocity：鼓励直走，减少多余转弯
        velocity_score = 1.0 if action == 'straight' else 0.8

        # 加权总分
        total_score = alpha * heading_score + beta * clearance_score + gamma * velocity_score

        if total_score > best_score:
            best_score = total_score
            best_action = act_vec

    return best_action


# ------------------------------------------------------------
#  主运行循环
# ------------------------------------------------------------
def main():
    game = SnakeGameAI(is_training=False)  # 非训练模式，正常速度显示
    game.reset()

    print("DWA 贪吃蛇自动运行中... 关闭窗口或按 ESC 退出。")

    running = True
    while running:
        # 1. DWA 决策下一步动作
        action = dwa_decision(game)

        # 2. 执行动作
        reward, game_over, score = game.play_step(action)

        if game_over:
            print(f"游戏结束！最终得分: {score}")
            game.reset()
            print("新一局开始...")

        # 处理退出事件
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