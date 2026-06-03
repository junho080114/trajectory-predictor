from __future__ import annotations

from collections import deque
from typing import Deque, Optional

import numpy as np

from physics.homing import apply_homing_steering

PLAYER_ACCEL_EST = 280.0
PLAYER_BOOST_EST = 1.45


class SmartMissileTracker:
    """플레이어 입력·속도 이력·칼만 상태를 결합한 유도 AI."""

    def __init__(self, history_len: int = 10) -> None:
        self._vel_history: Deque[np.ndarray] = deque(maxlen=history_len)
        self._pos_history: Deque[np.ndarray] = deque(maxlen=history_len)

    def record_target(self, position: np.ndarray, velocity: np.ndarray) -> None:
        self._pos_history.append(position.astype(float).copy())
        self._vel_history.append(velocity.astype(float).copy())

    def estimate_acceleration(self) -> np.ndarray:
        if len(self._vel_history) < 2:
            return np.zeros(2, dtype=float)
        return (self._vel_history[-1] - self._vel_history[-2]) * 60.0

    def predict_target(
        self,
        position: np.ndarray,
        velocity: np.ndarray,
        missile_pos: np.ndarray,
        missile_speed: float,
        input_dir: np.ndarray,
        input_boost: bool,
        kalman_pos: Optional[np.ndarray] = None,
        kalman_vel: Optional[np.ndarray] = None,
        lstm_pos: Optional[np.ndarray] = None,
        difficulty: float = 1.0,
    ) -> np.ndarray:
        pos = kalman_pos if kalman_pos is not None else position
        vel = kalman_vel if kalman_vel is not None else velocity
        acc_hist = self.estimate_acceleration()
        inp = input_dir if np.linalg.norm(input_dir) > 1e-6 else np.zeros(2)
        inp_acc = inp * PLAYER_ACCEL_EST * (PLAYER_BOOST_EST if input_boost else 1.0)
        acc = 0.5 * acc_hist + 0.5 * inp_acc

        dist = float(np.linalg.norm(pos - missile_pos))
        t_lead = (dist / max(missile_speed, 100.0)) * (1.0 + 0.12 * difficulty)
        t_lead = min(t_lead, 2.2)

        predicted = pos + vel * t_lead + 0.45 * acc * (t_lead**2)
        if lstm_pos is not None:
            predicted = 0.82 * predicted + 0.18 * lstm_pos
        return predicted.astype(float)

    def guide_missile(
        self,
        missile_pos: np.ndarray,
        missile_vel: np.ndarray,
        aim_point: np.ndarray,
        target_pos: np.ndarray,
        target_vel: np.ndarray,
        base_speed: float,
        base_turn_rate: float,
        dt: float,
        difficulty: float = 1.0,
        pn_gain: float = 5.5,
    ) -> tuple[np.ndarray, np.ndarray, float]:
        rel = target_pos - missile_pos
        dist = float(np.linalg.norm(rel))
        speed = base_speed * (1.0 + 0.22 * difficulty)
        turn_rate = base_turn_rate * (1.0 + 2.2 * difficulty)

        if dist < 280:
            turn_rate *= 1.0 + (280 - dist) / 120.0
        if dist < 120:
            speed *= 1.0 + 0.25 * difficulty
            turn_rate *= 1.8

        if dist < 55:
            direct = rel / max(dist, 1e-6)
            spd = speed * 1.2
            travel = min(spd * dt, max(dist * 0.98, 2.0))
            return direct * spd, missile_pos + direct * travel, spd

        pn_blend = 0.38 + min(0.22, 120.0 / max(dist, 40.0))
        vel = apply_homing_steering(
            missile_pos,
            missile_vel,
            aim_point,
            target_pos,
            target_vel,
            speed,
            turn_rate,
            dt,
            pn_gain=pn_gain * (0.9 + 0.2 * difficulty),
            pn_blend=pn_blend,
        )
        pos = missile_pos + vel * dt
        return vel, pos, speed
