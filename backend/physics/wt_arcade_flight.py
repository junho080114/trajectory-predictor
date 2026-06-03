"""War Thunder 아케이드 모드에 가까운 단순 비행 모델."""
from __future__ import annotations

import math

import numpy as np

THROTTLE_SPOOL_RATE = 0.55
THROTTLE_BRAKE_RATE = 0.85
THROTTLE_IDLE = 0.38
WEP_THROTTLE_CAP = 1.08
MIN_SPEED_RATIO = 0.22
TURN_RATE_HIGH = 3.2
TURN_RATE_LOW = 1.35
STRAFE_YAW_RATE = 1.05
PITCH_RATE = 5.5
CLIMB_FROM_PITCH = 0.22


def integrate_throttle(current: float, throttle_cmd: float, boost: bool, dt: float) -> float:
    t = current
    if throttle_cmd > 0.05:
        t += throttle_cmd * THROTTLE_SPOOL_RATE * dt
    elif throttle_cmd < -0.05:
        t += throttle_cmd * THROTTLE_BRAKE_RATE * dt
    else:
        t += (THROTTLE_IDLE - t) * 0.35 * dt
    if boost:
        t = min(WEP_THROTTLE_CAP, t + 0.55 * dt)
    return float(max(0.0, min(WEP_THROTTLE_CAP, t)))


def arcade_turn_rate(speed_mps: float, max_mps: float) -> float:
    if max_mps < 1e-6:
        return TURN_RATE_LOW
    ratio = min(1.0, speed_mps / max_mps)
    return TURN_RATE_LOW + (TURN_RATE_HIGH - TURN_RATE_LOW) * (1.0 - ratio * 0.65)


def angle_lerp(current: float, target_angle: float, rate: float, dt: float) -> float:
    dh = target_angle - current
    while dh > math.pi:
        dh -= math.pi * 2
    while dh < -math.pi:
        dh += math.pi * 2
    return current + dh * min(1.0, rate * dt)


def update_arcade_velocity(
    heading: float,
    pitch: float,
    throttle: float,
    max_mps: float,
    boost: bool,
) -> tuple[np.ndarray, float]:
    cap = 1.12 if boost else 1.0
    speed = max(max_mps * MIN_SPEED_RATIO, throttle * max_mps * cap)
    h_speed = speed * math.cos(pitch)
    vel = np.array([math.sin(heading) * h_speed, math.cos(heading) * h_speed], dtype=float)
    return vel, speed
