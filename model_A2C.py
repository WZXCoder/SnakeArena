import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from torch.distributions import Categorical
import numpy as np
import os

class Actor(nn.Module):
    """策略网络：输出动作概率分布"""
    def __init__(self, input_size, hidden_size, output_size):
        super().__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        x = F.relu(self.fc1(x))
        logits = self.fc2(x)
        return F.softmax(logits, dim=-1)

    def get_logits(self, x):
        """返回未归一化的 logits，专用于 Categorical 分布"""
        x = F.relu(self.fc1(x))
        return self.fc2(x)

class Critic(nn.Module):
    """价值网络：估计状态价值 V(s)"""
    def __init__(self, input_size, hidden_size):
        super().__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, 1)

    def forward(self, x):
        x = F.relu(self.fc1(x))
        return self.fc2(x)

class A2C:
    """
    A2C 算法 (Advantage Actor-Critic)
    - 使用 GAE 估计优势
    - Actor 更新：最大化 E[logπ(a|s) * A]
    - Critic 更新：最小化 (V(s) - R)^2
    """
    def __init__(self, actor, critic, gamma=0.99, gae_lambda=0.95,
                 actor_epochs=1, critic_epochs=10, batch_size=64,
                 lr_actor=1e-3, lr_critic=1e-3):
        self.actor = actor
        self.critic = critic
        self.gamma = gamma
        self.gae_lambda = gae_lambda
        self.actor_epochs = actor_epochs          # 改为 1，避免过拟合短轨迹
        self.critic_epochs = critic_epochs
        self.batch_size = batch_size

        self.optimizer_actor = optim.Adam(actor.parameters(), lr=lr_actor)
        self.optimizer_critic = optim.Adam(critic.parameters(), lr=lr_critic)

    def compute_gae(self, rewards, values, dones):
        """广义优势估计"""
        advantages = []
        gae = 0
        values = values + [0]  # 终止状态价值为0
        for t in reversed(range(len(rewards))):
            delta = rewards[t] + self.gamma * values[t+1] * (1 - dones[t]) - values[t]
            gae = delta + self.gamma * self.gae_lambda * (1 - dones[t]) * gae
            advantages.insert(0, gae)
        return advantages

    def train_step(self, states, actions, rewards, dones):
        """执行一次完整的 A2C 更新"""
        states_t = torch.tensor(np.array(states), dtype=torch.float32)
        actions_t = torch.tensor(actions, dtype=torch.long)
        rewards_t = torch.tensor(rewards, dtype=torch.float32)
        dones_t = torch.tensor(dones, dtype=torch.float32)

        # ---------- 1. 计算优势与回报 ----------
        with torch.no_grad():
            values = self.critic(states_t).squeeze(-1).tolist()

        advantages = self.compute_gae(rewards, values, dones)
        advantages_t = torch.tensor(advantages, dtype=torch.float32)
        returns_t = advantages_t + torch.tensor(values, dtype=torch.float32)

        # 标准化优势（增加稳定性，并防止 std=0 时除零）
        if advantages_t.numel() > 1:
            advantages_t = (advantages_t - advantages_t.mean()) / (advantages_t.std() + 1e-8)
        else:
            advantages_t = advantages_t * 0.0   # 单步轨迹优势置零，不更新

        dataset_size = len(states_t)
        indices = np.arange(dataset_size)

        # ---------- 2. 更新 Critic ----------
        for _ in range(self.critic_epochs):
            np.random.shuffle(indices)
            for start in range(0, dataset_size, self.batch_size):
                end = start + self.batch_size
                batch_idx = indices[start:end]

                values_pred = self.critic(states_t[batch_idx]).squeeze(-1)
                critic_loss = F.mse_loss(values_pred, returns_t[batch_idx])

                self.optimizer_critic.zero_grad()
                critic_loss.backward()
                self.optimizer_critic.step()

        # ---------- 3. 更新 Actor ----------
        for _ in range(self.actor_epochs):
            np.random.shuffle(indices)
            for start in range(0, dataset_size, self.batch_size):
                end = start + self.batch_size
                batch_idx = indices[start:end]

                logits = self.actor.get_logits(states_t[batch_idx])
                dist = Categorical(logits=logits)
                log_probs = dist.log_prob(actions_t[batch_idx])

                actor_loss = -(log_probs * advantages_t[batch_idx]).mean()

                self.optimizer_actor.zero_grad()
                actor_loss.backward()
                self.optimizer_actor.step()

        # 日志用
        with torch.no_grad():
            final_critic_loss = F.mse_loss(self.critic(states_t).squeeze(-1), returns_t).item()
        return final_critic_loss

    def save(self, file_name='model_A2C.pth', n_games=0, best_score=0):
        model_folder_path = './model/model_A2C'
        os.makedirs(model_folder_path, exist_ok=True)
        file_path = os.path.join(model_folder_path, file_name)
        torch.save({
            'actor_state_dict': self.actor.state_dict(),
            'critic_state_dict': self.critic.state_dict(),
            'n_games': n_games,
            'best_score': best_score
        }, file_path)

    def load(self, file_name='model_A2C.pth'):
        model_folder_path = './model/model_A2C'
        file_path = os.path.join(model_folder_path, file_name)
        if os.path.exists(file_path):
            checkpoint = torch.load(file_path)
            self.actor.load_state_dict(checkpoint['actor_state_dict'])
            self.critic.load_state_dict(checkpoint['critic_state_dict'])
            return checkpoint.get('n_games', 0), checkpoint.get('best_score', 0)
        return 0, 0