from __future__ import annotations

from pathlib import Path
from typing import List, Tuple

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from prediction.lstm_model import INPUT_DIM, SEQ_LEN, TrajectoryLSTM

MODEL_PATH = Path(__file__).resolve().parent / "prediction" / "model.pt"


def generate_sine(n: int = 800, dt: float = 0.05) -> np.ndarray:
    t = np.arange(n) * dt
    return np.stack([400 + 200 * np.sin(0.8 * t), 300 + 80 * np.cos(1.2 * t)], axis=1)


def generate_zigzag(n: int = 800, dt: float = 0.05) -> np.ndarray:
    points = []
    x, y = 400.0, 350.0
    vx, vy = 100.0, 60.0
    for i in range(n):
        if i % 50 == 0:
            vy = -vy
        if i % 80 == 0:
            vx = -vx
        x = np.clip(x + vx * dt, 80, 1120)
        y = np.clip(y + vy * dt, 80, 620)
        points.append([x, y])
    return np.array(points, dtype=float)


def generate_random_walk(n: int = 800, dt: float = 0.05) -> np.ndarray:
    pos = np.array([500.0, 350.0])
    vel = np.array([60.0, 40.0])
    traj = []
    for _ in range(n):
        vel += np.random.randn(2) * 12.0 * dt
        vel = np.clip(vel, -120, 120)
        pos = pos + vel * dt
        pos[0] = np.clip(pos[0], 100, 1100)
        pos[1] = np.clip(pos[1], 100, 600)
        traj.append(pos.copy())
    return np.array(traj, dtype=float)


def generate_circle(n: int = 800, dt: float = 0.05) -> np.ndarray:
    t = np.arange(n) * dt
    cx, cy, r = 600.0, 350.0, 150.0
    return np.stack([cx + r * np.cos(1.2 * t), cy + r * np.sin(1.2 * t)], axis=1)


def generate_player_like(n: int = 800, dt: float = 0.05) -> np.ndarray:
    pos = np.array([600.0, 350.0])
    vel = np.array([80.0, 0.0])
    traj = []
    for i in range(n):
        angle = (i // 60) * 0.9
        vel = np.array([np.cos(angle) * 90, np.sin(angle) * 70])
        pos = pos + vel * dt
        pos[0] = np.clip(pos[0], 120, 1080)
        pos[1] = np.clip(pos[1], 120, 580)
        if pos[0] <= 120 or pos[0] >= 1080:
            vel[0] *= -1
        if pos[1] <= 120 or pos[1] >= 580:
            vel[1] *= -1
        traj.append(pos.copy())
    return np.array(traj, dtype=float)


def build_delta_dataset(trajectories: List[np.ndarray]) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    xs, ys = [], []
    for traj in trajectories:
        deltas = np.diff(traj, axis=0)
        for i in range(SEQ_LEN, len(deltas)):
            xs.append(deltas[i - SEQ_LEN : i])
            ys.append(deltas[i])
    X = np.array(xs, dtype=float)
    Y = np.array(ys, dtype=float)
    mean = X.reshape(-1, INPUT_DIM).mean(axis=0)
    std = X.reshape(-1, INPUT_DIM).std(axis=0) + 1e-6
    Xn = (X - mean) / std
    Yn = (Y - mean) / std
    return Xn, Yn, mean, std


def train_and_save(path: str | None = None) -> str:
    out_path = Path(path) if path else MODEL_PATH
    trajectories = [
        generate_sine(800),
        generate_zigzag(800),
        generate_random_walk(800),
        generate_circle(800),
        generate_player_like(800),
    ]
    X, Y, mean, std = build_delta_dataset(trajectories)
    X_t = torch.tensor(X, dtype=torch.float32)
    Y_t = torch.tensor(Y, dtype=torch.float32)
    loader = DataLoader(TensorDataset(X_t, Y_t), batch_size=128, shuffle=True)
    model = TrajectoryLSTM()
    optimizer = torch.optim.Adam(model.parameters(), lr=8e-4)
    criterion = nn.SmoothL1Loss()
    model.train()
    for epoch in range(40):
        total = 0.0
        for xb, yb in loader:
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()
            total += loss.item()
        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch + 1}/40 loss={total / max(len(loader), 1):.6f}")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "model_state": model.state_dict(),
            "mean": mean.tolist(),
            "std": std.tolist(),
            "predicts_delta": True,
        },
        out_path,
    )
    print(f"Model saved to {out_path}")
    return str(out_path)


if __name__ == "__main__":
    train_and_save()
