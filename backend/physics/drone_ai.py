from __future__ import annotations

from typing import List, Tuple

import numpy as np

EVADE_RANGE = 300.0
EVADE_ACCEL = 340.0
PATROL_SPEED_FACTOR = 0.6
SEPARATION_RADIUS = 95.0
SEPARATION_ACCEL = 280.0
MIN_DRONE_GAP = 42.0


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


def compute_drone_separation(
    drone_id: str,
    drone_pos: np.ndarray,
    others: List[Tuple[str, np.ndarray]],
) -> np.ndarray:
    """다른 드론과 겹치지 않도록 밀어내는 방향."""
    sep = np.zeros(2, dtype=float)
    for oid, opos in others:
        if oid == drone_id:
            continue
        rel = drone_pos - opos
        dist = float(np.linalg.norm(rel))
        if dist < SEPARATION_RADIUS and dist > 1e-6:
            strength = (SEPARATION_RADIUS - dist) / SEPARATION_RADIUS
            sep += (rel / dist) * strength * strength
    norm = float(np.linalg.norm(sep))
    if norm > 1e-6:
        sep /= norm
    return sep


def apply_separation_velocity(
    velocity: np.ndarray,
    sep_dir: np.ndarray,
    dt: float,
    max_speed: float,
) -> np.ndarray:
    if float(np.linalg.norm(sep_dir)) < 0.02:
        return velocity
    vel = velocity + sep_dir * SEPARATION_ACCEL * dt
    spd = float(np.linalg.norm(vel))
    if spd > max_speed * 1.15:
        vel = vel / spd * max_speed * 1.15
    return vel


def resolve_drone_overlap(
    drone_id: str,
    position: np.ndarray,
    others: List[Tuple[str, np.ndarray]],
) -> np.ndarray:
    """너무 가까우면 위치를 즉시 밀어냄."""
    pos = position.copy()
    for oid, opos in others:
        if oid == drone_id:
            continue
        rel = pos - opos
        dist = float(np.linalg.norm(rel))
        if dist < MIN_DRONE_GAP:
            if dist < 1e-6:
                rel = np.array([1.0, 0.0], dtype=float)
                dist = 1.0
            push = (rel / dist) * (MIN_DRONE_GAP - dist) * 0.55
            pos = pos + push
    return pos


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
