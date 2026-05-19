import pygame
import sys
from game_env import SnakeGameAI

def get_action_from_direction(current_dir, target_dir):
    """
    根据目标方向，返回动作列表 [直走, 右转, 左转]。
    如果目标方向与当前方向相反（会导致撞自己），则保持直走。
    """
    # 方向循环顺序：右 -> 下 -> 左 -> 上
    clock_wise = ['right', 'down', 'left', 'up']
    idx = clock_wise.index(current_dir)

    if target_dir == current_dir:
        return [1, 0, 0]  # 直走
    elif target_dir == clock_wise[(idx + 1) % 4]:
        return [0, 1, 0]  # 右转
    elif target_dir == clock_wise[(idx - 1) % 4]:
        return [0, 0, 1]  # 左转
    else:
        # 反向或无效方向，保持直走
        return [1, 0, 0]

def main():
    # 创建游戏实例，is_training=False 让帧率随得分阶梯变化，便于玩家体验
    game = SnakeGameAI(is_training=False)
    game.reset()

    print("玩家控制贪吃蛇开始！ 方向键/WASD 移动，ESC 或关闭窗口退出。")

    target_dir = game.direct  # 初始方向
    running = True
    while running:
        # 1. 处理事件（退出和键盘按键）
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
                break
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                    break
                # 方向映射：方向键和WASD
                if event.key in (pygame.K_UP, pygame.K_w):
                    target_dir = 'up'
                elif event.key in (pygame.K_DOWN, pygame.K_s):
                    target_dir = 'down'
                elif event.key in (pygame.K_LEFT, pygame.K_a):
                    target_dir = 'left'
                elif event.key in (pygame.K_RIGHT, pygame.K_d):
                    target_dir = 'right'

        if not running:
            break

        # 2. 根据目标方向计算动作
        action = get_action_from_direction(game.direct, target_dir)

        # 3. 执行一步
        reward, game_over, score = game.play_step(action)

        # 4. 游戏结束时自动重置
        if game_over:
            print(f"游戏结束！最终得分: {score}")
            game.reset()
            target_dir = game.direct  # 重置方向
            print("新一局开始...")

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()