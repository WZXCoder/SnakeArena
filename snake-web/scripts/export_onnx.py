#!/usr/bin/env python3
"""
将父目录 RL 项目中的 PyTorch 模型导出为 ONNX（不修改原有代码）。
运行方式（在 snake-web/scripts 目录或项目根目录）:
  python snake-web/scripts/export_onnx.py
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))


def _load_state(model, best: str, normal: str, key: str):
    import torch

    ckpt_path = best if os.path.exists(best) else normal
    if not os.path.exists(ckpt_path):
        return False
    checkpoint = torch.load(ckpt_path, map_location="cpu")
    if isinstance(checkpoint, dict) and key in checkpoint:
        model.load_state_dict(checkpoint[key])
    elif isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)
    model.eval()
    return True


def export_dqn_family():
    import torch
    from model_DQN import Linear_QNet

    specs = [
        ("dqn.onnx", "DQN", "model/model_DQN"),
        ("ddqn.onnx", "DDQN", "model/model_DDQN"),
    ]
    for fname, tag, folder in specs:
        model = Linear_QNet(11, 256, 3)
        best = os.path.join(ROOT, folder, f"best_model_{tag}.pth")
        normal = os.path.join(ROOT, folder, f"model_{tag}.pth")
        if not _load_state(model, best, normal, "model_state_dict"):
            print(f"[跳过] {tag}: 未找到权重")
            continue
        dummy = torch.zeros(1, 11, dtype=torch.float32)
        path = os.path.join(OUT_DIR, fname)
        torch.onnx.export(
            model,
            dummy,
            path,
            input_names=["input"],
            output_names=["output"],
            dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
            opset_version=11,
        )
        print(f"[完成] {path}")


def export_dueling():
    import torch
    from model_DuelingDQN import DuelingQNet

    model = DuelingQNet(11, 256, 3)
    folder = os.path.join(ROOT, "model/model_DuelingDQN")
    best = os.path.join(folder, "best_model_DuelingDQN.pth")
    normal = os.path.join(folder, "model_DuelingDQN.pth")
    if not _load_state(model, best, normal, "model_state_dict"):
        print("[跳过] DuelingDQN: 未找到权重")
        return
    dummy = torch.zeros(1, 11, dtype=torch.float32)
    path = os.path.join(OUT_DIR, "dueling_dqn.onnx")
    torch.onnx.export(
        model,
        dummy,
        path,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=11,
    )
    print(f"[完成] {path}")


def export_actor(name: str, out_file: str):
    import torch

    if name == "PPO":
        from model_PPO import Actor
    elif name == "TRPO":
        from model_TRPO import Actor
    elif name == "A2C":
        from model_A2C import Actor
    else:
        raise ValueError(name)

    model = Actor(11, 256, 3)
    folder = os.path.join(ROOT, f"model/model_{name}")
    best = os.path.join(folder, f"best_model_{name}.pth")
    normal = os.path.join(folder, f"model_{name}.pth")
    if not _load_state(model, best, normal, "actor_state_dict"):
        print(f"[跳过] {name}: 未找到权重")
        return
    dummy = torch.zeros(1, 11, dtype=torch.float32)
    path = os.path.join(OUT_DIR, out_file)
    torch.onnx.export(
        model,
        dummy,
        path,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=11,
    )
    print(f"[完成] {path}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    try:
        import torch  # noqa: F401
    except ImportError:
        print("请先安装 PyTorch: pip install torch")
        sys.exit(1)

    print(f"导出目录: {OUT_DIR}")
    print(f"读取权重自: {ROOT}")
    export_dqn_family()
    export_dueling()
    for algo, fname in [("PPO", "ppo.onnx"), ("TRPO", "trpo.onnx"), ("A2C", "a2c.onnx")]:
        export_actor(algo, fname)
    print("全部导出流程结束。")


if __name__ == "__main__":
    main()
