from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import List, Optional

import numpy as np
import torch

from prediction.lstm_model import INPUT_DIM, SEQ_LEN, TrajectoryLSTM

MODEL_DIR = Path(__file__).resolve().parent
MODEL_PATH = MODEL_DIR / "model.pt"
SMOOTH_ALPHA = 0.32


class LSTMPredictor:
    def __init__(self) -> None:
        self.device = torch.device("cpu")
        self.model = TrajectoryLSTM().to(self.device)
        self.history: List[np.ndarray] = []
        self.mean = np.zeros(2, dtype=float)
        self.std = np.ones(2, dtype=float)
        self._predicts_delta = True
        self._loaded = False
        self._ensure_model()

    def _ensure_model(self) -> None:
        if MODEL_PATH.exists():
            self._load()
            return
        backend_dir = Path(__file__).resolve().parent.parent
        train_path = backend_dir / "train.py"
        spec = importlib.util.spec_from_file_location("train_module", train_path)
        if spec is None or spec.loader is None:
            raise RuntimeError("Cannot load train.py")
        train_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(train_module)
        train_module.train_and_save(str(MODEL_PATH))
        self._load()

    def _load(self) -> None:
        checkpoint = torch.load(MODEL_PATH, map_location=self.device, weights_only=False)
        self.model.load_state_dict(checkpoint["model_state"], strict=False)
        self.mean = np.array(checkpoint.get("mean", [0, 0]), dtype=float)
        self.std = np.array(checkpoint.get("std", [1, 1]), dtype=float)
        self._predicts_delta = bool(checkpoint.get("predicts_delta", True))
        self.model.eval()
        self._loaded = True

    def add_observation(self, position: np.ndarray) -> None:
        self.history.append(position.astype(float).copy())
        if len(self.history) > SEQ_LEN * 3:
            self.history = self.history[-SEQ_LEN * 3 :]

    def _velocity_fallback(self) -> np.ndarray:
        if len(self.history) >= 2:
            return self.history[-1] - self.history[-2]
        return np.zeros(2, dtype=float)

    def _infer_delta(self, seq: np.ndarray) -> np.ndarray:
        normed = (seq - self.mean) / (self.std + 1e-6)
        tensor = torch.tensor(normed, dtype=torch.float32).unsqueeze(0).to(self.device)
        with torch.no_grad():
            out = self.model(tensor).cpu().numpy()[0]
        if self._predicts_delta:
            return out * self.std
        return out * self.std + self.mean - seq[-1]

    def predict_next(self, current_pos: np.ndarray) -> np.ndarray:
        if len(self.history) < 2:
            return current_pos + self._velocity_fallback()
        if len(self.history) < SEQ_LEN:
            delta = self._velocity_fallback()
            return current_pos + delta * SMOOTH_ALPHA
        seq = np.array(self.history[-SEQ_LEN:], dtype=float)
        delta = self._infer_delta(seq)
        vel = self._velocity_fallback()
        blended = SMOOTH_ALPHA * delta + (1.0 - SMOOTH_ALPHA) * vel
        max_step = 45.0
        norm = float(np.linalg.norm(blended))
        if norm > max_step:
            blended = blended / norm * max_step
        return (current_pos + blended).astype(float)

    def predict_trajectory(
        self,
        start: np.ndarray,
        steps: int = 40,
        dt_scale: float = 1.0,
    ) -> List[np.ndarray]:
        if len(self.history) < SEQ_LEN:
            vel = self._velocity_fallback()
            return [start + vel * (i * dt_scale) for i in range(1, steps + 1)]

        trajectory: List[np.ndarray] = []
        pos = start.astype(float).copy()
        rolling = list(self.history[-SEQ_LEN:])

        for _ in range(steps):
            seq = np.array(rolling[-SEQ_LEN:], dtype=float)
            delta = self._infer_delta(seq)
            vel = pos - rolling[-1] if len(rolling) >= 1 else self._velocity_fallback()
            step = SMOOTH_ALPHA * delta + (1.0 - SMOOTH_ALPHA) * vel
            norm = float(np.linalg.norm(step))
            if norm > 32.0:
                step = step / norm * 32.0
            pos = pos + step * dt_scale
            trajectory.append(pos.copy())
            rolling.append(pos.copy())

        if len(trajectory) >= 3:
            smoothed: List[np.ndarray] = []
            for i, p in enumerate(trajectory):
                lo = max(0, i - 1)
                hi = min(len(trajectory), i + 2)
                chunk = trajectory[lo:hi]
                smoothed.append(np.mean(np.stack(chunk, axis=0), axis=0))
            trajectory = smoothed

        return trajectory
