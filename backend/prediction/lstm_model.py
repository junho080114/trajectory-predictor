from __future__ import annotations

import torch
import torch.nn as nn

INPUT_DIM = 2
HIDDEN_DIM = 96
NUM_LAYERS = 2
SEQ_LEN = 20


class TrajectoryLSTM(nn.Module):
    """다음 스텝 변위(delta) 예측 — 궤적이 끊기지 않도록 설계."""

    def __init__(
        self,
        input_dim: int = INPUT_DIM,
        hidden_dim: int = HIDDEN_DIM,
        num_layers: int = NUM_LAYERS,
    ) -> None:
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True)
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, input_dim),
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        last = out[:, -1, :]
        return self.fc(last)
