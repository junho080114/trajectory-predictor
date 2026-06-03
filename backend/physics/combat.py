"""전투 게임: 플레이어 사격·HP·점수."""
from __future__ import annotations

import math
from typing import Optional, Tuple

import numpy as np

PLAYER_MAX_HP = 100.0
DRONE_MAX_HP = 55.0
CANNON_DAMAGE = 22.0
CANNON_COOLDOWN = 0.11
CANNON_RANGE = 420.0
CANNON_SPEED = 520.0
MISSILE_PLAYER_DAMAGE = 34.0
KILL_SCORE = 100
HIT_SCORE = 15


def aim_vector(heading: float, pitch: float) -> np.ndarray:
    return np.array(
        [
            math.sin(heading) * math.cos(pitch),
            math.cos(heading) * math.cos(pitch),
        ],
        dtype=float,
    )


def ray_hit_target(
    origin: np.ndarray,
    direction: np.ndarray,
    target_pos: np.ndarray,
    target_alt: float,
    shooter_alt: float,
    radius: float = 28.0,
    max_dist: float = CANNON_RANGE,
) -> Optional[float]:
    """거리 반환 또는 미스."""
    d = direction
    norm = float(np.linalg.norm(d))
    if norm < 1e-6:
        return None
    d = d / norm
    rel = target_pos - origin
    dist2d = float(np.linalg.norm(rel))
    if dist2d > max_dist + radius:
        return None
    alt_diff = abs(target_alt - shooter_alt)
    if alt_diff > 120.0 and dist2d > 80:
        return None
    along = float(np.dot(rel, d))
    if along < 4.0 or along > max_dist + radius:
        return None
    perp = rel - d * along
    perp_d = float(np.linalg.norm(perp))
    if perp_d <= radius + alt_diff * 0.08:
        return along
    return None
