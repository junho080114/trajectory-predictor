"""적 미사일 — 플레이어만 추적, 칼만·입력 기반 선행 예측."""
from __future__ import annotations

import numpy as np

from prediction.kalman import TargetKalmanFilter


def predict_player_aim(
    kalman: TargetKalmanFilter,
    missile_pos: np.ndarray,
    missile_speed: float,
    input_strafe: float,
    input_forward: float,
    input_boost: bool,
    difficulty: float = 1.0,
    lstm_hint: np.ndarray | None = None,
) -> np.ndarray:
    kpos, kvel = kalman.get_state()
    dist = float(np.linalg.norm(kpos - missile_pos))
    t_lead = (dist / max(missile_speed, 90.0)) * (0.95 + 0.1 * difficulty)
    t_lead = float(np.clip(t_lead, 0.12, 2.6))

    pred_linear = kalman.linear_predict(t_lead)
    future = kalman.predict_future(t_lead, dt=0.07)
    pred_kf = future[-1] if future else pred_linear

    inp = np.array([input_strafe, input_forward], dtype=float)
    if float(np.linalg.norm(inp)) > 1e-6:
        inp = inp / float(np.linalg.norm(inp))
    accel = 260.0 * (1.42 if input_boost else 1.0)
    pred_input = kpos + kvel * t_lead + inp * accel * (t_lead**2) * 0.42

    aim = 0.38 * pred_kf + 0.32 * pred_linear + 0.30 * pred_input
    if lstm_hint is not None:
        aim = 0.78 * aim + 0.22 * lstm_hint
    return aim.astype(float)
