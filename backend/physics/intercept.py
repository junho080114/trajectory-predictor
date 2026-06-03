from __future__ import annotations

import math
from typing import Tuple

import numpy as np
from scipy.optimize import minimize_scalar

from physics.projectile import GRAVITY, flight_time_to_y, velocity_from_angle


def target_position_at(
    pos: np.ndarray,
    vel: np.ndarray,
    acc: np.ndarray,
    t: float,
) -> np.ndarray:
    return pos + vel * t + 0.5 * acc * t * t


def intercept_error(
    t: float,
    origin: np.ndarray,
    muzzle_speed: float,
    target_pos: np.ndarray,
    target_vel: np.ndarray,
    target_acc: np.ndarray,
) -> float:
    if t <= 0.01:
        return 1e9
    tgt = target_position_at(target_pos, target_vel, target_acc, t)
    dx = tgt[0] - origin[0]
    dy = origin[1] - tgt[1]
    if dy <= 0:
        return 1e8 + abs(dy)
    discriminant = muzzle_speed**4 - GRAVITY * (GRAVITY * dx * dx + 2 * dy * muzzle_speed**2)
    if discriminant < 0:
        return 1e7 + abs(discriminant)
    root = math.sqrt(discriminant)
    tan_theta1 = (muzzle_speed**2 + root) / (GRAVITY * dx) if abs(dx) > 1e-6 else 0.0
    tan_theta2 = (muzzle_speed**2 - root) / (GRAVITY * dx) if abs(dx) > 1e-6 else 0.0
    angles = []
    if abs(dx) > 1e-6:
        angles.append(math.atan(tan_theta1))
        angles.append(math.atan(tan_theta2))
    else:
        angles.append(math.pi / 2)
    best_err = 1e6
    for angle in angles:
        vel = velocity_from_angle(muzzle_speed, angle)
        t_flight = flight_time_to_y(origin[1], tgt[1], vel[1])
        if t_flight < 0:
            continue
        err = abs(t_flight - t)
        if err < best_err:
            best_err = err
    return best_err


def solve_intercept(
    origin: np.ndarray,
    muzzle_speed: float,
    target_pos: np.ndarray,
    target_vel: np.ndarray,
    target_acc: np.ndarray | None = None,
    t_max: float = 8.0,
) -> Tuple[bool, np.ndarray, float, float, bool]:
    acc = target_acc if target_acc is not None else np.zeros(2)
    result = minimize_scalar(
        lambda t: intercept_error(t, origin, muzzle_speed, target_pos, target_vel, acc),
        bounds=(0.1, t_max),
        method="bounded",
    )
    t_hit = float(result.x)
    success = result.fun < 0.5
    fallback = False
    if not success:
        fallback = True
        lead_time = np.linalg.norm(target_pos - origin) / max(muzzle_speed, 1.0)
        t_hit = max(0.5, min(t_max, lead_time))
    intercept_pt = target_position_at(target_pos, target_vel, acc, t_hit)
    dx = intercept_pt[0] - origin[0]
    dy = origin[1] - intercept_pt[1]
    if abs(dx) < 1e-6:
        angle = math.pi / 2 if dy > 0 else 0.0
    else:
        discriminant = muzzle_speed**4 - GRAVITY * (GRAVITY * dx * dx + 2 * dy * muzzle_speed**2)
        if discriminant < 0:
            angle = math.atan2(dy, dx)
        else:
            root = math.sqrt(discriminant)
            tan_theta = (muzzle_speed**2 - root) / (GRAVITY * dx)
            angle = math.atan(tan_theta)
    angle_deg = math.degrees(angle)
    return success, intercept_pt, angle_deg, t_hit, fallback
