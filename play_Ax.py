import pygame
import sys
import heapq
from game_env import SnakeGameAI, Point, ROW, COL


def astar_path(start, target, walls, snakes, ignore_tail=True):
    """
    使用 A* 算法在网格中寻找从 start 到 target 的最短路径。
    避开墙壁(walls)和当前蛇身(snakes)。
    如果 ignore_tail 为 True，则忽略蛇尾（因为移动后尾巴会缩进）。
    启发函数采用曼哈顿距离。
    返回路径点列表（不含起点），找不到则返回 None。
    """
    # 构建障碍物集合
    obstacle_set = set()
    for w in walls:
        obstacle_set.add((w.row, w.col))
    for s in snakes:
        obstacle_set.add((s.row, s.col))

    # 忽略蛇尾（如果蛇身长度 > 0 且开启忽略）
    if ignore_tail and len(snakes) > 0:
        tail = snakes[-1]
        obstacle_set.discard((tail.row, tail.col))

    # 如果目标点在障碍物中，直接返回 None
    if (target.row, target.col) in obstacle_set:
        return None

    start_pos = (start.row, start.col)
    target_pos = (target.row, target.col)

    # 启发函数：曼哈顿距离
    def heuristic(pos):
        return abs(pos[0] - target_pos[0]) + abs(pos[1] - target_pos[1])

    # 优先队列，存放 (f_score, g_score, row, col)
    # f_score = g_score + heuristic
    start_g = 0
    start_f = start_g + heuristic(start_pos)
    pq = [(start_f, start_g, start_pos[0], start_pos[1])]

    # g_score 字典：记录从起点到每个格子的最短距离
    g_score = {start_pos: 0}
    # 父节点字典，用于回溯路径
    parent = {}

    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]

    while pq:
        f, cur_g, r, c = heapq.heappop(pq)

        # 懒惰删除：如果当前 g 大于已记录的 g_score，跳过
        if cur_g > g_score.get((r, c), float('inf')):
            continue

        # 到达目标，回溯构建路径（不含起点）
        if (r, c) == target_pos:
            path = []
            cur = (r, c)
            while cur != start_pos:
                path.append(Point(cur[0], cur[1]))
                cur = parent[cur]
            path.reverse()
            return path

        # 探索四个邻居
        for dr, dc in directions:
            nr, nc = r + dr, c + dc
            if 0 <= nr < ROW and 0 <= nc < COL:
                neighbor = (nr, nc)
                if neighbor in obstacle_set:
                    continue

                # 移动到邻居的代价为 1
                new_g = cur_g + 1

                if new_g < g_score.get(neighbor, float('inf')):
                    g_score[neighbor] = new_g
                    f_score = new_g + heuristic(neighbor)
                    parent[neighbor] = (r, c)
                    heapq.heappush(pq, (f_score, new_g, nr, nc))

    # 未找到路径
    return None


def get_action_from_path(head, next_point, current_direction):
    """
    根据当前蛇头位置和路径的下一个点，返回动作列表 [直走, 右转, 左转]。
    """
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
        raise ValueError(f"非法移动: 从 {head.row, head.col} 到 {next_point.row, next_point.col}")

    clock_wise = ['right', 'down', 'left', 'up']
    idx = clock_wise.index(current_direction)

    if target_dir == current_direction:
        return [1, 0, 0]          # 直走
    elif target_dir == clock_wise[(idx + 1) % 4]:
        return [0, 1, 0]          # 右转
    elif target_dir == clock_wise[(idx - 1) % 4]:
        return [0, 0, 1]          # 左转
    else:
        # 理论上不会出现反向，若出现则默认直走
        return [1, 0, 0]


def _is_collision_ignore_tail(game, pt):
    """
    检查 pt 是否会撞墙、越界或撞到蛇身（忽略蛇尾，因为移动后尾巴会缩进）。
    """
    if pt.row < 0 or pt.row >= ROW or pt.col < 0 or pt.col >= COL:
        return True
    for w in game.walls:
        if pt.row == w.row and pt.col == w.col:
            return True

    snakes = game.snakes
    if len(snakes) > 0:
        tail = snakes[-1]
    else:
        tail = None
    for s in snakes:
        if tail and s.row == tail.row and s.col == tail.col:
            continue
        if pt.row == s.row and pt.col == s.col:
            return True
    return False


def safe_random_action(game):
    """
    当没有找到路径时，尝试找一个安全的动作（不碰撞墙壁和当前蛇身，考虑尾部缩进）。
    优先尝试直走，其次右转、左转。
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


def main():
    # 创建游戏实例，is_training=False 让帧率随得分变化，便于观察
    game = SnakeGameAI(is_training=False)
    game.reset()

    print("A* 贪吃蛇自动运行中... 关闭窗口或按 ESC 退出。")

    running = True
    while running:
        head = game.head
        snakes = game.snakes
        food = game.food
        walls = game.walls
        direction = game.direct

        # 1. 使用 A* 算法寻找从蛇头到食物的最短路径
        path = astar_path(head, food, walls, snakes)

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

        # 处理退出事件（窗口关闭或按 ESC）
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