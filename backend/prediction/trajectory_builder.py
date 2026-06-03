from __future__ import annotations

from typing import List

import numpy as np

CANVAS_W = 1200.0
CANVAS_H = 700.0


def _clip_point(p: np.ndarray) -> np.ndarray:
    return np.array(
        [
            float(np.clip(p[0], 0, CANVAS_W)),
            float(np.clip(p[1], 0, CANVAS_H)),
        ],
        dtype=float,
    )


def densify_path(points: List[np.ndarray], step: float = 12.0) -> List[np.ndarray]:
    if len(points) < 2:
        return [p.copy() for p in points]
    dense: List[np.ndarray] = [points[0].copy()]
    for i in range(1, len(points)):
        a, b = points[i - 1], points[i]
        seg = b - a
        dist = float(np.linalg.norm(seg))
        if dist < 1e-6:
            continue
        n = max(1, int(dist / step))
        for j in range(1, n + 1):
            t = j / n
            dense.append((a + seg * t).astype(float))
    return dense


def remove_jumps(points: List[np.ndarray], max_jump: float = 55.0) -> List[np.ndarray]:
    if not points:
        return []
    cleaned = [points[0].copy()]
    for i in range(1, len(points)):
        p = points[i]
        prev = cleaned[-1]
        if float(np.linalg.norm(p - prev)) > max_jump:
            mid = (prev + p) * 0.5
            cleaned.append(mid.copy())
        cleaned.append(p.copy())
    return cleaned


def moving_average_smooth(points: List[np.ndarray], window: int = 5) -> List[np.ndarray]:
    if len(points) < 3:
        return [p.copy() for p in points]
    w = max(3, window | 1)
    half = w // 2
    out: List[np.ndarray] = []
    for i in range(len(points)):
        lo = max(0, i - half)
        hi = min(len(points), i + half + 1)
        chunk = points[lo:hi]
        avg = np.mean(np.stack(chunk, axis=0), axis=0)
        out.append(avg.astype(float))
    out[0] = points[0].copy()
    out[-1] = points[-1].copy()
    return out


def align_to_velocity(points: List[np.ndarray], velocity: np.ndarray, strength: float = 0.35) -> List[np.ndarray]:
    """LSTM/칼만 잡음을 줄이기 위해 구간별로 속도 방향 곡선에 가깝게 당김."""
    if len(points) < 2 or float(np.linalg.norm(velocity)) < 1.0:
        return [p.copy() for p in points]
    origin = points[0]
    aligned: List[np.ndarray] = [origin.copy()]
    for i in range(1, len(points)):
        t = i / max(1, len(points) - 1)
        linear = origin + velocity * (t * (len(points) - 1) * 0.05)
        blended = (1.0 - strength) * points[i] + strength * linear
        aligned.append(_clip_point(blended))
    return aligned


def build_smooth_trajectory(
    origin: np.ndarray,
    velocity: np.ndarray,
    kalman_points: List[np.ndarray] | None,
    lstm_points: List[np.ndarray] | None,
    horizon: float = 2.0,
    dt: float = 0.05,
) -> List[np.ndarray]:
    steps = max(2, int(horizon / dt))
    linear = [origin + velocity * (i * dt) for i in range(1, steps + 1)]

    merged: List[np.ndarray] = [origin.copy()]
    for i in range(steps):
        lin = linear[i] if i < len(linear) else linear[-1]
        kpt = kalman_points[i] if kalman_points and i < len(kalman_points) else lin
        lpt = lstm_points[i] if lstm_points and i < len(lstm_points) else kpt
        # 선형·칼만 비중을 높여 LSTM 지그재그 완화
        w_k = 0.58 if kalman_points else 0.0
        w_l = 0.10 if lstm_points else 0.0
        w_lin = 1.0 - w_k - w_l
        p = w_lin * lin + w_k * kpt + w_l * lpt
        merged.append(_clip_point(p))

    merged = remove_jumps(merged, max_jump=55.0)
    merged = align_to_velocity(merged, velocity, strength=0.28)
    merged = moving_average_smooth(merged, window=7)
    merged = moving_average_smooth(merged, window=5)
    return densify_path(merged, step=14.0)
