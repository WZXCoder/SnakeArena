# Snake Arena（Web 版）

基于原 Pygame 项目的 **网页复刻**版贪吃蛇游戏。

## 目录结构

```
snake-web/
├── index.html          # 入口页
├── css/main.css        # 样式
├── js/                 # 游戏逻辑（ES Module）
├── models/             # ONNX 模型（需导出后放置）
└── scripts/
    └── export_onnx.py  # 从父目录 PyTorch 权重导出 ONNX
```

## 运行

### 方式一：本地静态服务（推荐）

```bash
cd snake-web
python -m http.server 8080
```

浏览器打开 `http://localhost:8080`。

### 方式二：直接打开

部分浏览器对 `file://` 下的 ES Module 有限制，若无法加载请改用方式一。

## 导出强化学习 ONNX 模型

在已训练并存在 `model/model_*/*.pth` 的前提下：

```bash
pip install torch onnx
python snake-web/scripts/export_onnx.py
```

将在 `snake-web/models/` 生成：

| 文件 | 算法 |
|------|------|
| dqn.onnx | DQN |
| ddqn.onnx | DDQN |
| dueling_dqn.onnx | Dueling DQN |
| ppo.onnx | PPO |
| trpo.onnx | TRPO |
| a2c.onnx | A2C |

未找到权重时，对应 RL 算法会与前版 Python 一致：回退为直走 `[1,0,0]`。

## 功能对照

| 模式 | 说明 |
|------|------|
| Single Player | 单人、阶梯加速、最高分（localStorage） |
| Two Players | 双人 3 局×30 秒、WASD / 方向键 |
| Play vs AI | 13 种算法可选 |
| AI Brawl | 2–4 条 AI 蛇混战 |

规划类算法（BFS、A*、Dijkstra、RRT、RRT*、APF、DWA）在浏览器内用 JavaScript 实现，逻辑与 `play_*.py` / `ui_ai_controllers.py` 一致。
