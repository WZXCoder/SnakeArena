import torch
import os
from game_env import SnakeGameAI
# from model_A2C import Actor
# from model_TRPO import Actor
from model_PPO import Actor
# from agent_TRPO import Agent  
# from agent_A2C import Agent
from agent_PPO import Agent
def play():
    # 实例化游戏（测试模式，开启原有速度和音效）
    game = SnakeGameAI(is_training=False)
    
    # 创建策略网络（结构与训练时一致：输入11，隐藏256，输出3）
    actor = Actor(11, 256, 3)
    
    # 模型权重路径
    best_model_path = './model/model_PPO/best_model_PPO.pth'
    normal_model_path = './model/model_PPO/model_PPO.pth'
    
    # 优先加载最佳模型，否则加载普通模型
    checkpoint = None
    if os.path.exists(best_model_path):
        checkpoint = torch.load(best_model_path, map_location='cpu')
        print("最好的模型加载成功！开始游戏。")
    elif os.path.exists(normal_model_path):
        checkpoint = torch.load(normal_model_path, map_location='cpu')
        print("普通模型加载成功！开始游戏。")
    else:
        print("未找到模型文件，请先运行 agent_TRPO.py 训练模型。")
        return
    
    # 加载 actor 权重（兼容新旧保存格式）
    if 'actor_state_dict' in checkpoint:
        actor.load_state_dict(checkpoint['actor_state_dict'])
    else:
        actor.load_state_dict(checkpoint)
    actor.eval()
    
    # 复用 Agent 的状态提取方法（避免重复编写 get_state）
    agent = Agent(load_model=False)
    
    # 游戏主循环
    while True:
        # 获取当前状态
        state = agent.get_state(game)
        
        # 使用策略网络推理最优动作（贪婪，取概率最大的动作）
        state_tensor = torch.tensor(state, dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            probs = actor(state_tensor)
        move = torch.argmax(probs, dim=1).item()
        
        final_move = [0, 0, 0]
        final_move[move] = 1
        
        # 在环境中执行动作
        reward, done, score = game.play_step(final_move)
        
        if done:
            print(f"Game Over! 最终得分: {score}")
            game.reset()

if __name__ == '__main__':
    play()