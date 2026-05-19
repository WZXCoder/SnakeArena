from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from game_env import Point, ROW, COL


class _ProxyGame:
    """
    用于“严格复用 play_*.py 原逻辑”的对战适配层：
    - 保留算法所需的最小字段：head/direct/food/walls/snakes
    - 将对手占用格子注入到 walls（而不是 snakes），避免被“忽略尾巴”逻辑误处理
    """

    def __init__(self, base, opponent_occupied: set[tuple[int, int]] | None):
        self.head = base.head
        self.direct = base.direct
        self.food = base.food
        self.snakes = base.snakes
        self._base_walls = list(base.walls)
        self._opp = opponent_occupied or set()
        self.walls = self._base_walls + [Point(r, c) for (r, c) in self._opp]


def _dir_from_delta(dr: int, dc: int) -> str:
    if dr == -1 and dc == 0:
        return "up"
    if dr == 1 and dc == 0:
        return "down"
    if dr == 0 and dc == -1:
        return "left"
    if dr == 0 and dc == 1:
        return "right"
    return "left"


def _action_from_target_dir(current_dir: str, target_dir: str) -> list[int]:
    clock_wise = ["right", "down", "left", "up"]
    idx = clock_wise.index(current_dir)
    if target_dir == current_dir:
        return [1, 0, 0]
    if target_dir == clock_wise[(idx + 1) % 4]:
        return [0, 1, 0]
    if target_dir == clock_wise[(idx - 1) % 4]:
        return [0, 0, 1]
    return [1, 0, 0]


def _neighbors(r: int, c: int):
    yield r - 1, c
    yield r + 1, c
    yield r, c - 1
    yield r, c + 1


def _bfs_next_step(start: Point, target: Point, blocked: set[tuple[int, int]]):
    s = (start.row, start.col)
    t = (target.row, target.col)
    if t in blocked:
        return None

    q = deque([s])
    parent: dict[tuple[int, int], tuple[int, int] | None] = {s: None}

    while q:
        cur = q.popleft()
        if cur == t:
            break
        for nr, nc in _neighbors(cur[0], cur[1]):
            if 0 <= nr < ROW and 0 <= nc < COL:
                nxt = (nr, nc)
                if nxt in parent:
                    continue
                if nxt in blocked:
                    continue
                parent[nxt] = cur
                q.append(nxt)

    if t not in parent:
        return None

    # 回溯到 start 的下一格
    cur = t
    prev = parent[cur]
    while prev is not None and prev != s:
        cur = prev
        prev = parent[cur]
    return Point(cur[0], cur[1])


@dataclass
class BFSController:
    def next_action(self, game_like) -> list[int]:
        blocked = set()
        for w in game_like.walls:
            blocked.add((w.row, w.col))
        for s in game_like.snakes:
            blocked.add((s.row, s.col))
        # 对手占用由 game_like.is_collision 内部处理不了（它只会对 pt 判断），这里直接并入 blocked
        if hasattr(game_like, "_opp"):
            blocked |= set(getattr(game_like, "_opp"))

        nxt = _bfs_next_step(game_like.head, game_like.food, blocked)
        if nxt is None:
            return [1, 0, 0]
        dr = nxt.row - game_like.head.row
        dc = nxt.col - game_like.head.col
        target_dir = _dir_from_delta(dr, dc)
        return _action_from_target_dir(game_like.direct, target_dir)


class APFController:
    def __init__(self):
        # 直接复用现有 play_APF.py 的决策函数（它只依赖 head/direct/food/walls/snakes）
        from play_APF import choose_action_apf  # noqa: WPS433 (runtime import)

        self._choose_action_apf: Callable = choose_action_apf

    def next_action(self, game_like) -> list[int]:
        proxy = _ProxyGame(game_like, getattr(game_like, "_opp", None))
        return self._choose_action_apf(proxy)


class AxController:
    def __init__(self):
        from play_Ax import astar_path, get_action_from_path, safe_random_action  # noqa: WPS433

        self._astar_path: Callable = astar_path
        self._get_action_from_path: Callable = get_action_from_path
        self._safe_random_action: Callable = safe_random_action

    def next_action(self, game_like) -> list[int]:
        proxy = _ProxyGame(game_like, getattr(game_like, "_opp", None))
        path = self._astar_path(proxy.head, proxy.food, proxy.walls, proxy.snakes)
        if path is not None and len(path) > 0:
            return self._get_action_from_path(proxy.head, path[0], proxy.direct)
        return self._safe_random_action(proxy)


class DijkstraController:
    def __init__(self):
        from play_Dijkstra import dijkstra_path, get_action_from_path, safe_random_action  # noqa: WPS433

        self._dijkstra_path: Callable = dijkstra_path
        self._get_action_from_path: Callable = get_action_from_path
        self._safe_random_action: Callable = safe_random_action

    def next_action(self, game_like) -> list[int]:
        proxy = _ProxyGame(game_like, getattr(game_like, "_opp", None))
        path = self._dijkstra_path(proxy.head, proxy.food, proxy.walls, proxy.snakes)
        if path is not None and len(path) > 0:
            return self._get_action_from_path(proxy.head, path[0], proxy.direct)
        return self._safe_random_action(proxy)


class RRTController:
    def __init__(self):
        from play_RRT import rrt_path, get_action_from_path, safe_random_action  # noqa: WPS433

        self._rrt_path: Callable = rrt_path
        self._get_action_from_path: Callable = get_action_from_path
        self._safe_random_action: Callable = safe_random_action

    def next_action(self, game_like) -> list[int]:
        proxy = _ProxyGame(game_like, getattr(game_like, "_opp", None))
        path = self._rrt_path(proxy.head, proxy.food, proxy.walls, proxy.snakes)
        if path is not None and len(path) > 0:
            return self._get_action_from_path(proxy.head, path[0], proxy.direct)
        return self._safe_random_action(proxy)


class RRTxController:
    def __init__(self):
        from play_RRTx import rrt_star_path, get_action_from_path, safe_random_action  # noqa: WPS433

        self._rrt_star_path: Callable = rrt_star_path
        self._get_action_from_path: Callable = get_action_from_path
        self._safe_random_action: Callable = safe_random_action

    def next_action(self, game_like) -> list[int]:
        proxy = _ProxyGame(game_like, getattr(game_like, "_opp", None))
        path = self._rrt_star_path(proxy.head, proxy.food, proxy.walls, proxy.snakes)
        if path is not None and len(path) > 0:
            return self._get_action_from_path(proxy.head, path[0], proxy.direct)
        return self._safe_random_action(proxy)


class DWAController:
    def __init__(self):
        from play_DWA import dwa_decision  # noqa: WPS433

        self._dwa_decision: Callable = dwa_decision

    def next_action(self, game_like) -> list[int]:
        proxy = _ProxyGame(game_like, getattr(game_like, "_opp", None))
        return self._dwa_decision(proxy)


class RLPolicyController:
    def __init__(self, algo_name: str):
        self.algo_name = algo_name
        self._loaded = False
        self._predict = None
        self._get_state = None
        self._fallback = BFSController()
        self.load_error: str | None = None
        self._load()

    def _load(self):
        try:
            import torch

            algo = self.algo_name.upper()
            base_dir = Path(__file__).resolve().parent

            if algo == "DQN":
                from agent_DQN import Agent  # noqa
                from model_DQN import Linear_QNet  # noqa

                agent = Agent(load_model=False)
                model = Linear_QNet(11, 256, 3)
                best = "model/model_DQN/best_model_DQN.pth"
                normal = "model/model_DQN/model_DQN.pth"
                key = "model_state_dict"

            elif algo == "DDQN":
                from agent_DDQN import Agent  # noqa
                from model_DDQN import Linear_QNet  # noqa

                agent = Agent(load_model=False)
                model = Linear_QNet(11, 256, 3)
                best = "model/model_DDQN/best_model_DDQN.pth"
                normal = "model/model_DDQN/model_DDQN.pth"
                key = "model_state_dict"

            elif algo == "DUELINGDQN":
                from agent_DuelingDQN import Agent  # noqa
                from model_DuelingDQN import DuelingQNet  # noqa

                agent = Agent(load_model=False)
                model = DuelingQNet(11, 256, 3)
                best = "model/model_DuelingDQN/best_model_DuelingDQN.pth"
                normal = "model/model_DuelingDQN/model_DuelingDQN.pth"
                key = "model_state_dict"

            elif algo == "PPO":
                from agent_PPO import Agent  # noqa
                from model_PPO import Actor  # noqa

                agent = Agent(load_model=False)
                model = Actor(11, 256, 3)
                best = "model/model_PPO/best_model_PPO.pth"
                normal = "model/model_PPO/model_PPO.pth"
                key = "actor_state_dict"

            elif algo == "TRPO":
                from agent_TRPO import Agent  # noqa
                from model_TRPO import Actor  # noqa

                agent = Agent(load_model=False)
                model = Actor(11, 256, 3)
                best = "model/model_TRPO/best_model_TRPO.pth"
                normal = "model/model_TRPO/model_TRPO.pth"
                key = "actor_state_dict"

            elif algo == "A2C":
                from agent_A2C import Agent  # noqa
                from model_A2C import Actor  # noqa

                agent = Agent(load_model=False)
                model = Actor(11, 256, 3)
                best = "model/model_A2C/best_model_A2C.pth"
                normal = "model/model_A2C/model_A2C.pth"
                key = "actor_state_dict"

            else:
                raise ValueError(f"Unsupported RL algo: {self.algo_name}")

            best_path = base_dir / best
            normal_path = base_dir / normal
            ckpt_path = best_path if best_path.exists() else normal_path
            if not ckpt_path.exists():
                raise FileNotFoundError(f"模型文件不存在：{ckpt_path}")

            checkpoint = torch.load(str(ckpt_path), map_location="cpu")
            if isinstance(checkpoint, dict) and key in checkpoint:
                model.load_state_dict(checkpoint[key])
            elif isinstance(checkpoint, dict) and "model_state_dict" in checkpoint and key != "actor_state_dict":
                model.load_state_dict(checkpoint["model_state_dict"])
            else:
                model.load_state_dict(checkpoint)

            model.eval()
            self._get_state = agent.get_state

            def _predict(game_like):
                import numpy as np

                state = self._get_state(game_like)
                st = torch.tensor(np.array(state), dtype=torch.float32).unsqueeze(0)
                with torch.no_grad():
                    out = model(st)
                move = int(torch.argmax(out, dim=1).item())
                act = [0, 0, 0]
                act[move] = 1
                return act

            self._predict = _predict
            self._loaded = True
            self.load_error = None

        except Exception as exc:
            self._loaded = False
            self._predict = None
            self._get_state = None
            self.load_error = f"{self.algo_name} 模型加载失败：{exc}"
            print(self.load_error)

    def next_action(self, game_like) -> list[int]:
        if not self._loaded or self._predict is None:
            return self._fallback.next_action(game_like)
        return self._predict(game_like)


def build_controller(algo_name: str):
    name = algo_name.strip()
    upper = name.upper()

    # 规则/规划类：严格复用原 play_*.py
    if upper == "BFS":
        return BFSController()
    if upper == "AX":
        return AxController()
    if upper == "DIJKSTRA":
        return DijkstraController()
    if upper == "DWA":
        return DWAController()
    if upper == "RRT":
        return RRTController()
    if upper == "RRTX":
        return RRTxController()
    if upper == "APF":
        return APFController()

    # 强化学习类
    if upper in {"DQN", "DDQN", "DUELINGDQN", "PPO", "TRPO", "A2C"}:
        return RLPolicyController(upper)

    # 未识别：默认 BFS
    return BFSController()

