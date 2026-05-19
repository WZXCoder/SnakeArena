import torch
import os
from game_env import SnakeGameAI
# from agent_DQN import Agent 
from agent_DDQN import Agent
from agent_DuelingDQN import Agent
# from model_DQN import Linear_QNet
from model_DDQN import Linear_QNet
from model_DuelingDQN import DuelingQNet
def play():
    game = SnakeGameAI(is_training=False)

    # 设置设备（与训练时保持一致）
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    model = Linear_QNet(11, 256, 3).to(device)
    # model = DuelingQNet(11, 256, 3).to(device)
    # 优先加载最好的模型
    best_model_path = './model_DDQN/best_model_DDQN.pth'
    normal_model_path = './model_DDQN/model_DDQN.pth'

    if os.path.exists(best_model_path):
        try:
            checkpoint = torch.load(best_model_path, map_location=device)
            if 'model_state_dict' in checkpoint:
                model.load_state_dict(checkpoint['model_state_dict'])
            else:
                model.load_state_dict(checkpoint)
            model.eval()
            print("最好的模型加载成功！开始游戏。")
        except Exception as e:
            print(f"最好的模型加载失败: {e}")
            return
    elif os.path.exists(normal_model_path):
        try:
            checkpoint = torch.load(normal_model_path, map_location=device)
            if 'model_state_dict' in checkpoint:
                model.load_state_dict(checkpoint['model_state_dict'])
            else:
                model.load_state_dict(checkpoint)
            model.eval()
            print("普通模型加载成功！开始游戏。")
        except Exception as e:
            print(f"普通模型加载失败: {e}")
            return
    else:
        print("未找到模型文件，请先运行 agent_DDQN.py 训练模型。")
        return

    agent = Agent()  # 用于获取状态

    while True:
        state = agent.get_state(game)
        state_tensor = torch.tensor(state, dtype=torch.float).to(device)
        prediction = model(state_tensor)
        move = torch.argmax(prediction).item()

        final_move = [0, 0, 0]
        final_move[move] = 1

        reward, done, score = game.play_step(final_move)

        if done:
            print(f"Game Over! 最终得分: {score}")
            game.reset()


if __name__ == '__main__':
    play()