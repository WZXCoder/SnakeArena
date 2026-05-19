import pygame
import sys
import random
import math
from game_env import SnakeGameAI, Point, ROW, COL


# ------------------------------------------------------------
#  RRT* 树节点（网格版）
# ------------------------------------------------------------
class RRTStarNode:
    """RRT* 树节点，保存网格坐标、父节点以及从起点到该节点的代价"""
    def __init__(self, row, col, parent=None, cost=0):
        self.row = row
        self.col = col
        self.parent = parent      # 父节点引用，用于回溯路径
        self.cost = cost          # 从起始节点到当前节点的累计步数

    def pos(self):
        return (self.row, self.col)


# ------------------------------------------------------------
#  辅助函数
# ------------------------------------------------------------
def _distance(p1, p2):
    """两个坐标元组之间的欧几里得距离"""
    return math.hypot(p1[0] - p2[0], p1[1] - p2[1])


def _neighbors(row, col):
    """返回 (row, col) 的四个可行走邻居（上、下、左、右）"""
    dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    result = []
    for dr, dc in dirs:
        nr, nc = row + dr, col + dc
        if 0 <= nr < ROW and 0 <= nc < COL:
            result.append((nr, nc))
    return result


def _propagate_cost(node, all_nodes):
    """
    当某个节点的父节点被更改后，递归更新该节点及其所有后代的代价。
    使用队列进行广度优先传播。
    """
    from collections import deque
    queue = deque([node])
    while queue:
        cur = queue.popleft()
        # 计算正确代价：父节点代价 + 1（所有边长度均为 1）
        if cur.parent is not None:
            cur.cost = cur.parent.cost + 1
        else:
            cur.cost = 0
        # 将所有以 cur 为父节点的节点加入队列
        for n in all_nodes:
            if n.parent is cur:
                queue.append(n)


# ------------------------------------------------------------
#  RRT* 路径规划
# ------------------------------------------------------------
def rrt_star_path(start, target, walls, snakes, max_iter=1500, goal_sample_rate=0.1):
    """
    基于网格的 RRT* 算法，寻找从 start 到 target 的最短渐进最优路径。
    障碍物包含墙壁和蛇身（忽略蛇尾，因为蛇移动后尾部会缩进）。
    返回路径点列表（不含起点），找不到则返回 None。
    """
    # ---- 构建障碍物集，并忽略蛇尾 ----
    obstacle_set = set()
    for w in walls:
        obstacle_set.add((w.row, w.col))
    # 蛇身：如果有蛇身，则最后一段为尾巴，规划时可以忽略（它将在这一步移动后消失）
    if len(snakes) > 1:
        ignore_tail = (snakes[-1].row, snakes[-1].col)
    else:
        ignore_tail = None
    for s in snakes:
        pos = (s.row, s.col)
        if ignore_tail and pos == ignore_tail:
            continue
        obstacle_set.add(pos)

    start_pos = (start.row, start.col)
    target_pos = (target.row, target.col)

    # 起点或终点在障碍物中，无法规划
    if start_pos in obstacle_set or target_pos in obstacle_set:
        return None

    # 初始化 RRT* 树
    nodes = [RRTStarNode(start_pos[0], start_pos[1])]
    tree_positions = {start_pos}        # 快速查找已有节点位置
    target_node = None                  # 指向目标的节点

    for i in range(max_iter):
        # ---- 采样：一定概率直接采样目标 ----
        if random.random() < goal_sample_rate:
            sample = target_pos
        else:
            sample = (random.randint(0, ROW - 1), random.randint(0, COL - 1))

        # 采样点在障碍物中则跳过
        if sample in obstacle_set:
            continue

        # ---- 找到树中距离采样点最近的节点 ----
        nearest = min(nodes, key=lambda n: _distance(n.pos(), sample))

        # ---- 从 nearest 向 sample 扩展一步（选择最优邻居） ----
        candidates = []
        for nb in _neighbors(nearest.row, nearest.col):
            if nb in obstacle_set:
                continue
            if nb in tree_positions:        # 避免产生重复位置
                continue
            candidates.append(nb)

        if not candidates:
            continue

        # 选择距离 sample 最近的邻居作为新节点位置
        new_pos = min(candidates, key=lambda p: _distance(p, sample))
        new_row, new_col = new_pos

        # ---- 寻找附近节点（半径为 1，即直接邻居）用于优化父节点 ----
        # 在这一步中，所有树边长度都是 1，所以只看 new_pos 的直接邻居中已属于树的节点
        neighbor_nodes = []
        for nb in _neighbors(new_row, new_col):
            if nb in tree_positions:
                # 找到该位置对应的节点
                for node in nodes:
                    if node.pos() == nb:
                        neighbor_nodes.append(node)
                        break

        # 选择使 new_node 代价最小的父节点
        best_parent = nearest          # 默认使用最近节点
        best_cost = nearest.cost + 1   # 从 nearest 过来代价

        for candidate in neighbor_nodes:
            if candidate.cost + 1 < best_cost:
                best_cost = candidate.cost + 1
                best_parent = candidate

        # 创建新节点并加入树
        new_node = RRTStarNode(new_row, new_col, parent=best_parent, cost=best_cost)
        nodes.append(new_node)
        tree_positions.add(new_pos)

        # ---- 重连：检查邻居节点是否能通过 new_node 获得更小代价 ----
        for neighbor in neighbor_nodes:
            # 不重连 new_node 的父节点（避免循环，且它已经是局部最优）
            if neighbor is best_parent:
                continue
            if new_node.cost + 1 < neighbor.cost:
                # 更新父节点并传播代价
                neighbor.parent = new_node
                _propagate_cost(neighbor, nodes)

        # ---- 检查是否到达目标 ----
        if new_pos == target_pos:
            if target_node is None or new_node.cost < target_node.cost:
                target_node = new_node

    # ---- 规划结束，回溯路径 ----
    if target_node is not None:
        path = []
        cur = target_node
        while cur.parent is not None:
            path.append(Point(cur.row, cur.col))
            cur = cur.parent
        path.reverse()
        return path

    # 超时且未找到目标
    return None


# ------------------------------------------------------------
#  动作选择与安全兜底
# ------------------------------------------------------------
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
    """检查 pt 是否会撞墙、越界或撞到蛇身（忽略蛇尾）"""
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
    当 RRT* 找不到路径时，尝试找一个安全的动作。
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

    print("RRT* 贪吃蛇自动运行中... 关闭窗口或按 ESC 退出。")

    running = True
    while running:
        head = game.head
        snakes = game.snakes
        food = game.food
        walls = game.walls
        direction = game.direct

        # 1. 使用 RRT* 算法寻找从蛇头到食物的路径
        path = rrt_star_path(head, food, walls, snakes)

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