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
        """用于计算散度等（避免两次 softmax）"""
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

class TRPO:
    """
    实现 TRPO 算法 (Trust Region Policy Optimization)
    参考：https://arxiv.org/abs/1502.05477
    """
    def __init__(self, actor, critic, gamma=0.99, gae_lambda=0.95,
                 max_kl=0.01, cg_iters=10, critic_epochs=10, batch_size=64,
                 lr_critic=1e-3, damping=0.1, line_search_iters=10, backtrack_coeff=0.5):
        self.actor = actor
        self.critic = critic
        self.gamma = gamma
        self.gae_lambda = gae_lambda
        self.max_kl = max_kl                  # KL 散度限制
        self.cg_iters = cg_iters              # 共轭梯度法迭代次数
        self.critic_epochs = critic_epochs    # 价值网络更新轮数（沿用PPO的设定以保持Critic稳定）
        self.batch_size = batch_size
        self.damping = damping                # 阻尼系数（防止矩阵不可逆）
        self.line_search_iters = line_search_iters
        self.backtrack_coeff = backtrack_coeff

        # TRPO 通常仅使用优化器更新 Critic，Actor 由解析更新（线搜索）完成
        self.optimizer_critic = optim.Adam(critic.parameters(), lr=lr_critic)

    def compute_gae(self, rewards, values, dones):
        """计算广义优势估计 (GAE)"""
        advantages = []
        gae = 0
        values = values + [0]
        for t in reversed(range(len(rewards))):
            delta = rewards[t] + self.gamma * values[t+1] * (1 - dones[t]) - values[t]
            gae = delta + self.gamma * self.gae_lambda * (1 - dones[t]) * gae
            advantages.insert(0, gae)
        return advantages

    def conjugate_gradient(self, fvp_func, b, residual_tol=1e-10):
        """共轭梯度法求 Hx = b 的解"""
        x = torch.zeros_like(b)
        r = b.clone()
        p = b.clone()
        rdotr = torch.dot(r, r)
        for _ in range(self.cg_iters):
            Ap = fvp_func(p)
            alpha = rdotr / (torch.dot(p, Ap) + 1e-8)
            x += alpha * p
            r -= alpha * Ap
            new_rdotr = torch.dot(r, r)
            if new_rdotr < residual_tol:
                break
            beta = new_rdotr / (rdotr + 1e-8)
            p = r + beta * p
            rdotr = new_rdotr
        return x

    def train_step(self, states, actions, rewards, dones):
        """执行一次完整的 TRPO 更新"""
        states_t = torch.tensor(np.array(states), dtype=torch.float32)
        actions_t = torch.tensor(actions, dtype=torch.long)
        rewards_t = torch.tensor(rewards, dtype=torch.float32)
        dones_t = torch.tensor(dones, dtype=torch.float32)

        # -------------------- 1. 准备优势函数和回报 --------------------
        with torch.no_grad():
            values = self.critic(states_t).squeeze(-1).tolist()
            old_probs = self.actor(states_t)
            old_log_probs = torch.log(old_probs.gather(1, actions_t.unsqueeze(1)).squeeze(1) + 1e-8)
            old_logits = self.actor.get_logits(states_t).detach()

        advantages = self.compute_gae(rewards, values, dones)
        advantages_t = torch.tensor(advantages, dtype=torch.float32)
        returns_t = advantages_t + torch.tensor(values, dtype=torch.float32)

        # 标准化优势
        advantages_t = (advantages_t - advantages_t.mean()) / (advantages_t.std() + 1e-8)

        # -------------------- 2. 更新 Critic (多次 Epoch, mini-batch) --------------------
        dataset_size = len(states_t)
        indices = np.arange(dataset_size)
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

        # -------------------- 3. 更新 Actor (TRPO 解析更新) --------------------
        # 目标函数：最大化 surrogate loss
        def get_surrogate_loss():
            probs = self.actor(states_t)
            log_probs = torch.log(probs.gather(1, actions_t.unsqueeze(1)).squeeze(1) + 1e-8)
            ratio = torch.exp(log_probs - old_log_probs)
            # PyTorch 优化器是最小化，因此我们取负号返回 (最小化负的 surrogate loss)
            return -(ratio * advantages_t).mean()

        loss = get_surrogate_loss()
        # 计算梯度 g
        grads = torch.autograd.grad(loss, self.actor.parameters())
        loss_grad = torch.cat([grad.view(-1) for grad in grads]).detach()

        # 定义 Hessian-Vector Product 函数
        def FVP(vector):
            logits = self.actor.get_logits(states_t)
            dist_old = Categorical(logits=old_logits)
            dist_new = Categorical(logits=logits)
            kl = torch.distributions.kl_divergence(dist_old, dist_new).mean()

            # 第一次求导
            grads_kl = torch.autograd.grad(kl, self.actor.parameters(), create_graph=True)
            flat_grad_kl = torch.cat([g.view(-1) for g in grads_kl])
            
            # 计算梯度与向量的点积
            kl_v = (flat_grad_kl * vector).sum()
            
            # 第二次求导 (Hessian * vector)
            grads_hvp = torch.autograd.grad(kl_v, self.actor.parameters())
            flat_hvp = torch.cat([g.view(-1).contiguous() for g in grads_hvp])

            return flat_hvp + self.damping * vector

        # 使用共轭梯度法求解方向步 step_dir = H^(-1) * (-g)
        # 因为我们 loss 已经取负，loss_grad 是负梯度，所以我们要沿着 -loss_grad 方向走
        step_dir = self.conjugate_gradient(FVP, -loss_grad)

        # 计算最大步长 beta = sqrt( 2 * delta / (s^T H s) )
        shs = (step_dir * FVP(step_dir)).sum()
        beta = torch.sqrt(2 * self.max_kl / (shs + 1e-8))
        full_step = beta * step_dir

        # 回溯线搜索 (Backtracking Line Search)
        old_params = torch.nn.utils.parameters_to_vector(self.actor.parameters())
        old_loss = loss.item()
        success = False

        for i in range(self.line_search_iters):
            step_frac = self.backtrack_coeff ** i
            new_params = old_params + step_frac * full_step
            torch.nn.utils.vector_to_parameters(new_params, self.actor.parameters())

            with torch.no_grad():
                new_loss = get_surrogate_loss().item()
                logits = self.actor.get_logits(states_t)
                dist_old = Categorical(logits=old_logits)
                dist_new = Categorical(logits=logits)
                kl_div = torch.distributions.kl_divergence(dist_old, dist_new).mean().item()

            # 检查条件：KL散度不能越界，且目标函数必须有所提升（loss 更小）
            if kl_div <= self.max_kl and new_loss < old_loss:
                success = True
                break
            else:
                # 恢复参数准备进行更小步长的搜索
                torch.nn.utils.vector_to_parameters(old_params, self.actor.parameters())

        # 如果所有的线搜索均失败，则完全放弃本次策略更新，保持原参数
        if not success:
            torch.nn.utils.vector_to_parameters(old_params, self.actor.parameters())

        # 记录 Critic 的最终 Loss
        with torch.no_grad():
            final_critic_loss = F.mse_loss(self.critic(states_t).squeeze(-1), returns_t).item()
        return final_critic_loss

    def save(self, file_name='model_TRPO.pth', n_games=0, best_score=0):
        """保存模型（包含 Actor 和 Critic）"""
        model_folder_path = './model/model_TRPO'
        if not os.path.exists(model_folder_path):
            os.makedirs(model_folder_path)
        file_path = os.path.join(model_folder_path, file_name)
        torch.save({
            'actor_state_dict': self.actor.state_dict(),
            'critic_state_dict': self.critic.state_dict(),
            'n_games': n_games,
            'best_score': best_score
        }, file_path)

    def load(self, file_name='model_TRPO.pth'):
        """加载模型"""
        model_folder_path = './model/model_TRPO'
        file_path = os.path.join(model_folder_path, file_name)
        if os.path.exists(file_path):
            checkpoint = torch.load(file_path)
            self.actor.load_state_dict(checkpoint['actor_state_dict'])
            self.critic.load_state_dict(checkpoint['critic_state_dict'])
            return checkpoint.get('n_games', 0), checkpoint.get('best_score', 0)
        else:
            return 0, 0