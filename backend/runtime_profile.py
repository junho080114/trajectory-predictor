"""Cloud / low-resource tuning. Game rules and visuals unchanged."""
from __future__ import annotations

import os


def _truthy(name: str, default: str = "") -> bool:
    return os.environ.get(name, default).lower() in ("1", "true", "yes", "on")


# Render sets RENDER=true automatically on their platform.
CLOUD_LITE = _truthy("RENDER") or _truthy("LOW_RESOURCE")

SIM_HZ = 30.0 if CLOUD_LITE else 60.0
BROADCAST_HZ = 15.0 if CLOUD_LITE else 30.0
IDLE_SLEEP_SEC = 2.0 if CLOUD_LITE else 0.0

TRAIL_MAX_TARGET = 48 if CLOUD_LITE else 120
TRAIL_MAX_PROJECTILE = 20 if CLOUD_LITE else 36

WS_TRAIL_TARGET = 8 if CLOUD_LITE else 24
WS_TRAIL_PROJECTILE = 6 if CLOUD_LITE else 16
WS_HEAVY_EVERY = 4 if CLOUD_LITE else 2

SKIP_WS_PREDICTION = CLOUD_LITE
SKIP_WS_DEBUG = CLOUD_LITE
SKIP_TRAJECTORY_PREVIEW = CLOUD_LITE
