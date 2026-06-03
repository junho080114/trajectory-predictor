from __future__ import annotations

import math
from typing import Tuple

import numpy as np


def compute_lead_point(
    missile_pos: np.ndarray,
    missile_speed: float,
    target_pos: np.ndarray,
    target_vel: np.ndarray,
    lead_factor: float = 1.08,
) -> np.ndarray:
    rel = target_pos - missile_pos
    dist = float(np.linalg.norm(rel))
    if dist < 1e-6:
        return target_pos.astype(float).copy()
    t_lead = (dist / max(missile_speed, 1.0)) * lead_factor
    return target_pos + target_vel * t_lead


def proportional_navigation(
    missile_pos: np.ndarray,
    missile_vel: np.ndarray,
    target_pos: np.ndarray,
    target_vel: np.ndarray,
    nav_gain: float = 4.0,
    dt: float = 1.0 / 60.0,
) -> np.ndarray:
    rel_pos = target_pos - missile_pos
    rel_vel = target_vel - missile_vel
    dist_sq = float(np.dot(rel_pos, rel_pos)) + 1e-6
    los_rate = (rel_pos[0] * rel_vel[1] - rel_pos[1] * rel_vel[0]) / dist_sq
    speed = max(float(np.linalg.norm(missile_vel)), 1.0)
    perp = np.array([-rel_pos[1], rel_pos[0]], dtype=float)
    norm_p = np.linalg.norm(perp)
    if norm_p > 1e-6:
        perp = perp / norm_p
    accel_cmd = nav_gain * los_rate * speed * perp
    desired_vel = missile_vel + accel_cmd * min(max(dt, 1.0 / 240.0), 0.05)
    dnorm = np.linalg.norm(desired_vel)
    if dnorm > 1e-6:
        return desired_vel / dnorm
    rel_n = np.linalg.norm(rel_pos)
    return rel_pos / rel_n if rel_n > 1e-6 else np.array([1.0, 0.0])


def steer_toward(
    position: np.ndarray,
    velocity: np.ndarray,
    aim_point: np.ndarray,
    speed: float,
    max_turn_rate: float,
    dt: float,
) -> np.ndarray:
    desired = aim_point - position
    dist = float(np.linalg.norm(desired))
    if dist < 1e-6:
        spd = max(float(np.linalg.norm(velocity)), speed * 0.5)
        return velocity if float(np.linalg.norm(velocity)) > 1e-3 else desired_dir * speed
    desired_dir = desired / dist
    current_speed = float(np.linalg.norm(velocity))
    if current_speed < 1e-6:
        return desired_dir * speed
    current_dir = velocity / current_speed
    dot = float(np.clip(np.dot(current_dir, desired_dir), -1.0, 1.0))
    angle = math.acos(dot)
    max_rot = max_turn_rate * dt
    if angle <= max_rot or angle < 1e-6:
        new_dir = desired_dir
    else:
        cross = current_dir[0] * desired_dir[1] - current_dir[1] * desired_dir[0]
        turn = max_rot if cross >= 0 else -max_rot
        c, s = math.cos(turn), math.sin(turn)
        new_dir = np.array(
            [current_dir[0] * c - current_dir[1] * s, current_dir[0] * s + current_dir[1] * c],
            dtype=float,
        )
    return new_dir * speed


def apply_homing_steering(
    missile_pos: np.ndarray,
    missile_vel: np.ndarray,
    aim_point: np.ndarray,
    target_pos: np.ndarray,
    target_vel: np.ndarray,
    speed: float,
    max_turn_rate: float,
    dt: float,
    pn_gain: float = 5.5,
    pn_blend: float = 0.42,
) -> np.ndarray:
    """선행 조준점 + 비례항법(PN) 방향을 속도 벡터로 합성."""
    steered = steer_toward(missile_pos, missile_vel, aim_point, speed, max_turn_rate, dt)
    pn_dir = proportional_navigation(
        missile_pos, missile_vel, target_pos, target_vel, nav_gain=pn_gain, dt=dt
    )
    sn = float(np.linalg.norm(steered))
    if sn < 1e-6:
        return pn_dir * speed
    cur = steered / sn
    blend = float(np.clip(pn_blend, 0.0, 0.85))
    mixed = (1.0 - blend) * cur + blend * pn_dir
    mn = float(np.linalg.norm(mixed))
    if mn > 1e-6:
        mixed /= mn
    return mixed * speed
