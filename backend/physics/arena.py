"""3D 구형 비행 전투 구역 (x, altitude, sim_y=z)."""
from __future__ import annotations

import math
from typing import Tuple

import numpy as np

ARENA_CENTER_X = 600.0
ARENA_CENTER_Z = 350.0
ARENA_ALT_CENTER = 4500.0
ARENA_RADIUS = 500.0
ARENA_MARGIN = 12.0


def entity_offset_3d(x: float, alt: float, z: float) -> Tuple[float, float, float]:
    return (
        x - ARENA_CENTER_X,
        alt - ARENA_ALT_CENTER,
        z - ARENA_CENTER_Z,
    )


def distance_from_center(x: float, alt: float, z: float) -> float:
    dx, dy, dz = entity_offset_3d(x, alt, z)
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def clamp_entity_to_sphere(
    x: float,
    z: float,
    altitude: float,
    velocity: np.ndarray | None = None,
) -> Tuple[float, float, float, np.ndarray | None]:
    """구 내부로 위치·속도 보정."""
    dx, dy, dz = entity_offset_3d(x, altitude, z)
    dist = math.sqrt(dx * dx + dy * dy + dz * dz)
    max_r = ARENA_RADIUS - ARENA_MARGIN
    if dist <= max_r or dist < 1e-6:
        return x, z, altitude, velocity

    scale = max_r / dist
    nx, ny, nz = dx / dist, dy / dist, dz / dist
    x = ARENA_CENTER_X + dx * scale
    z = ARENA_CENTER_Z + dz * scale
    altitude = ARENA_ALT_CENTER + dy * scale

    vel = velocity
    if vel is not None and velocity.shape[0] >= 2:
        vel = velocity.copy()
        outward = np.array([nx, nz], dtype=float)
        out_spd = float(np.dot(vel, outward))
        if out_spd > 0:
            vel -= outward * out_spd * 1.1
    return x, z, altitude, vel


def random_point_in_sphere(rng) -> Tuple[float, float, float]:
    """구 내부 임의 점."""
    u = rng.random()
    v = rng.random()
    w = rng.random()
    theta = 2 * math.pi * u
    phi = math.acos(2 * v - 1)
    r = ARENA_RADIUS * 0.55 * (w ** (1 / 3))
    dx = r * math.sin(phi) * math.cos(theta)
    dy = r * math.sin(phi) * math.sin(theta)
    dz = r * math.cos(phi)
    return (
        ARENA_CENTER_X + dx,
        ARENA_CENTER_Z + dz,
        ARENA_ALT_CENTER + dy,
    )
