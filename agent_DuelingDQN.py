import torch
import random
import numpy as np
from collections import deque
from game_env import SnakeGameAI, Point
from model_DuelingDQN import DuelingQNet, QTrainer
import os

MAX_MEMORY = 100000
BATCH_SIZE = 1000
LR = 0.001
MAX_GAMES = 5000  # 设置最大训练轮数

class Agent:
    def __init__(self, load_model=False):
        self.n_games = 0
        self.best_score = 0  # 最佳分数
        self.epsilon = 0  # 探索率
        self.gamma = 0.9  # 折扣率
        self.memory = deque(maxlen=MAX_MEMORY)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {self.device}")
        self.model = DuelingQNet(11, 256, 3).to(self.device)
        self.trainer = QTrainer(self.model, lr=LR, gamma=self.gamma)
        
        # 加载模型（断点续训）
        if load_model:
            self._load_model()

    def _load_model(self):
        model_path = './model/model_DuelingDQN/model_DuelingDQN.pth'
        if os.path.exists(model_path):
            try:
                checkpoint = torch.load(model_path)
                self.model.load_state_dict(checkpoint['model_state_dict'])
                self.n_games = checkpoint.get('n_games', 0)
                self.best_score = checkpoint.get('best_score', 0)
                print(f"模型加载成功！已训练 {self.n_games} 轮，最佳分数为 {self.best_score}。")
            except Exception as e:
                print(f"模型加载失败: {e}")

    def get_state(self, game):
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
            # 危险就在正前方
            (dir_r and game.is_collision(point_r)) or 
            (dir_l and game.is_collision(point_l)) or 
            (dir_u and game.is_collision(point_u)) or 
            (dir_d and game.is_collision(point_d)),

            # 危险在右侧
            (dir_u and game.is_collision(point_r)) or 
            (dir_d and game.is_collision(point_l)) or 
            (dir_l and game.is_collision(point_u)) or 
            (dir_r and game.is_collision(point_d)),

            # 危险在左侧
            (dir_d and game.is_collision(point_r)) or 
            (dir_u and game.is_collision(point_l)) or 
            (dir_r and game.is_collision(point_u)) or 
            (dir_l and game.is_collision(point_d)),

            # 当前运动方向
            dir_l, dir_r, dir_u, dir_d,

            # 食物相对位置
            game.food.col < game.head.col,  # 食物在左
            game.food.col > game.head.col,  # 食物在右
            game.food.row < game.head.row,  # 食物在上
            game.food.row > game.head.row   # 食物在下
        ]
        return np.array(state, dtype=int)

    def remember(self, state, action, reward, next_state, done):
        self.memory.append((state, action, reward, next_state, done))

    def train_long_memory(self):
        if len(self.memory) > BATCH_SIZE:
            mini_sample = random.sample(self.memory, BATCH_SIZE)
        else:
            mini_sample = self.memory
        
        states, actions, rewards, next_states, dones = zip(*mini_sample)
        self.trainer.train_step(states, actions, rewards, next_states, dones)

    def train_short_memory(self, state, action, reward, next_state, done):
        self.trainer.train_step(state, action, reward, next_state, done)

    def get_action(self, state):
        self.epsilon = 80 - self.n_games
        final_move = [0, 0, 0]
        if random.randint(0, 200) < self.epsilon:
            move = random.randint(0, 2)
            final_move[move] = 1
        else:
            state0 = torch.tensor(state, dtype=torch.float).to(self.device)
            prediction = self.model(state0)
            move = torch.argmax(prediction).item()
            final_move[move] = 1
        return final_move

def train():
    # 检查是否需要加载模型进行断点续训
    load_model = os.path.exists('./model/model_DuelingDQN/model_DuelingDQN.pth')
    agent = Agent(load_model=load_model)
    game = SnakeGameAI(is_training=True)
    record = 0
    
    # 建立日志目录
    if not os.path.exists('./log/log_DuelingDQN'):
        os.makedirs('./log/log_DuelingDQN')
    
    log_path = f"./log/log_DuelingDQN/train_log_DuelingDQN.txt"
    
    # 处理断点续训时的日志：保留已完成局数的记录，删除后续记录
    if agent.n_games > 0:
        filtered_lines = []
        try:
            with open(log_path, "r") as f:
                for line in f:
                    if "Game: " in line:
                        # 解析日志行中的游戏编号，格式如 "Game: 100/5000 | ..."
                        try:
                            game_num_str = line.split(" | ")[0].split(" ")[1].split("/")[0]
                            game_num = int(game_num_str)
                            # 只保留已完成局数（<= agent.n_games）的日志行
                            if game_num <= agent.n_games:
                                filtered_lines.append(line)
                        except (IndexError, ValueError):
                            # 如果解析失败，保留该行（容错）
                            filtered_lines.append(line)
                    else:
                        # 非标准日志行（如续训标记）不保留，重新开始
                        pass
        except FileNotFoundError:
            pass
        
        # 重新写入过滤后的日志，并添加续训标记
        log_file = open(log_path, "w")
        for line in filtered_lines:
            log_file.write(line)
        log_file.write(f"--- 续训开始，从第 {agent.n_games + 1} 局继续训练 ---\n")
    else:
        log_file = open(log_path, "w")

    # 训练循环
    while agent.n_games < MAX_GAMES:
        state_old = agent.get_state(game)
        final_move = agent.get_action(state_old)
        reward, done, score = game.play_step(final_move)
        state_new = agent.get_state(game)

        agent.train_short_memory(state_old, final_move, reward, state_new, done)
        agent.remember(state_old, final_move, reward, state_new, done)

        if done:
            game.reset()
            agent.n_games += 1
            agent.train_long_memory()

            # 每50轮自动保存一次模型（修复参数传递）
            if agent.n_games % 50 == 0:
                agent.model.save(file_name='model_DuelingDQN.pth', n_games=agent.n_games, best_score=agent.best_score)
                print(f"第{agent.n_games}轮，自动保存模型完成！")

            if score > record:
                record = score
                # 保存当前最佳记录模型（覆盖常规模型文件）
                agent.model.save(file_name='model_DuelingDQN.pth', n_games=agent.n_games, best_score=agent.best_score)
                
                if score > agent.best_score:
                    agent.best_score = score
                    agent.model.save(file_name='best_model_DuelingDQN.pth', n_games=agent.n_games, best_score=agent.best_score)
            
            log_str = f'Game: {agent.n_games}/{MAX_GAMES} | Score: {score} | Record: {record} | Best Score: {agent.best_score}'
            print(log_str)
            log_file.write(log_str + '\n')
            log_file.flush()
    
    log_file.close()
    print(f"训练完成！共训练了 {agent.n_games} 轮，最好分数为 {agent.best_score}")
    print("最好的模型已保存为 best_model_DuelingDQN.pth")

if __name__ == '__main__':
    train()