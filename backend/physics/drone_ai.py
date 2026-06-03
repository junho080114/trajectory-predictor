from __future__ import annotations

from typing import List, Tuple

import numpy as np

EVADE_RANGE = 300.0
EVADE_ACCEL = 340.0
PATROL_SPEED_FACTOR = 0.6


def compute_missile_threat_3d(
    drone_pos: np.ndarray,
    drone_alt: float,
    projectiles: List[Tuple[np.ndarray, np.ndarray, float]],
) -> Tuple[np.ndarray, float, float]:
    """수평 회피, 긴급도, 수직 회피(-1~1)."""
    best_dir = np.zeros(2, dtype=float)
    best_urgency = 0.0
    best_v = 0.0
    for pos, vel, p_alt in projectiles:
        rel = drone_pos - pos
        horiz = float(np.linalg.norm(rel))
        if horiz > EVADE_RANGE or horiz < 1e-6:
            continue
        alt_diff = drone_alt - p_alt
        if abs(alt_diff) > 220 and horiz > 120:
            continue
        away = rel / horiz
        speed = float(np.linalg.norm(vel))
        if speed > 1e-6:
            vel_n = vel / speed
            closing = float(np.dot(vel_n, -away))
            if closing < 0.12:
                continue
        perp1 = np.array([-vel[1], vel[0]], dtype=float)
        pn1 = float(np.linalg.norm(perp1))
        if pn1 > 1e-6:
            perp1 /= pn1
        perp2 = -perp1
        perp = perp1 if float(np.dot(perp1, away)) >= float(np.dot(perp2, away)) else perp2
        urgency = (1.0 - horiz / EVADE_RANGE) * (0.55 + 0.45 * min(1.0, speed / 350.0))
        if abs(alt_diff) < 90:
            urgency *= 1.0 + 0.35 * (1.0 - abs(alt_diff) / 90.0)
        dodge = away * 0.5 + perp * 0.5
        dn = float(np.linalg.norm(dodge))
        if dn > 1e-6:
            dodge /= dn
        if urgency > best_urgency:
            best_urgency = urgency
            best_dir = dodge
            if abs(alt_diff) > 25:
                best_v = float(np.clip(alt_diff / 120.0, -1.0, 1.0))
    return best_dir, best_urgency, best_v


def compute_missile_threat(
    drone_pos: np.ndarray,
    projectiles: List[Tuple[np.ndarray, np.ndarray]],
) -> Tuple[np.ndarray, float]:
    """가장 위협적인 미사일에 대한 회피 방향·긴급도(0~1)."""
    best_dir = np.zeros(2, dtype=float)
    best_urgency = 0.0
    for pos, vel in projectiles:
        rel = drone_pos - pos
        dist = float(np.linalg.norm(rel))
        if dist > EVADE_RANGE or dist < 1e-6:
            continue
        away = rel / dist
        speed = float(np.linalg.norm(vel))
        if speed > 1e-6:
            vel_n = vel / speed
            closing = float(np.dot(vel_n, -away))
            if closing < 0.15:
                continue
        perp1 = np.array([-vel[1], vel[0]], dtype=float)
        pn1 = float(np.linalg.norm(perp1))
        if pn1 > 1e-6:
            perp1 /= pn1
        perp2 = -perp1
        perp = perp1 if float(np.dot(perp1, away)) >= float(np.dot(perp2, away)) else perp2
        urgency = (1.0 - dist / EVADE_RANGE) * (0.6 + 0.4 * min(1.0, speed / 400.0))
        dodge = away * 0.5 + perp * 0.5
        dn = float(np.linalg.norm(dodge))
        if dn > 1e-6:
            dodge /= dn
        if urgency > best_urgency:
            best_urgency = urgency
            best_dir = dodge
    return best_dir, best_urgency


def apply_evasion_velocity(
    velocity: np.ndarray,
    dodge_dir: np.ndarray,
    urgency: float,
    dt: float,
    max_speed: float,
) -> np.ndarray:
    if urgency <= 0.01:
        return velocity
    vel = velocity + dodge_dir * EVADE_ACCEL * urgency * dt
    spd = float(np.linalg.norm(vel))
    cap = max_speed * (1.0 + 0.45 * urgency)
    if spd > cap:
        vel = vel / spd * cap
    return vel
