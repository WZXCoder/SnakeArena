import torch
import random
import numpy as np
from game_env import SnakeGameAI, Point
from model_TRPO import Actor, Critic, TRPO
import os

MAX_GAMES = 5000          # 最大训练轮数
GAMMA = 0.99              # 提高折扣因子，让远期奖励更重要
ACTOR_HIDDEN = 256
CRITIC_HIDDEN = 256

# TRPO 超参数
GAE_LAMBDA = 0.95
MAX_KL = 0.01             # TRPO 特有的 KL 散度限制
CG_ITERS = 10             # 共轭梯度法迭代次数
CRITIC_EPOCHS = 10        # Critic 更新次数
BATCH_SIZE = 64
LR_CRITIC = 1e-3

class Agent:
    def __init__(self, load_model=False):
        self.n_games = 0
        self.best_score = 0

        # 创建网络
        self.actor = Actor(11, ACTOR_HIDDEN, 3)
        self.critic = Critic(11, CRITIC_HIDDEN)
        self.trpo = TRPO(self.actor, self.critic, gamma=GAMMA,
                         gae_lambda=GAE_LAMBDA, max_kl=MAX_KL, cg_iters=CG_ITERS,
                         critic_epochs=CRITIC_EPOCHS, batch_size=BATCH_SIZE,
                         lr_critic=LR_CRITIC)

        # 用于存储一个 episode 的轨迹
        self.episode_states = []
        self.episode_actions = []
        self.episode_rewards = []
        self.episode_dones = []

        # 上一帧的蛇头位置（用于距离奖励）
        self.last_head_pos = None

        # 断点续训
        if load_model:
            self._load_model()

    def _load_model(self):
        n, best = self.trpo.load('model_TRPO.pth')
        if n > 0:
            self.n_games = n
            self.best_score = best
            print(f"模型加载成功！已训练 {self.n_games} 轮，最佳分数为 {self.best_score}。")

    def get_state(self, game):
        """状态提取保持不变"""
        head = game.head
        point_l = Point(head.row, head.col - 1)
        point_r = Point(head.row, head.col + 1)
        point_u = Point(head.row - 1, head.col)
        point_d = Point(head.row + 1, head.col)

        dir_l = game.direct == 'left'
        dir_r = game.direct == 'right'
        dir_u = game.direct == 'up'
        dir_d = game.direct == 'down'

        state = [
            (dir_r and game.is_collision(point_r)) or
            (dir_l and game.is_collision(point_l)) or
            (dir_u and game.is_collision(point_u)) or
            (dir_d and game.is_collision(point_d)),

            (dir_u and game.is_collision(point_r)) or
            (dir_d and game.is_collision(point_l)) or
            (dir_l and game.is_collision(point_u)) or
            (dir_r and game.is_collision(point_d)),

            (dir_d and game.is_collision(point_r)) or
            (dir_u and game.is_collision(point_l)) or
            (dir_r and game.is_collision(point_u)) or
            (dir_l and game.is_collision(point_d)),

            dir_l, dir_r, dir_u, dir_d,

            game.food.col < game.head.col,
            game.food.col > game.head.col,
            game.food.row < game.head.row,
            game.food.row > game.head.row
        ]
        return np.array(state, dtype=int)

    def get_action(self, state):
        """根据策略网络采样动作"""
        state_t = torch.tensor(state, dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            probs = self.actor(state_t)
        dist = torch.distributions.Categorical(probs)
        action = dist.sample().item()
        final_move = [0, 0, 0]
        final_move[action] = 1
        return final_move

    def remember_step(self, state, action, reward, next_state, done):
        """记录每一步（用于 episode 内的轨迹收集）"""
        action_idx = np.argmax(action)
        self.episode_states.append(state)
        self.episode_actions.append(action_idx)
        self.episode_rewards.append(reward)
        self.episode_dones.append(done)

    def train_long_memory(self):
        """在一个 episode 结束后，使用完整轨迹更新 TRPO"""
        if len(self.episode_states) == 0:
            return
        loss = self.trpo.train_step(
            self.episode_states,
            self.episode_actions,
            self.episode_rewards,
            self.episode_dones
        )
        # 清空 episode 缓存
        self.episode_states = []
        self.episode_actions = []
        self.episode_rewards = []
        self.episode_dones = []
        self.last_head_pos = None

    def train_short_memory(self, state, action, reward, next_state, done):
        """接口保留"""
        pass

def train():
    load_model = os.path.exists('./model/model_TRPO/model_TRPO.pth')
    agent = Agent(load_model=load_model)
    game = SnakeGameAI(is_training=True)
    record = 0

    # 创建日志目录
    if not os.path.exists('./log/log_TRPO'):
        os.makedirs('./log/log_TRPO')

    # 处理断点续训时的日志追加/覆盖
    if agent.n_games > 0:
        filtered_lines = []
        try:
            with open("./log/log_TRPO/train_log_TRPO.txt", "r") as f:
                for line in f:
                    if "Game: " in line:
                        game_info = line.split(" | ")[0]
                        game_num = int(game_info.split("/")[0].split(" ")[1])
                        if game_num < agent.n_games:
                            filtered_lines.append(line)
        except FileNotFoundError:
            pass
        log_file = open("./log/log_TRPO/train_log_TRPO.txt", "w")
        for line in filtered_lines:
            log_file.write(line)
    else:
        log_file = open("./log/log_TRPO/train_log_TRPO.txt", "w")

    # 训练循环
    while agent.n_games < MAX_GAMES:
        state_old = agent.get_state(game)
        final_move = agent.get_action(state_old)
        
        # 记录移动前的蛇头位置，用于距离奖励
        old_head = game.head.copy()
        agent.last_head_pos = old_head

        reward, done, score = game.play_step(final_move)
        state_new = agent.get_state(game)

        # ----- 添加距离奖励（鼓励蛇靠近食物）-----
        if not done:
            new_head = game.head
            old_dist = abs(old_head.row - game.food.row) + abs(old_head.col - game.food.col)
            new_dist = abs(new_head.row - game.food.row) + abs(new_head.col - game.food.col)
            # 靠近食物给正奖励，远离给负奖励（幅度不宜过大）
            distance_reward = 0.5 if new_dist < old_dist else -0.2
            reward += distance_reward
        # --------------------------------------

        agent.remember_step(state_old, final_move, reward, state_new, done)

        if done:
            game.reset()
            agent.n_games += 1

            # 一个 episode 结束，执行 TRPO 更新
            agent.train_long_memory()

            # 每 50 轮自动保存一次模型
            if agent.n_games % 50 == 0:
                agent.trpo.save('model_TRPO.pth', n_games=agent.n_games, best_score=agent.best_score)
                print(f"第{agent.n_games}轮，自动保存模型完成！")

            if score > record:
                record = score
                agent.trpo.save('model_TRPO.pth', n_games=agent.n_games, best_score=agent.best_score)

                if score > agent.best_score:
                    agent.best_score = score
                    agent.trpo.save('best_model_TRPO.pth', n_games=agent.n_games, best_score=agent.best_score)

            log_str = f'Game: {agent.n_games}/{MAX_GAMES} | Score: {score} | Record: {record} | Best Score: {agent.best_score}'
            print(log_str)
            log_file.write(log_str + '\n')
            log_file.flush()

    log_file.close()
    print(f"训练完成！共训练了 {agent.n_games} 轮，最好分数为 {agent.best_score}")
    print("最好的模型已保存为 best_model_TRPO.pth")

if __name__ == '__main__':
    train()