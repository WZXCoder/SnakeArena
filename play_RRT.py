import pygame
import sys
import random
import math
from game_env import SnakeGameAI, Point, ROW, COL


# ------------------------------------------------------------
#  RRT 算法（网格版）
# ------------------------------------------------------------
class RRTNode:
    """RRT 树节点，保存网格坐标和父节点索引"""
    def __init__(self, row, col, parent=None):
        self.row = row
        self.col = col
        self.parent = parent  # 父节点引用，用于回溯路径

    def pos(self):
        return (self.row, self.col)


def _distance(p1, p2):
    """欧几里得距离（两个坐标元组）"""
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])


def _neighbors(row, col):
    """返回四个可行走邻居（上、下、左、右）"""
    dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    result = []
    for dr, dc in dirs:
        nr, nc = row + dr, col + dc
        if 0 <= nr < ROW and 0 <= nc < COL:
            result.append((nr, nc))
    return result


def rrt_path(start, target, walls, snakes, max_iter=1500, goal_sample_rate=0.1):
    """
    基于网格的快速随机扩展树 (RRT)，寻找从 start 到 target 的路径。
    障碍物：walls 和 snakes 占据的格子。
    返回路径点列表（不含起点），找不到则返回 None。
    """
    # 构建障碍物集
    obstacle_set = set()
    for w in walls:
        obstacle_set.add((w.row, w.col))
    for s in snakes:
        obstacle_set.add((s.row, s.col))

    start_pos = (start.row, start.col)
    target_pos = (target.row, target.col)

    # 起点或终点在障碍物中，无法规划
    if start_pos in obstacle_set or target_pos in obstacle_set:
        return None

    # 初始化树，只包含起始节点
    nodes = [RRTNode(start_pos[0], start_pos[1])]  # 列表存储所有节点
    tree_positions = {start_pos}  # 快速查找已存在的节点位置

    for _ in range(max_iter):
        # ---- 采样：10% 概率直接采样目标 ----
        if random.random() < goal_sample_rate:
            sample = target_pos
        else:
            sample = (random.randint(0, ROW - 1), random.randint(0, COL - 1))

        # 如果采样点就是障碍物，跳过
        if sample in obstacle_set:
            continue

        # ---- 找到树中距离采样点最近的节点 ----
        nearest = min(nodes, key=lambda n: _distance(n.pos(), sample))

        # ---- 从 nearest 向 sample 扩展一步（选择最佳邻居） ----
        # 计算 nearest 的所有空闲邻居到 sample 的距离，选择最近的作为新节点
        candidates = []
        for nb in _neighbors(nearest.row, nearest.col):
            if nb in obstacle_set:
                continue
            if nb in tree_positions:  # 避免重复节点（保持树结构简单）
                continue
            candidates.append(nb)

        if not candidates:
            # 所有邻居都被占据或已在树中，该采样点扩展失败
            continue

        # 选择距离 sample 最近的邻居作为新节点
        new_pos = min(candidates, key=lambda p: _distance(p, sample))
        new_node = RRTNode(new_pos[0], new_pos[1], parent=nearest)
        nodes.append(new_node)
        tree_positions.add(new_pos)

        # ---- 检查是否到达目标 ----
        if new_pos == target_pos:
            # 回溯构造路径（不含起点）
            path = []
            cur = new_node
            while cur.parent is not None:
                path.append(Point(cur.row, cur.col))
                cur = cur.parent
            path.reverse()
            return path

    # 超过最大迭代次数，规划失败
    return None



def get_action_from_path(head, next_point, current_direction):
    """根据路径的下一个点，返回动作列表 [直走, 右转, 左转]"""
    dr = next_point.row - head.row
    dc = next_point.col - head.col

    if dr == -1 and dc == 0:
        target_dir = 'up'
    elif dr == 1 and dc == 0:
        target_dir = 'down'
    elif dr == 0 and dc == -1:
        target_dir = 'left'
    elif dr == 0 and dc == 1:
        target_dir = 'right'
    else:
        raise ValueError(f"非法移动: 从 {(head.row, head.col)} 到 {(next_point.row, next_point.col)}")

    clock_wise = ['right', 'down', 'left', 'up']
    idx = clock_wise.index(current_direction)

    if target_dir == current_direction:
        return [1, 0, 0]  # 直走
    elif target_dir == clock_wise[(idx + 1) % 4]:
        return [0, 1, 0]  # 右转
    elif target_dir == clock_wise[(idx - 1) % 4]:
        return [0, 0, 1]  # 左转
    else:
        return [1, 0, 0]  # 兜底（理论上不会反向）


def _is_collision_ignore_tail(game, pt):
    """检查 pt 是否会撞墙、越界或撞到蛇身（忽略蛇尾，因为移动后尾巴会缩进）"""
    if pt.row < 0 or pt.row >= ROW or pt.col < 0 or pt.col >= COL:
        return True
    for w in game.walls:
        if pt.row == w.row and pt.col == w.col:
            return True

    snakes = game.snakes
    tail = snakes[-1] if len(snakes) > 0 else None
    for s in snakes:
        if tail and s.row == tail.row and s.col == tail.col:
            continue
        if pt.row == s.row and pt.col == s.col:
            return True
    return False


def safe_random_action(game):
    """
    当 RRT 找不到路径时，尝试找一个安全的动作。
    优先直走，其次右转、左转。
    """
    head = game.head
    direction = game.direct
    clock_wise = ['right', 'down', 'left', 'up']
    idx = clock_wise.index(direction)

    test_actions = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    for act in test_actions:
        if act[1] == 1:
            new_dir = clock_wise[(idx + 1) % 4]
        elif act[2] == 1:
            new_dir = clock_wise[(idx - 1) % 4]
        else:
            new_dir = direction

        new_head = head.copy()
        if new_dir == 'left':
            new_head.col -= 1
        elif new_dir == 'right':
            new_head.col += 1
        elif new_dir == 'up':
            new_head.row -= 1
        elif new_dir == 'down':
            new_head.row += 1

        if not _is_collision_ignore_tail(game, new_head):
            return act

    # 所有方向都会死，返回直走（游戏将结束）
    return [1, 0, 0]


# ------------------------------------------------------------
#  主程序
# ------------------------------------------------------------
def main():
    game = SnakeGameAI(is_training=False)
    game.reset()

    print("RRT 贪吃蛇自动运行中... 关闭窗口或按 ESC 退出。")

    running = True
    while running:
        head = game.head
        snakes = game.snakes
        food = game.food
        walls = game.walls
        direction = game.direct

        # 1. 使用 RRT 算法寻找从蛇头到食物的路径
        path = rrt_path(head, food, walls, snakes)

        if path is not None and len(path) > 0:
            # 有路径，按路径的第一个节点决策
            next_pt = path[0]
            action = get_action_from_path(head, next_pt, direction)
        else:
            # 无路径，执行安全探索（考虑尾部缩进）
            action = safe_random_action(game)

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