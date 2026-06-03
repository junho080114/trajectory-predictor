from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class Vector2D(BaseModel):
    x: float = 0.0
    y: float = 0.0


class TargetState(BaseModel):
    id: str = "target-0"
    position: Vector2D = Field(default_factory=Vector2D)
    velocity: Vector2D = Field(default_factory=Vector2D)
    acceleration: Vector2D = Field(default_factory=Vector2D)


class PredictionResult(BaseModel):
    linear: Vector2D
    kalman: Optional[Vector2D] = None
    lstm: Optional[Vector2D] = None
    trajectory: List[Vector2D] = Field(default_factory=list)
    horizon: float = 2.0


class InterceptResult(BaseModel):
    success: bool
    intercept_point: Vector2D = Field(default_factory=Vector2D)
    launch_angle_deg: float = 0.0
    time_to_intercept: float = 0.0
    fallback_used: bool = False


class LaunchRequest(BaseModel):
    target_id: str = "target-0"
    muzzle_velocity: float = 400.0
    origin: Vector2D = Field(default_factory=lambda: Vector2D(x=100.0, y=500.0))
    use_air_resistance: bool = False


class LaunchResponse(BaseModel):
    launched: bool
    intercept: InterceptResult
    projectile_id: str = ""


class SimulationConfig(BaseModel):
    target_speed: float = 780.0
    target_acceleration: float = 0.0
    noise_level: float = 0.0
    muzzle_velocity: float = 220.0
    auto_fire: bool = True
    use_kalman: bool = True
    use_lstm: bool = False
    use_air_resistance: bool = False
    evasion_mode: bool = False
    sim_speed: float = 1.0
    paused: bool = False
    player_control: bool = True
    ai_targets: bool = True
    homing_missiles: bool = True
    homing_turn_rate: float = 7.5
    max_active_missiles: int = 3
    ai_difficulty: float = 1.0


class ProjectileState(BaseModel):
    id: str
    position: Vector2D
    velocity: Vector2D
    active: bool = True


class StatusResponse(BaseModel):
    running: bool
    fps: float
    targets: List[TargetState]
    projectiles: List[ProjectileState]
    selected_target_id: str
    config: SimulationConfig
    last_intercept: Optional[InterceptResult] = None
    collision_time: Optional[float] = None
    hit: bool = False


class PredictQuery(BaseModel):
    target_id: str = "target-0"
    horizon: float = 2.0
    dt: float = 0.05


class WSMessage(BaseModel):
    type: str
    payload: dict = Field(default_factory=dict)
