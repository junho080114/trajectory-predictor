"""웨이브별 난이도 스케일."""
from __future__ import annotations


def wave_params(wave: int) -> dict:
    w = max(1, int(wave))
    return {
        "drone_count": min(2 + w, 8),
        "max_active_missiles": min(2 + w, 7),
        "missile_hp": min(3 + (w - 1), 9),
        "ai_difficulty": min(2.6, 0.9 + (w - 1) * 0.2),
        "fire_interval_base": max(1.6, 3.2 - (w - 1) * 0.22),
        "drone_hp_bonus": (w - 1) * 10.0,
        "wave_clear_bonus": 150 + w * 50,
    }
