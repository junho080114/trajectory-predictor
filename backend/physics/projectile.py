from __future__ import annotations

import math
from typing import List, Tuple

import numpy as np

GRAVITY = 9.81
AIR_DRAG_COEFF = 0.002


def integrate_projectile(
    position: np.ndarray,
    velocity: np.ndarray,
    dt: float,
    use_air_resistance: bool = False,
) -> Tuple[np.ndarray, np.ndarray]:
    pos = position.astype(float).copy()
    vel = velocity.astype(float).copy()
    accel = np.array([0.0, GRAVITY], dtype=float)
    if use_air_resistance:
        speed = np.linalg.norm(vel)
        if speed > 1e-6:
            drag = -AIR_DRAG_COEFF * speed * vel
            accel = accel + drag
    vel = vel + accel * dt
    pos = pos + vel * dt
    return pos, vel


def simulate_trajectory(
    origin: np.ndarray,
    initial_velocity: np.ndarray,
    duration: float,
    dt: float = 0.02,
    use_air_resistance: bool = False,
) -> List[np.ndarray]:
    points: List[np.ndarray] = []
    pos = origin.astype(float).copy()
    vel = initial_velocity.astype(float).copy()
    steps = max(1, int(duration / dt))
    for _ in range(steps):
        points.append(pos.copy())
        pos, vel = integrate_projectile(pos, vel, dt, use_air_resistance)
    return points


def velocity_from_angle(speed: float, angle_rad: float) -> np.ndarray:
    return np.array([speed * math.cos(angle_rad), -speed * math.sin(angle_rad)], dtype=float)


def flight_time_to_y(origin_y: float, target_y: float, vy0: float) -> float:
    a = 0.5 * GRAVITY
    b = -vy0
    c = origin_y - target_y
    disc = b * b - 4 * a * c
    if disc < 0:
        return -1.0
    t1 = (-b + math.sqrt(disc)) / (2 * a)
    t2 = (-b - math.sqrt(disc)) / (2 * a)
    candidates = [t for t in (t1, t2) if t > 1e-4]
    if not candidates:
        return -1.0
    return min(candidates)


def position_at_time(origin: np.ndarray, velocity: np.ndarray, t: float) -> np.ndarray:
    x = origin[0] + velocity[0] * t
    y = origin[1] + velocity[1] * t + 0.5 * GRAVITY * t * t
    return np.array([x, y], dtype=float)
