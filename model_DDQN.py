import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
import os


class Linear_QNet(nn.Module):
    def __init__(self, input_size, hidden_size, output_size):
        super().__init__()
        self.linear1 = nn.Linear(input_size, hidden_size)
        self.linear2 = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        x = F.relu(self.linear1(x))
        x = self.linear2(x)
        return x

    def save(self, file_name='model_DDQN.pth', n_games=0, best_score=0):
        model_folder_path = './model/model_DDQN'
        if not os.path.exists(model_folder_path):
            os.makedirs(model_folder_path)
        file_name = os.path.join(model_folder_path, file_name)
        torch.save({
            'model_state_dict': self.state_dict(),
            'n_games': n_games,
            'best_score': best_score
        }, file_name)


class QTrainer:
    def __init__(self, model, target_model, lr, gamma, device):
        self.lr = lr
        self.gamma = gamma
        self.model = model
        self.target_model = target_model
        self.device = device
        self.optimizer = optim.Adam(model.parameters(), lr=self.lr)
        self.criterion = nn.MSELoss()

    def train_step(self, state, action, reward, next_state, done):
        # 转换为张量并移到指定设备
        state = torch.tensor(state, dtype=torch.float).to(self.device)
        next_state = torch.tensor(next_state, dtype=torch.float).to(self.device)
        action = torch.tensor(action, dtype=torch.long).to(self.device)
        reward = torch.tensor(reward, dtype=torch.float).to(self.device)

        if len(state.shape) == 1:
            state = torch.unsqueeze(state, 0)
            next_state = torch.unsqueeze(next_state, 0)
            action = torch.unsqueeze(action, 0)
            reward = torch.unsqueeze(reward, 0)
            done = (done,)

        # 1. 在线网络预测当前Q值
        pred = self.model(state)
        target = pred.clone()

        # 2. DDQN核心：分离动作选择和价值评估
        for idx in range(len(done)):
            Q_new = reward[idx]
            if not done[idx]:
                # 在线网络选择最优动作
                action_argmax = torch.argmax(self.model(next_state[idx])).item()
                # 目标网络评估该动作的Q值
                Q_new = reward[idx] + self.gamma * self.target_model(next_state[idx])[action_argmax]

            target[idx][torch.argmax(action[idx]).item()] = Q_new

        # 3. 反向传播优化
        self.optimizer.zero_grad()
        loss = self.criterion(target, pred)
        loss.backward()
        self.optimizer.step()

    def update_target_model(self):
        self.target_model.load_state_dict(self.model.state_dict())