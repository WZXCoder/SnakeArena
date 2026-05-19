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
        """用于计算熵（避免两次 softmax）"""
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

class PPO:
    """
    实现 PPO 算法 (Proximal Policy Optimization)
    参考：https://arxiv.org/abs/1707.06347
    """
    def __init__(self, actor, critic, gamma=0.99, gae_lambda=0.95,
                 clip_epsilon=0.2, ppo_epochs=4, batch_size=64,
                 lr_actor=3e-4, lr_critic=1e-3, ent_coef=0.01):
        self.actor = actor
        self.critic = critic
        self.gamma = gamma
        self.gae_lambda = gae_lambda
        self.clip_epsilon = clip_epsilon
        self.ppo_epochs = ppo_epochs
        self.batch_size = batch_size
        self.ent_coef = ent_coef      # 熵正则系数

        self.optimizer_actor = optim.Adam(actor.parameters(), lr=lr_actor)
        self.optimizer_critic = optim.Adam(critic.parameters(), lr=lr_critic)

    def compute_gae(self, rewards, values, dones):
        """计算广义优势估计 (GAE)"""
        advantages = []
        gae = 0
        # values 长度 T, 加一个虚拟的下一时刻值 0
        values = values + [0]
        for t in reversed(range(len(rewards))):
            delta = rewards[t] + self.gamma * values[t+1] * (1 - dones[t]) - values[t]
            gae = delta + self.gamma * self.gae_lambda * (1 - dones[t]) * gae
            advantages.insert(0, gae)
        return advantages

    def train_step(self, states, actions, rewards, dones):
        """
        对一个 episode 的数据执行 PPO 更新（多次 epoch，mini-batch）
        states, actions, rewards, dones: 列表，长度均为 T
        """
        # 转换为 tensor
        states_t = torch.tensor(np.array(states), dtype=torch.float32)
        actions_t = torch.tensor(actions, dtype=torch.long)
        rewards_t = torch.tensor(rewards, dtype=torch.float32)
        dones_t = torch.tensor(dones, dtype=torch.float32)

        # 计算旧时的价值 V(s)
        with torch.no_grad():
            values = self.critic(states_t).squeeze().tolist()
        # 计算 GAE 优势
        advantages = self.compute_gae(rewards, values, dones)
        advantages_t = torch.tensor(advantages, dtype=torch.float32)
        # 计算回报（用于更新 Critic）
        returns_t = advantages_t + torch.tensor(values, dtype=torch.float32)

        # 标准化优势（提升稳定性）
        advantages_t = (advantages_t - advantages_t.mean()) / (advantages_t.std() + 1e-8)

        # 获取旧策略的 log 概率
        with torch.no_grad():
            old_probs = self.actor(states_t)
            old_log_probs = torch.log(old_probs.gather(1, actions_t.unsqueeze(1)).squeeze(1) + 1e-8)

        # 多次 epoch 更新
        dataset_size = len(states_t)
        indices = np.arange(dataset_size)

        for _ in range(self.ppo_epochs):
            np.random.shuffle(indices)
            # mini-batch 更新
            for start in range(0, dataset_size, self.batch_size):
                end = start + self.batch_size
                batch_idx = indices[start:end]

                batch_states = states_t[batch_idx]
                batch_actions = actions_t[batch_idx]
                batch_advantages = advantages_t[batch_idx]
                batch_returns = returns_t[batch_idx]
                batch_old_log_probs = old_log_probs[batch_idx]

                # 计算当前策略的 log 概率
                new_probs = self.actor(batch_states)
                new_log_probs = torch.log(new_probs.gather(1, batch_actions.unsqueeze(1)).squeeze(1) + 1e-8)

                # 计算 ratio 和 clipped loss
                ratio = torch.exp(new_log_probs - batch_old_log_probs)
                surr1 = ratio * batch_advantages
                surr2 = torch.clamp(ratio, 1 - self.clip_epsilon, 1 + self.clip_epsilon) * batch_advantages
                actor_loss = -torch.min(surr1, surr2).mean()

                # 熵正则项（鼓励探索）
                logits = self.actor.get_logits(batch_states)
                dist = Categorical(logits=logits)
                entropy = dist.entropy().mean()
                actor_loss = actor_loss - self.ent_coef * entropy

                # 更新 Actor
                self.optimizer_actor.zero_grad()
                actor_loss.backward()
                self.optimizer_actor.step()

                # 更新 Critic (MSE loss)
                values_pred = self.critic(batch_states).squeeze(-1)   # 保持与 batch_returns 相同维度
                critic_loss = F.mse_loss(values_pred, batch_returns)
                self.optimizer_critic.zero_grad()
                critic_loss.backward()
                self.optimizer_critic.step()

        # 返回 critic loss 作为监控信息
        with torch.no_grad():
            final_critic_loss = F.mse_loss(self.critic(states_t).squeeze(-1), returns_t).item()
        return final_critic_loss

    def save(self, file_name='model_PPO.pth', n_games=0, best_score=0):
        """保存模型（包含 Actor 和 Critic）"""
        model_folder_path = './model/model_PPO'
        if not os.path.exists(model_folder_path):
            os.makedirs(model_folder_path)
        file_path = os.path.join(model_folder_path, file_name)
        torch.save({
            'actor_state_dict': self.actor.state_dict(),
            'critic_state_dict': self.critic.state_dict(),
            'n_games': n_games,
            'best_score': best_score
        }, file_path)

    def load(self, file_name='model_PPO.pth'):
        """加载模型"""
        model_folder_path = './model/model_PPO'
        file_path = os.path.join(model_folder_path, file_name)
        if os.path.exists(file_path):
            checkpoint = torch.load(file_path)
            self.actor.load_state_dict(checkpoint['actor_state_dict'])
            self.critic.load_state_dict(checkpoint['critic_state_dict'])
            return checkpoint.get('n_games', 0), checkpoint.get('best_score', 0)
        else:
            return 0, 0