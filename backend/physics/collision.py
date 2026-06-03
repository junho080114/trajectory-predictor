from __future__ import annotations

from typing import Optional, Tuple

import numpy as np


def circle_collision(
    pos_a: np.ndarray,
    radius_a: float,
    pos_b: np.ndarray,
    radius_b: float,
) -> bool:
    dist = np.linalg.norm(pos_a - pos_b)
    return dist <= (radius_a + radius_b)


def check_collision(
    projectile_pos: np.ndarray,
    projectile_radius: float,
    target_pos: np.ndarray,
    target_radius: float,
) -> bool:
    return circle_collision(projectile_pos, projectile_radius, target_pos, target_radius)


def check_collision_swept(
    prev_pos: np.ndarray,
    curr_pos: np.ndarray,
    projectile_radius: float,
    target_pos: np.ndarray,
    target_radius: float,
) -> bool:
    """고속 미사일이 프레임 사이를 뚫고 지나가는 경우 보정 (정지 타겟)."""
    if check_collision(curr_pos, projectile_radius, target_pos, target_radius):
        return True
    seg = curr_pos - prev_pos
    seg_len_sq = float(np.dot(seg, seg))
    combined = projectile_radius + target_radius
    if seg_len_sq < 1e-9:
        return check_collision(curr_pos, projectile_radius, target_pos, target_radius)
    t = float(np.dot(target_pos - prev_pos, seg) / seg_len_sq)
    t = max(0.0, min(1.0, t))
    closest = prev_pos + seg * t
    return float(np.linalg.norm(closest - target_pos)) <= combined


def check_collision_swept_both(
    prev_a: np.ndarray,
    curr_a: np.ndarray,
    radius_a: float,
    prev_b: np.ndarray,
    curr_b: np.ndarray,
    radius_b: float,
    segments: int = 6,
) -> bool:
    """미사일·타겟이 같은 프레임 안에서 동시에 이동할 때 충돌 검사."""
    combined = radius_a + radius_b
    if float(np.linalg.norm(curr_a - curr_b)) <= combined:
        return True
    n = max(2, segments)
    for i in range(1, n + 1):
        t = i / n
        pa = prev_a + (curr_a - prev_a) * t
        pb = prev_b + (curr_b - prev_b) * t
        if float(np.linalg.norm(pa - pb)) <= combined:
            return True
    return False


def check_collision_3d_swept_both(
    prev_a: np.ndarray,
    curr_a: np.ndarray,
    alt_a_prev: float,
    alt_a_curr: float,
    radius_a: float,
    prev_b: np.ndarray,
    curr_b: np.ndarray,
    alt_b_prev: float,
    alt_b_curr: float,
    radius_b: float,
    altitude_band: float,
    segments: int = 6,
) -> bool:
    """수평 충돌 + 고도 차이가 크면 회피 성공."""
    combined = radius_a + radius_b
    n = max(2, segments)
    for i in range(1, n + 1):
        t = i / n
        pa = prev_a + (curr_a - prev_a) * t
        pb = prev_b + (curr_b - prev_b) * t
        alt_a = alt_a_prev + (alt_a_curr - alt_a_prev) * t
        alt_b = alt_b_prev + (alt_b_curr - alt_b_prev) * t
        if abs(alt_a - alt_b) > altitude_band:
            continue
        if float(np.linalg.norm(pa - pb)) <= combined:
            return True
    return False


def closest_approach_time(
    proj_pos: np.ndarray,
    proj_vel: np.ndarray,
    target_pos: np.ndarray,
    target_vel: np.ndarray,
) -> float:
    rel_pos = target_pos - proj_pos
    rel_vel = target_vel - proj_vel
    denom = np.dot(rel_vel, rel_vel)
    if denom < 1e-9:
        return 0.0
    return float(np.dot(rel_pos, rel_vel) / denom)


def estimate_collision_time(
    proj_pos: np.ndarray,
    proj_vel: np.ndarray,
    target_pos: np.ndarray,
    target_vel: np.ndarray,
    combined_radius: float,
) -> Optional[float]:
    t = closest_approach_time(proj_pos, proj_vel, target_pos, target_vel)
    if t < 0:
        return None
    future_proj = proj_pos + proj_vel * t
    future_target = target_pos + target_vel * t
    dist = float(np.linalg.norm(future_proj - future_target))
    if dist <= combined_radius:
        return t
    return None
