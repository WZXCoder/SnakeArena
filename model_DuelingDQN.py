import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
import os

class DuelingQNet(nn.Module):
    def __init__(self, input_size, hidden_size, output_size):
        super().__init__()
        # 共享的特征提取层
        self.feature_layer = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU()
        )
        # 价值流 V(s)
        self.value_stream = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, 1)
        )
        # 优势流 A(s, a)
        self.advantage_stream = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, output_size)
        )

    def forward(self, x):
        # 确保输入有 batch 维度
        if x.dim() == 1:
            x = x.unsqueeze(0)
        features = self.feature_layer(x)
        value = self.value_stream(features)                 # shape: (batch, 1)
        advantage = self.advantage_stream(features)         # shape: (batch, output_size)

        # Q(s,a) = V(s) + (A(s,a) - mean(A(s,a)))
        q_values = value + (advantage - advantage.mean(dim=1, keepdim=True))
        return q_values

    def save(self, file_name='model_DuelingDQN.pth', n_games=0, best_score=0):
        model_folder_path = './model/model_DuelingDQN'
        if not os.path.exists(model_folder_path):
            os.makedirs(model_folder_path)
        file_name = os.path.join(model_folder_path, file_name)
        torch.save({
            'model_state_dict': self.state_dict(),
            'n_games': n_games,
            'best_score': best_score
        }, file_name)

class QTrainer:
    def __init__(self, model, lr, gamma):
        self.lr = lr
        self.gamma = gamma
        self.model = model
        self.optimizer = optim.Adam(model.parameters(), lr=self.lr)
        self.criterion = nn.MSELoss()
        # 从模型中获取设备
        self.device = next(model.parameters()).device

    def train_step(self, state, action, reward, next_state, done):
        state = torch.tensor(state, dtype=torch.float).to(self.device)
        next_state = torch.tensor(next_state, dtype=torch.float).to(self.device)
        action = torch.tensor(action, dtype=torch.long).to(self.device)
        reward = torch.tensor(reward, dtype=torch.float).to(self.device)
        
        if len(state.shape) == 1:
            state = torch.unsqueeze(state, 0)
            next_state = torch.unsqueeze(next_state, 0)
            action = torch.unsqueeze(action, 0)
            reward = torch.unsqueeze(reward, 0)
            done = (done, )

        # 前向计算当前状态的预测 Q 值
        pred = self.model(state)
        target = pred.clone()

        # 批量计算 next_state 的最大 Q 值（避免降维错误）
        with torch.no_grad():
            next_q_values = self.model(next_state)          # shape: (batch_size, output_size)
            max_next_q = torch.max(next_q_values, dim=1)[0]  # shape: (batch_size,)

        for idx in range(len(done)):
            Q_new = reward[idx]
            if not done[idx]:
                Q_new = reward[idx] + self.gamma * max_next_q[idx]
            target[idx][torch.argmax(action[idx]).item()] = Q_new

        self.optimizer.zero_grad()
        loss = self.criterion(target, pred)
        loss.backward()
        self.optimizer.step()