"""자유도 높은 전투기 비행 — 각속도·관성·뱅크 선회."""
from __future__ import annotations

import math

import numpy as np

PITCH_MIN = -0.82
PITCH_MAX = 0.72
BANK_MAX = 1.05
YAW_RATE_MAX = 2.65
PITCH_RATE_MAX = 2.1
ROLL_RATE_MAX = 2.4
BANK_TO_YAW = 1.75
BANK_DAMP = 3.2
SPEED_ACCEL = 1.8
SPEED_DECEL = 2.4
MIN_SPEED_RATIO = 0.18
THROTTLE_IDLE = 0.32
VERTICAL_PITCH_RATE = 1.15
CLIMB_FROM_PITCH = 0.95
DRAG_COAST = 0.45


def integrate_throttle_free(
    current: float, throttle_cmd: float, boost: bool, dt: float
) -> float:
    t = current
    if throttle_cmd > 0.05:
        t += throttle_cmd * 0.62 * dt
    elif throttle_cmd < -0.05:
        t += throttle_cmd * 0.95 * dt
    else:
        t += (THROTTLE_IDLE - t) * 0.28 * dt
    if boost:
        t = min(1.12, t + 0.65 * dt)
    return float(max(0.0, min(1.12, t)))


def speed_turn_factor(speed_mps: float, max_mps: float) -> float:
    """저속·고속에서 선회율 변화 (스톨 완화, 고속 안정)."""
    if max_mps < 1e-6:
        return 0.55
    r = speed_mps / max_mps
    return float(max(0.42, min(1.0, 0.5 + r * 0.55)))


def update_free_flight(
    heading: float,
    pitch: float,
    bank: float,
    speed: float,
    throttle: float,
    yaw_input: float,
    pitch_input: float,
    roll_input: float,
    vertical_input: float,
    boost: bool,
    max_mps: float,
    dt: float,
) -> tuple[float, float, float, float, np.ndarray, float]:
    """
    yaw/pitch_input: -1..1 조종 stick (마우스·키)
    roll_input: A/D 뱅크
    반환: heading, pitch, bank, speed, velocity_xy, climb_mps
    """
    tf = speed_turn_factor(speed, max_mps)

    roll_rate = roll_input * ROLL_RATE_MAX * tf
    bank += roll_rate * dt
    bank -= bank * BANK_DAMP * dt
    bank = float(max(-BANK_MAX, min(BANK_MAX, bank)))

    yaw_rate = yaw_input * YAW_RATE_MAX * tf + bank * BANK_TO_YAW * tf
    pitch_rate = (
        pitch_input * PITCH_RATE_MAX * tf
        + vertical_input * VERTICAL_PITCH_RATE * tf
    )

    heading += yaw_rate * dt
    pitch += pitch_rate * dt
    pitch = float(max(PITCH_MIN, min(PITCH_MAX, pitch)))

    cap = 1.14 if boost else 1.0
    target_speed = max(max_mps * MIN_SPEED_RATIO, throttle * max_mps * cap)
    if throttle < 0.08:
        target_speed = max(max_mps * MIN_SPEED_RATIO * 0.85, speed - max_mps * 0.15 * dt)

    accel = SPEED_ACCEL if target_speed > speed else SPEED_DECEL
    speed += (target_speed - speed) * min(1.0, accel * dt)

    h_speed = speed * math.cos(pitch)
    vel = np.array(
        [math.sin(heading) * h_speed, math.cos(heading) * h_speed],
        dtype=float,
    )
    climb = speed * math.sin(pitch) * CLIMB_FROM_PITCH
    if abs(vertical_input) > 0.05:
        climb += vertical_input * 95.0

    return heading, pitch, bank, speed, vel, climb
