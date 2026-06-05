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
        self._last_aim: Optional[np.ndarray] = None

    def record_target(self, position: np.ndarray, velocity: np.ndarray) -> None:
        self._pos_history.append(position.astype(float).copy())
        self._vel_history.append(velocity.astype(float).copy())

    def estimate_acceleration(self) -> np.ndarray:
        if len(self._vel_history) < 2:
            return np.zeros(2, dtype=float)
        return (self._vel_history[-1] - self._vel_history[-2]) * 60.0

    def _clamp_aim_ahead(
        self, aim: np.ndarray, missile_pos: np.ndarray, target_pos: np.ndarray
    ) -> np.ndarray:
        """조준점이 미사일 뒤쪽으로 가면 타겟 방향으로 보정."""
        to_tgt = target_pos - missile_pos
        to_aim = aim - missile_pos
        tgt_d = float(np.linalg.norm(to_tgt))
        aim_d = float(np.linalg.norm(to_aim))
        if tgt_d < 1e-6 or aim_d < 1e-6:
            return target_pos.astype(float).copy()
        if float(np.dot(to_aim / aim_d, to_tgt / tgt_d)) < 0.12:
            lead = target_pos + (target_pos - missile_pos) * 0.08
            return lead.astype(float)
        return aim.astype(float)

    def smooth_aim(
        self, aim: np.ndarray, missile_pos: np.ndarray, target_pos: np.ndarray
    ) -> np.ndarray:
        aim = self._clamp_aim_ahead(aim, missile_pos, target_pos)
        if self._last_aim is None:
            self._last_aim = aim.copy()
            return aim
        smoothed = self._last_aim * 0.55 + aim * 0.45
        self._last_aim = smoothed.copy()
        return smoothed.astype(float)

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
        if kalman_pos is not None and kalman_vel is not None:
            pos = kalman_pos
            vel = kalman_vel
        else:
            pos = position
            vel = velocity

        acc_hist = self.estimate_acceleration()
        inp = input_dir if np.linalg.norm(input_dir) > 1e-6 else np.zeros(2)
        if float(np.linalg.norm(inp)) > 1e-6:
            inp = inp / float(np.linalg.norm(inp))
        inp_acc = inp * PLAYER_ACCEL_EST * (PLAYER_BOOST_EST if input_boost else 1.0)
        acc = 0.55 * acc_hist + 0.45 * inp_acc

        dist = float(np.linalg.norm(pos - missile_pos))
        t_lead = (dist / max(missile_speed, 90.0)) * (0.88 + 0.12 * difficulty)
        t_lead = min(t_lead, 2.2)

        predicted = pos + vel * t_lead + 0.38 * acc * (t_lead**2)
        if lstm_pos is not None:
            predicted = 0.75 * predicted + 0.25 * lstm_pos
        return self.smooth_aim(predicted, missile_pos, pos)

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
        speed = base_speed * (1.0 + 0.18 * difficulty)
        turn_rate = base_turn_rate * (1.0 + 1.4 * difficulty)

        vel_spd = float(np.linalg.norm(missile_vel))
        if vel_spd > 1e-6 and dist > 1e-6:
            rel_n = rel / dist
            vel_n = missile_vel / vel_spd
            closing = float(np.dot(vel_n, rel_n))
            rel_vel = target_vel - missile_vel
            dist_sq = float(np.dot(rel, rel)) + 1e-6
            los_rate = abs((rel[0] * rel_vel[1] - rel[1] * rel_vel[0]) / dist_sq)
            orbiting = dist < 300.0 and (closing < 0.35 or los_rate > 0.55)
            if orbiting:
                direct = rel_n
                spd = speed * 1.08
                travel = min(spd * dt, max(dist * 0.96, 2.0))
                return direct * spd, missile_pos + direct * travel, spd

        if dist < 120:
            direct = rel / max(dist, 1e-6)
            spd = speed * 1.1
            travel = min(spd * dt, max(dist * 0.98, 2.0))
            return direct * spd, missile_pos + direct * travel, spd

        if dist < 320:
            turn_rate = min(turn_rate, base_turn_rate * 2.2)

        aim_point = self.smooth_aim(aim_point, missile_pos, target_pos)
        pn_blend = 0.12 + min(0.15, 80.0 / max(dist, 60.0))
        vel = apply_homing_steering(
            missile_pos,
            missile_vel,
            aim_point,
            target_pos,
            target_vel,
            speed,
            turn_rate,
            dt,
            pn_gain=pn_gain * (0.85 + 0.15 * difficulty),
            pn_blend=pn_blend,
        )
        pos = missile_pos + vel * dt
        return vel, pos, speed
