from __future__ import annotations

import math
import random
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np

from models.schemas import (
    InterceptResult,
    PredictionResult,
    SimulationConfig,
    TargetState,
    Vector2D,
)
from physics.collision import check_collision_3d_swept_both, estimate_collision_time
from physics.arena import (
    ARENA_ALT_CENTER,
    ARENA_CENTER_X,
    ARENA_CENTER_Z,
    ARENA_RADIUS,
    clamp_entity_to_sphere,
    random_point_in_sphere,
)
from physics.drone_ai import apply_evasion_velocity, compute_missile_threat_3d
from physics.combat import (
    BULLET_LIFE,
    BULLET_RADIUS,
    CANNON_COOLDOWN,
    CANNON_DAMAGE,
    CANNON_RANGE,
    CANNON_SPEED,
    DRONE_MAX_HP,
    HIT_SCORE,
    INTERCEPT_SCORE,
    KILL_SCORE,
    MISSILE_HIT_DAMAGE,
    MISSILE_HIT_RADIUS,
    MISSILE_MAX_HP,
    MISSILE_PLAYER_DAMAGE,
    PLAYER_MAX_HP,
    aim_vector,
    ray_hit_target,
)
from physics.realistic_flight import integrate_throttle_free, update_free_flight
from physics.wave_system import wave_params
from physics.homing import compute_lead_point
from physics.missile_ai import SmartMissileTracker
from physics.player_missile_guidance import predict_player_aim
from physics.intercept import solve_intercept
from physics.projectile import integrate_projectile, simulate_trajectory, velocity_from_angle
from prediction.kalman import TargetKalmanFilter
from prediction.trajectory_builder import build_smooth_trajectory, moving_average_smooth
from runtime_profile import (
    SKIP_TRAJECTORY_PREVIEW,
    SKIP_WS_DEBUG,
    SKIP_WS_PREDICTION,
    TRAIL_MAX_PROJECTILE,
    TRAIL_MAX_TARGET,
    WS_HEAVY_EVERY,
    WS_TRAIL_PROJECTILE,
    WS_TRAIL_TARGET,
)


CANVAS_WIDTH = 1200.0
CANVAS_HEIGHT = 700.0
TARGET_RADIUS = 14.0
PROJECTILE_RADIUS = 8.0
LAUNCHER_POS = np.array([100.0, 600.0], dtype=float)
PHYSICS_SUBSTEP = 1.0 / 90.0


PLAYER_ID = "player"
PLAYER_ALT_DEFAULT = 4500.0
PLAYER_ALT_MIN = ARENA_ALT_CENTER - ARENA_RADIUS + 50.0
PLAYER_ALT_MAX = ARENA_ALT_CENTER + ARENA_RADIUS - 50.0
DRONE_CLIMB_RATE = 95.0
ALTITUDE_DODGE_BAND = 72.0
YAW_RATE = 1.2
PITCH_RATE = 0.55
LOOK_STEER_RATE = 9.0
PLAYER_ACCEL = 280.0
PLAYER_STRAFE_ACCEL = 220.0
PLAYER_BRAKE = 140.0
PLAYER_DRAG = 1.45
CLIMB_RATE = 120.0
VERTICAL_RATE = 110.0
DRONE_SPEED_RATIO = 0.26
MISSILE_SPEED_SCALE = 0.32
MISSILE_MAX_MPS = 130.0
KMH_TO_MPS = 1.0 / 3.6


@dataclass
class TargetEntity:
    id: str
    position: np.ndarray
    velocity: np.ndarray
    acceleration: np.ndarray
    kalman: TargetKalmanFilter = field(default_factory=TargetKalmanFilter)
    trail: List[np.ndarray] = field(default_factory=list)
    evasion_timer: float = 0.0
    maneuver_phase: float = 0.0
    is_player: bool = False
    is_drone: bool = False
    drone_waypoint: np.ndarray = field(default_factory=lambda: np.zeros(2))
    heading: float = 0.0
    pitch: float = 0.0
    altitude: float = PLAYER_ALT_DEFAULT
    throttle: float = 0.55
    bank: float = 0.0
    hp: float = DRONE_MAX_HP


@dataclass
class ProjectileEntity:
    id: str
    position: np.ndarray
    velocity: np.ndarray
    active: bool = True
    trail: List[np.ndarray] = field(default_factory=list)
    homing: bool = False
    speed: float = 400.0
    target_id: str = ""
    locked_target_id: str = ""
    lock_score: float = 1.0
    prev_position: np.ndarray = field(default_factory=lambda: np.zeros(2))
    altitude: float = PLAYER_ALT_DEFAULT - 120.0
    tracker: SmartMissileTracker = field(default_factory=SmartMissileTracker)
    from_player: bool = False
    hp: float = 0.0
    life: float = 0.0
    climb_rate: float = 0.0


class SimulationEngine:
    def __init__(self) -> None:
        self.config = SimulationConfig()
        self.targets: Dict[str, TargetEntity] = {}
        self.projectiles: Dict[str, ProjectileEntity] = {}
        self.selected_target_id: str = ""
        self.last_intercept: Optional[InterceptResult] = None
        self.collision_time: Optional[float] = None
        self.predicted_trajectory: List[np.ndarray] = []
        self.projectile_trajectory: List[np.ndarray] = []
        self.future_prediction: np.ndarray = np.zeros(2)
        self.linear_prediction: np.ndarray = np.zeros(2)
        self.kalman_prediction: np.ndarray = np.zeros(2)
        self.lstm_prediction: Optional[np.ndarray] = None
        self.launch_angle_deg: float = 0.0
        self.hit: bool = False
        self.hit_timer: float = 0.0
        self.sim_time: float = 0.0
        self._lstm: Optional[Any] = None
        self._auto_fire_cooldown: float = 0.0
        self._fps: float = 60.0
        self._last_frame: float = time.perf_counter()
        self._player_yaw = 0.0
        self._player_pitch = 0.0
        self._player_throttle = 0.0
        self._player_forward = 0.0
        self._player_strafe = 0.0
        self._player_vertical = 0.0
        self._player_boost = False
        self._player_throttle_state = 0.55
        self._player_view_yaw: float = 0.0
        self._player_view_pitch: float = 0.0
        self._player_yaw_input: float = 0.0
        self._player_pitch_input: float = 0.0
        self._player_speed: float = 72.0
        self._cannon_cooldown: float = 0.0
        self.player_hp: float = PLAYER_MAX_HP
        self.game_score: int = 0
        self.game_kills: int = 0
        self.game_wave: int = 1
        self.game_over: bool = False
        self._wave_clear_timer: float = 0.0
        self._wave_missile_hp: float = float(MISSILE_MAX_HP)
        self._wave_drone_total: int = 3
        self.priority_target_id: str = ""
        self.last_hit_target_id: str = ""
        self._launch_rotate: int = 0
        self._ws_tick: int = 0
        self._spawn_targets()
        self._apply_wave_config(self.game_wave)

    def apply_player_input(
        self,
        move_x: float = 0.0,
        move_y: float = 0.0,
        boost: bool = False,
        aim_x: float | None = None,
        aim_y: float | None = None,
        yaw_input: float = 0.0,
        pitch_input: float = 0.0,
        throttle_input: float = 0.0,
        move_forward: float = 0.0,
        move_strafe: float = 0.0,
        move_vertical: float = 0.0,
        view_yaw: float = 0.0,
        view_pitch: float = 0.0,
        yaw_rate: float = 0.0,
        pitch_rate: float = 0.0,
        look_heading: float | None = None,
        look_pitch: float | None = None,
    ) -> None:
        """자유 비행: 스로틀·뱅크·마우스 각속도 조종."""
        del aim_x, aim_y, yaw_input, pitch_input, look_heading, look_pitch
        clamp = lambda v: float(max(-1.0, min(1.0, v)))
        self._player_strafe = clamp(
            move_strafe if abs(move_strafe) > 1e-6 else move_x
        )
        fwd = move_forward if abs(move_forward) > 1e-6 else move_y
        self._player_forward = clamp(fwd)
        ti = throttle_input if abs(throttle_input) > 1e-6 else fwd
        self._player_throttle = clamp(ti)
        self._player_vertical = clamp(move_vertical)
        self._player_boost = bool(boost)
        self._player_view_yaw = float(max(-1.35, min(1.35, view_yaw)))
        self._player_view_pitch = float(max(-1.05, min(1.05, view_pitch)))
        if abs(yaw_rate) > 1e-5 or abs(pitch_rate) > 1e-5:
            self._player_yaw_input = clamp(yaw_rate)
            self._player_pitch_input = clamp(pitch_rate)
        else:
            # view_yaw/pitch = 시야·조준만 (마우스), 기체 선회는 A/D 뱅크
            self._player_yaw_input = 0.0
            self._player_pitch_input = 0.0

    def _spawn_targets(self) -> None:
        self.targets.clear()
        if self.config.player_control:
            self.targets[PLAYER_ID] = TargetEntity(
                id=PLAYER_ID,
                position=np.array([ARENA_CENTER_X, ARENA_CENTER_Z], dtype=float),
                velocity=np.zeros(2),
                acceleration=np.zeros(2),
                is_player=True,
                heading=0.0,
                pitch=0.0,
                altitude=ARENA_ALT_CENTER,
                throttle=0.62,
                hp=PLAYER_MAX_HP,
            )
            p = self.targets[PLAYER_ID]
            p.velocity = np.zeros(2, dtype=float)
            self._player_throttle_state = 0.0
            self._player_speed = 0.0
            self._player_view_yaw = 0.0
            self._player_view_pitch = 0.0
            self._player_yaw_input = 0.0
            self._player_pitch_input = 0.0
            self.selected_target_id = PLAYER_ID
            self._apply_wave_config(1)
            self._spawn_ai_targets(1)
            return
        positions = [
            (600.0, 200.0),
            (800.0, 350.0),
            (450.0, 280.0),
        ]
        for i, (x, y) in enumerate(positions):
            tid = f"target-{i}"
            speed = self.config.target_speed
            angle = math.pi * 0.25 + i * 0.4
            vel = np.array([speed * math.cos(angle), speed * math.sin(angle) * 0.5])
            self.targets[tid] = TargetEntity(
                id=tid,
                position=np.array([x, y], dtype=float),
                velocity=vel,
                acceleration=np.zeros(2),
            )
        self.selected_target_id = "target-0"

    def _apply_wave_config(self, wave: int) -> None:
        p = wave_params(wave)
        self._wave_missile_hp = float(p["missile_hp"])
        self._wave_drone_total = int(p["drone_count"])
        self.config.max_active_missiles = int(p["max_active_missiles"])
        self.config.ai_difficulty = float(p["ai_difficulty"])

    def _count_drones(self) -> int:
        return sum(
            1
            for t in self.targets.values()
            if t.is_drone or str(t.id).startswith("drone-")
        )

    def _remove_all_drones(self) -> None:
        for tid in list(self.targets.keys()):
            if tid.startswith("drone-"):
                del self.targets[tid]

    def _spawn_ai_targets(self, wave: int | None = None) -> None:
        w = wave if wave is not None else self.game_wave
        p = wave_params(w)
        count = int(p["drone_count"])
        drone_hp = DRONE_MAX_HP + float(p["drone_hp_bonus"])
        self._remove_all_drones()
        self._wave_drone_total = count

        for i in range(count):
            tid = f"drone-{i}"
            x, z, alt = random_point_in_sphere(random)
            pos = np.array([x, z], dtype=float)
            to_player = np.array([ARENA_CENTER_X, ARENA_CENTER_Z]) - pos
            norm = float(np.linalg.norm(to_player))
            direction = (
                to_player / norm if norm > 1e-6 else np.array([1.0, 0.0], dtype=float)
            )
            speed = self.config.target_speed * KMH_TO_MPS * DRONE_SPEED_RATIO
            vel = direction * speed * (0.9 + random.uniform(0, 0.2))
            wp = np.array(
                [
                    random.uniform(ARENA_CENTER_X - 200, ARENA_CENTER_X + 200),
                    random.uniform(ARENA_CENTER_Z - 200, ARENA_CENTER_Z + 200),
                ],
                dtype=float,
            )
            self.targets[tid] = TargetEntity(
                id=tid,
                position=pos,
                velocity=vel,
                acceleration=np.zeros(2),
                is_drone=True,
                drone_waypoint=wp,
                altitude=alt,
                heading=math.atan2(float(vel[0]), float(vel[1])),
                hp=drone_hp,
            )

    def _check_wave_complete(self) -> None:
        if self.game_over or self._wave_clear_timer > 0.0:
            return
        if self._count_drones() > 0:
            return
        self._advance_wave()

    def _advance_wave(self) -> None:
        cleared = self.game_wave
        bonus = wave_params(cleared)["wave_clear_bonus"]
        self.game_score += int(bonus)
        self.game_wave += 1
        self._wave_clear_timer = 3.0
        self.projectiles.clear()
        self._auto_fire_cooldown = 1.2
        self._apply_wave_config(self.game_wave)
        self._spawn_ai_targets(self.game_wave)

    def get_lstm(self):
        if self._lstm is None:
            from prediction.lstm_predictor import LSTMPredictor

            self._lstm = LSTMPredictor()
        return self._lstm

    def update_config(self, updates: Dict[str, Any]) -> None:
        for key, value in updates.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)

    def sync_config(self, updates: Dict[str, Any]) -> None:
        """스폰에 영향 주는 설정은 반드시 재시작."""
        self.update_config(updates)
        self.restart()

    def ensure_drones(self) -> int:
        """플레이어 모드에서 드론이 없으면 즉시 스폰."""
        if not self.config.player_control:
            return 0
        has = any(t.is_drone or t.id.startswith("drone-") for t in self.targets.values())
        if not has:
            self._spawn_ai_targets(self.game_wave)
        return self._count_drones()

    def restart(self) -> None:
        self.targets.clear()
        self.projectiles.clear()
        self.hit = False
        self.hit_timer = 0.0
        self.sim_time = 0.0
        self.last_intercept = None
        self.collision_time = None
        self._auto_fire_cooldown = 0.0
        self._player_yaw = 0.0
        self._player_pitch = 0.0
        self._player_throttle = 0.0
        self._player_forward = 0.0
        self._player_strafe = 0.0
        self._player_vertical = 0.0
        self._player_view_yaw = 0.0
        self._player_view_pitch = 0.0
        self._player_yaw_input = 0.0
        self._player_pitch_input = 0.0
        self._player_speed = 72.0
        self._cannon_cooldown = 0.0
        self.player_hp = PLAYER_MAX_HP
        self.game_score = 0
        self.game_kills = 0
        self.game_wave = 1
        self.game_over = False
        self._wave_clear_timer = 0.0
        self.priority_target_id = ""
        self.last_hit_target_id = ""
        self._spawn_targets()
        self._apply_wave_config(self.game_wave)

    def select_target(self, target_id: str) -> bool:
        if target_id in self.targets:
            self.selected_target_id = target_id
            return True
        return False

    def get_selected_target(self) -> Optional[TargetEntity]:
        return self.targets.get(self.selected_target_id)

    def _effective_missile_speed(self) -> float:
        return min(
            MISSILE_MAX_MPS,
            max(70.0, self.config.muzzle_velocity * MISSILE_SPEED_SCALE),
        )

    def _apply_evasion(self, target: TargetEntity, dt: float) -> None:
        if not self.config.evasion_mode:
            return
        target.evasion_timer -= dt
        if target.evasion_timer <= 0:
            target.evasion_timer = np.random.uniform(0.4, 1.2)
            angle = np.random.uniform(-math.pi, math.pi)
            magnitude = np.random.uniform(40, 120)
            target.acceleration = np.array(
                [magnitude * math.cos(angle), magnitude * math.sin(angle)], dtype=float
            )
        target.maneuver_phase += dt * 3.0
        jitter = np.array(
            [math.sin(target.maneuver_phase) * 30, math.cos(target.maneuver_phase * 1.3) * 30]
        )
        target.velocity = target.velocity + (target.acceleration + jitter) * dt * 0.3

    @staticmethod
    def _angle_lerp(current: float, target_angle: float, rate: float, dt: float) -> float:
        dh = target_angle - current
        while dh > math.pi:
            dh -= math.pi * 2
        while dh < -math.pi:
            dh += math.pi * 2
        return current + dh * min(1.0, rate * dt)

    def _update_player_target(self, target: TargetEntity, dt: float) -> None:
        max_mps = max(55.0, self.config.target_speed * KMH_TO_MPS)

        throttle_cmd = self._player_throttle if abs(self._player_throttle) > 1e-6 else self._player_forward
        self._player_throttle_state = integrate_throttle_free(
            self._player_throttle_state,
            throttle_cmd,
            self._player_boost,
            dt,
        )

        speed_est = float(self._player_speed)
        if speed_est < 1.0:
            speed_est = float(np.linalg.norm(target.velocity))

        heading, pitch, bank, speed_est, vel, climb = update_free_flight(
            target.heading,
            target.pitch,
            float(getattr(target, "bank", 0.0)),
            speed_est,
            self._player_throttle_state,
            self._player_yaw_input,
            self._player_pitch_input,
            self._player_strafe,
            self._player_vertical,
            self._player_boost,
            max_mps,
            dt,
        )

        strafe = self._player_strafe
        target.heading = heading
        target.pitch = pitch
        target.bank = bank
        target.velocity = vel
        self._player_speed = speed_est

        target.altitude = float(
            np.clip(target.altitude + climb * dt, PLAYER_ALT_MIN, PLAYER_ALT_MAX)
        )

        target.throttle = min(1.12, self._player_throttle_state)
        target.position = target.position + target.velocity * dt

        if abs(strafe) > 0.02 and speed_est > 18.0:
            lateral = speed_est * 0.38 * strafe
            target.position = target.position + np.array(
                [math.cos(heading) * lateral * dt, -math.sin(heading) * lateral * dt],
                dtype=float,
            )

        self._player_yaw_input *= max(0.0, 1.0 - 4.5 * dt)
        self._player_pitch_input *= max(0.0, 1.0 - 4.5 * dt)
        measured = target.position.copy()
        if self.config.noise_level > 0:
            measured = measured + np.random.randn(2) * self.config.noise_level * 0.3
        target.kalman.update_dt(dt)
        if self.config.use_kalman:
            target.kalman.update(measured)
        else:
            target.kalman.reset(measured, target.velocity)
        if self.config.use_lstm and self.config.player_control and target.is_player:
            self.get_lstm().add_observation(measured)
        target.trail.append(target.position.copy())
        if len(target.trail) > TRAIL_MAX_TARGET:
            target.trail = target.trail[-TRAIL_MAX_TARGET:]
        if self.config.player_control:
            self._apply_arena_clamp(target)
        else:
            target.position[0] = float(np.clip(target.position[0], TARGET_RADIUS, CANVAS_WIDTH - TARGET_RADIUS))
            target.position[1] = float(np.clip(target.position[1], TARGET_RADIUS, CANVAS_HEIGHT - TARGET_RADIUS))

    def _apply_arena_clamp(self, entity: TargetEntity | ProjectileEntity) -> None:
        x, z, alt, vel = clamp_entity_to_sphere(
            float(entity.position[0]),
            float(entity.position[1]),
            float(getattr(entity, "altitude", ARENA_ALT_CENTER)),
            getattr(entity, "velocity", None),
        )
        entity.position[0] = x
        entity.position[1] = z
        entity.altitude = alt
        if vel is not None:
            entity.velocity = vel

    def _active_projectile_states(self) -> List[tuple[np.ndarray, np.ndarray]]:
        return [
            (p.position.copy(), p.velocity.copy())
            for p in self.projectiles.values()
            if p.active
        ]

    def _active_projectile_states_3d(self) -> List[tuple[np.ndarray, np.ndarray, float]]:
        return [
            (p.position.copy(), p.velocity.copy(), float(p.altitude))
            for p in self.projectiles.values()
            if p.active
        ]

    def _respawn_drone(self, target: TargetEntity) -> None:
        x, z, alt = random_point_in_sphere(random)
        target.position = np.array([x, z], dtype=float)
        target.altitude = alt
        center = np.array([ARENA_CENTER_X, ARENA_CENTER_Z])
        to_center = center - target.position
        norm = np.linalg.norm(to_center)
        direction = to_center / norm if norm > 1e-6 else np.array([1.0, 0.0])
        speed = self.config.target_speed * KMH_TO_MPS * DRONE_SPEED_RATIO
        target.velocity = direction * speed
        target.is_drone = True
        target.drone_waypoint = np.array(
            [
                random.uniform(160, CANVAS_WIDTH - 160),
                random.uniform(100, CANVAS_HEIGHT - 100),
            ],
            dtype=float,
        )
        target.trail.clear()
        target.hp = DRONE_MAX_HP
        target.kalman.reset(target.position, target.velocity)

    def _target_priority_weight(self, from_pos: np.ndarray, target: TargetEntity) -> float:
        dist = float(np.linalg.norm(target.position - from_pos))
        w = 1.0 / ((dist + 35.0) ** 1.35)
        if target.is_drone:
            w *= 1.35
        return w

    def _is_enemy_missile(self, proj: ProjectileEntity) -> bool:
        if not proj.homing or not proj.active or proj.from_player:
            return False
        tid = proj.locked_target_id or proj.target_id
        return tid == PLAYER_ID and PLAYER_ID in self.targets

    def _spawn_player_bullet(
        self, player: TargetEntity, aim_h: float, aim_p: float
    ) -> str:
        hsp = CANNON_SPEED * math.cos(aim_p)
        vel = np.array(
            [math.sin(aim_h) * hsp, math.cos(aim_h) * hsp],
            dtype=float,
        )
        bid = f"bullet-{uuid.uuid4().hex[:8]}"
        self.projectiles[bid] = ProjectileEntity(
            id=bid,
            position=player.position.copy(),
            velocity=vel,
            homing=False,
            from_player=True,
            speed=CANNON_SPEED,
            target_id="",
            locked_target_id="",
            prev_position=player.position.copy(),
            altitude=float(player.altitude),
            life=BULLET_LIFE,
            hp=0.0,
            climb_rate=float(CANNON_SPEED * math.sin(aim_p)),
        )
        return bid

    def _damage_enemy_missile(self, proj: ProjectileEntity) -> dict:
        hp_max = float(getattr(proj, "hp", self._wave_missile_hp))
        if hp_max <= 0:
            hp_max = self._wave_missile_hp
        proj.hp = hp_max - MISSILE_HIT_DAMAGE
        destroyed = proj.hp <= 0.0
        if destroyed:
            proj.active = False
            self.game_score += INTERCEPT_SCORE
        return {
            "destroyed": destroyed,
            "hp_left": max(0.0, proj.hp),
            "hp_max": hp_max,
        }

    def player_try_fire(self) -> dict:
        """기관포: 총알 발사 + 조준선 히트스캔(드론·미사일)."""
        if self._cannon_cooldown > 0.0 or self.player_hp <= 0.0 or self.game_over:
            return {"fired": False}
        player = self.targets.get(PLAYER_ID)
        if not player:
            return {"fired": False}
        aim_h = player.heading + self._player_view_yaw
        aim_p = player.pitch + self._player_view_pitch * 0.85
        direction = aim_vector(aim_h, aim_p)
        origin = player.position.copy()
        bullet_id = self._spawn_player_bullet(player, aim_h, aim_p)

        best_along = 1e9
        best_drone: Optional[TargetEntity] = None
        best_missile: Optional[ProjectileEntity] = None

        for proj in self.projectiles.values():
            if not self._is_enemy_missile(proj):
                continue
            along = ray_hit_target(
                origin,
                direction,
                proj.position,
                proj.altitude,
                player.altitude,
                radius=MISSILE_HIT_RADIUS,
                max_dist=CANNON_RANGE,
            )
            if along is not None and along < best_along:
                best_along = along
                best_missile = proj
                best_drone = None

        for tgt in self.targets.values():
            if not tgt.is_drone:
                continue
            along = ray_hit_target(
                origin,
                direction,
                tgt.position,
                tgt.altitude,
                player.altitude,
                max_dist=CANNON_RANGE,
            )
            if along is not None and along < best_along:
                best_along = along
                best_drone = tgt
                best_missile = None

        self._cannon_cooldown = CANNON_COOLDOWN

        if best_missile is not None:
            info = self._damage_enemy_missile(best_missile)
            return {
                "fired": True,
                "hit": True,
                "hit_type": "missile",
                "target_id": best_missile.id,
                "bullet_id": bullet_id,
                "intercept": info["destroyed"],
                "missile_hp_left": info["hp_left"],
                "missile_hp_max": info["hp_max"],
            }

        if best_drone is not None:
            best_drone.hp -= CANNON_DAMAGE
            self.game_score += HIT_SCORE
            killed = best_drone.hp <= 0.0
            if killed:
                self.game_kills += 1
                self.game_score += KILL_SCORE + HIT_SCORE
                did = best_drone.id
                self.targets.pop(did, None)
                self._check_wave_complete()
            return {
                "fired": True,
                "hit": True,
                "hit_type": "drone",
                "killed": killed,
                "target_id": best_drone.id,
                "bullet_id": bullet_id,
            }

        return {"fired": True, "hit": False, "bullet_id": bullet_id}

    def _update_player_bullet(
        self, proj: ProjectileEntity, dt: float, to_remove: List[str], pid: str
    ) -> None:
        proj.life = float(getattr(proj, "life", 0.0)) - dt
        if proj.life <= 0.0:
            proj.active = False
            to_remove.append(pid)
            return

        prev_pos = proj.position.copy()
        prev_alt = float(proj.altitude)
        proj.position = proj.position + proj.velocity * dt
        proj.altitude = float(proj.altitude + getattr(proj, "climb_rate", 0.0) * dt)

        for mid, missile in list(self.projectiles.items()):
            if mid == pid or not self._is_enemy_missile(missile):
                continue
            if check_collision_3d_swept_both(
                prev_pos,
                proj.position,
                prev_alt,
                proj.altitude,
                BULLET_RADIUS,
                missile.position,
                missile.position,
                float(missile.altitude),
                float(missile.altitude),
                MISSILE_HIT_RADIUS,
                ALTITUDE_DODGE_BAND * 0.5,
                segments=4,
            ):
                info = self._damage_enemy_missile(missile)
                proj.active = False
                to_remove.append(pid)
                if not info["destroyed"]:
                    pass
                return

        if float(np.linalg.norm(proj.position - prev_pos)) < 1e-6:
            proj.active = False
            to_remove.append(pid)

    def _select_launch_target(self) -> Optional[TargetEntity]:
        if self.config.player_control and PLAYER_ID in self.targets:
            return self.targets[PLAYER_ID]
        if not self.targets:
            return None
        ranked = sorted(
            self.targets.values(),
            key=lambda t: float(np.linalg.norm(t.position - LAUNCHER_POS)),
        )
        if len(ranked) >= 2:
            pool = ranked[:2]
            self._launch_rotate = (self._launch_rotate + 1) % len(pool)
            return pool[self._launch_rotate]
        return ranked[0]

    def _get_locked_missile_target(self, proj: ProjectileEntity) -> Optional[TargetEntity]:
        """적 미사일은 항상 플레이어만 추적."""
        if proj.homing and not proj.from_player and self.config.player_control:
            return self.targets.get(PLAYER_ID)
        tid = proj.locked_target_id or proj.target_id
        return self.targets.get(tid)

    def _update_drone_target(self, target: TargetEntity, dt: float) -> None:
        speed = max(45.0, self.config.target_speed * KMH_TO_MPS * DRONE_SPEED_RATIO * 1.2)
        wp = target.drone_waypoint
        if float(np.linalg.norm(wp)) < 1.0 or float(np.linalg.norm(target.position - wp)) < 45.0:
            wx, wz, walt = random_point_in_sphere(random)
            target.drone_waypoint = np.array([wx, wz], dtype=float)
            target.altitude = target.altitude * 0.7 + walt * 0.3
            wp = target.drone_waypoint
        to_wp = wp - target.position
        wp_dist = float(np.linalg.norm(to_wp))
        if wp_dist > 1e-6:
            patrol = to_wp / wp_dist * speed
            target.velocity = target.velocity * 0.85 + patrol * 0.15
        threats = self._active_projectile_states_3d()
        dodge_dir, urgency, v_dodge = compute_missile_threat_3d(
            target.position, float(target.altitude), threats
        )
        if urgency > 0.05:
            target.velocity = apply_evasion_velocity(
                target.velocity, dodge_dir, urgency, dt, speed * 1.2
            )
            target.altitude += v_dodge * DRONE_CLIMB_RATE * urgency * dt
        target.maneuver_phase += dt * 2.0
        target.altitude += math.sin(target.maneuver_phase * 0.65) * 18.0 * dt
        target.position = target.position + target.velocity * dt
        vel_norm = np.linalg.norm(target.velocity)
        if vel_norm > 1e-6:
            target.velocity = target.velocity / vel_norm * speed
            target.heading = math.atan2(float(target.velocity[0]), float(target.velocity[1]))
        target.altitude = float(np.clip(target.altitude, PLAYER_ALT_MIN, PLAYER_ALT_MAX))
        if self.config.player_control:
            self._apply_arena_clamp(target)
        measured = target.position.copy()
        target.kalman.update_dt(dt)
        target.kalman.update(measured)
        target.trail.append(target.position.copy())
        if len(target.trail) > TRAIL_MAX_TARGET:
            target.trail = target.trail[-TRAIL_MAX_TARGET:]

    def _update_target(self, target: TargetEntity, dt: float) -> None:
        if target.is_player and self.config.player_control:
            self._update_player_target(target, dt)
            return
        if target.is_drone or target.id.startswith("drone-"):
            self._update_drone_target(target, dt)
            return
        acc_mag = self.config.target_acceleration
        if acc_mag != 0:
            direction = target.velocity
            norm = np.linalg.norm(direction)
            if norm > 1e-6:
                target.acceleration = direction / norm * acc_mag
        self._apply_evasion(target, dt)
        noise = np.zeros(2)
        if self.config.noise_level > 0:
            noise = np.random.randn(2) * self.config.noise_level
        speed = self.config.target_speed
        vel_norm = np.linalg.norm(target.velocity)
        if vel_norm > 1e-6:
            target.velocity = target.velocity / vel_norm * speed
        target.position = target.position + target.velocity * dt + 0.5 * target.acceleration * dt * dt
        measured = target.position + noise
        target.kalman.update_dt(dt)
        if self.config.use_kalman:
            target.kalman.update(measured)
        else:
            target.kalman.reset(measured, target.velocity)
        if self.config.use_lstm and (
            (self.config.player_control and target.is_player)
            or (not self.config.player_control and target.id == self.selected_target_id)
        ):
            self.get_lstm().add_observation(measured)
        target.trail.append(target.position.copy())
        if len(target.trail) > TRAIL_MAX_TARGET:
            target.trail = target.trail[-TRAIL_MAX_TARGET:]
        target.position[0] = float(np.clip(target.position[0], TARGET_RADIUS, CANVAS_WIDTH - TARGET_RADIUS))
        target.position[1] = float(np.clip(target.position[1], TARGET_RADIUS, CANVAS_HEIGHT - TARGET_RADIUS))

    def _predict_lite(self, target: TargetEntity, horizon: float = 2.0) -> None:
        """Fast path for cloud: skip LSTM/smooth trajectory (combat hides prediction lines)."""
        t = horizon
        origin = target.position.copy()
        self.linear_prediction = origin + target.velocity * t
        self.kalman_prediction = self.linear_prediction.copy()
        self.lstm_prediction = None
        self.predicted_trajectory = []
        self.future_prediction = self.linear_prediction.copy()

    def _predict(self, target: TargetEntity, horizon: float = 2.0) -> None:
        if SKIP_WS_PREDICTION and self.config.player_control:
            self._predict_lite(target, horizon)
            return
        dt = 0.05
        t = horizon
        origin = target.position.copy()
        self.linear_prediction = origin + target.velocity * t

        kalman_pts: List[np.ndarray] | None = None
        if self.config.use_kalman:
            self.kalman_prediction = target.kalman.linear_predict(t)
            raw_k = target.kalman.predict_future(horizon, dt)
            kalman_pts = [origin] + raw_k if raw_k else None
        else:
            self.kalman_prediction = self.linear_prediction.copy()

        lstm_pts: List[np.ndarray] | None = None
        self.lstm_prediction = None
        if self.config.use_lstm:
            lstm = self.get_lstm()
            self.lstm_prediction = lstm.predict_next(origin)
            steps = max(2, int(horizon / dt))
            lstm_pts = lstm.predict_trajectory(origin, steps=steps, dt_scale=1.0)

        smooth = build_smooth_trajectory(
            origin,
            target.velocity,
            kalman_pts,
            lstm_pts,
            horizon=horizon,
            dt=dt,
        )
        self.predicted_trajectory = smooth

        if self.lstm_prediction is not None and self.config.use_lstm:
            self.future_prediction = self.lstm_prediction.copy()
        elif self.config.use_kalman:
            self.future_prediction = self.kalman_prediction.copy()
        else:
            self.future_prediction = self.linear_prediction.copy()

    def _simulate_homing_preview(self, target: TargetEntity, duration: float = 2.8) -> List[np.ndarray]:
        dt = 0.03
        pos = LAUNCHER_POS.copy()
        to_tgt = target.position - pos
        norm = np.linalg.norm(to_tgt)
        mspd = self._effective_missile_speed()
        vel = (to_tgt / norm * mspd) if norm > 1e-6 else np.array([mspd, 0.0])
        points = [pos.copy()]
        diff = max(0.5, min(2.0, self.config.ai_difficulty))
        turn_rate = max(4.0, self.config.homing_turn_rate * 0.85)
        preview_tracker = SmartMissileTracker()
        steps = max(1, int(duration / dt))
        for _ in range(steps):
            if target.is_player and self.config.player_control:
                aim = self._enemy_missile_aim_point(target, pos, mspd)
            else:
                kpos, kvel = target.kalman.get_state()
                aim = kpos + kvel * 0.8
            vel, pos, _ = preview_tracker.guide_missile(
                pos,
                vel,
                aim,
                target.position,
                target.velocity,
                mspd,
                turn_rate,
                dt,
                difficulty=diff,
            )
            points.append(pos.copy())
            if float(np.linalg.norm(pos - target.position)) < TARGET_RADIUS + PROJECTILE_RADIUS + 5:
                break
        if len(points) >= 3:
            points = moving_average_smooth(points, window=5)
        return points

    def compute_intercept(self, target: TargetEntity) -> InterceptResult:
        pred_pos = self.future_prediction if np.any(self.future_prediction) else target.position
        mspd = self._effective_missile_speed()
        success, ipt, angle_deg, t_hit, fallback = solve_intercept(
            LAUNCHER_POS,
            mspd,
            pred_pos,
            target.velocity,
            target.acceleration,
        )
        self.launch_angle_deg = angle_deg
        result = InterceptResult(
            success=success,
            intercept_point=Vector2D(x=float(ipt[0]), y=float(ipt[1])),
            launch_angle_deg=angle_deg,
            time_to_intercept=t_hit,
            fallback_used=fallback,
        )
        self.last_intercept = result
        self.collision_time = t_hit
        if SKIP_TRAJECTORY_PREVIEW and self.config.player_control:
            self.projectile_trajectory = []
        elif self.config.homing_missiles or self.config.player_control:
            self.projectile_trajectory = self._simulate_homing_preview(target, duration=max(t_hit + 0.3, 2.0))
        else:
            vel = velocity_from_angle(mspd, math.radians(angle_deg))
            self.projectile_trajectory = simulate_trajectory(
                LAUNCHER_POS, vel, t_hit + 0.5, 0.02, self.config.use_air_resistance
            )
        return result

    def launch(self, target_id: Optional[str] = None) -> bool:
        if self.config.player_control and PLAYER_ID in self.targets:
            tid = PLAYER_ID
        else:
            tid = target_id or self.selected_target_id
        target = self.targets.get(tid)
        if not target:
            return False
        intercept = self.compute_intercept(target)
        speed = self._effective_missile_speed()
        use_homing = self.config.homing_missiles or self.config.player_control
        if use_homing:
            lead = compute_lead_point(
                LAUNCHER_POS, speed, target.position, target.velocity, lead_factor=0.9
            )
            direction = lead - LAUNCHER_POS
            norm = np.linalg.norm(direction)
            if norm > 1e-6:
                vel = direction / norm * speed
            else:
                vel = velocity_from_angle(speed, math.radians(intercept.launch_angle_deg))
        else:
            angle_rad = math.radians(intercept.launch_angle_deg)
            vel = velocity_from_angle(speed, angle_rad)
        pid = f"proj-{uuid.uuid4().hex[:8]}"
        is_at_player = self.config.player_control and target.is_player
        self.projectiles[pid] = ProjectileEntity(
            id=pid,
            position=LAUNCHER_POS.copy(),
            velocity=vel,
            homing=use_homing,
            speed=speed,
            target_id=target.id,
            locked_target_id=target.id,
            prev_position=LAUNCHER_POS.copy(),
            altitude=float(getattr(target, "altitude", PLAYER_ALT_DEFAULT)) - 40.0,
            tracker=SmartMissileTracker(),
            hp=self._wave_missile_hp if is_at_player else 0.0,
        )
        self.hit = False
        return True

    def _player_lstm_hint(self, player: TargetEntity) -> Optional[np.ndarray]:
        if not self.config.use_lstm:
            return None
        try:
            lstm = self.get_lstm()
            return lstm.predict_next(player.position.copy())
        except Exception:
            return None

    def _enemy_missile_aim_point(
        self, player: TargetEntity, missile_pos: np.ndarray, missile_speed: float
    ) -> np.ndarray:
        """적 미사일 조준점 — 플레이어 칼만 + 입력 예측."""
        diff = max(0.5, min(2.0, self.config.ai_difficulty))
        lstm_hint = self._player_lstm_hint(player)
        return predict_player_aim(
            player.kalman,
            missile_pos,
            missile_speed,
            self._player_strafe,
            self._player_forward,
            self._player_boost,
            difficulty=diff,
            lstm_hint=lstm_hint,
        )

    def _handle_target_hit(self, target: TargetEntity, proj_id: str) -> None:
        self.last_hit_target_id = target.id
        self.hit_timer = 1.2
        if target.is_player:
            self.hit = True
            self.player_hp = max(0.0, self.player_hp - MISSILE_PLAYER_DAMAGE)
            target.velocity *= 0.4
            knock = target.velocity.copy()
            if float(np.linalg.norm(knock)) < 30.0:
                h = target.heading
                knock = np.array([-math.sin(h) * 40.0, -math.cos(h) * 40.0])
            target.position = target.position + knock * 0.35
            target.trail.clear()
            if self.player_hp <= 0.0:
                self.player_hp = 0.0
                self.game_over = True
        elif target.id.startswith("drone-"):
            self.hit = False
            self.game_kills += 1
            self.game_score += KILL_SCORE
            did = target.id
            self.targets.pop(did, None)
            self._check_wave_complete()

    def _interp_target_pos(
        self, target: TargetEntity, target_prev: Dict[str, np.ndarray], alpha: float
    ) -> np.ndarray:
        p0 = target_prev.get(target.id, target.position)
        return p0 + (target.position - p0) * alpha

    def _update_projectiles(self, dt: float, target_prev: Dict[str, np.ndarray]) -> None:
        to_remove: List[str] = []
        turn_rate = max(5.0, self.config.homing_turn_rate * 0.88)
        diff = max(0.5, min(2.0, self.config.ai_difficulty))
        substeps = max(1, int(math.ceil(dt / PHYSICS_SUBSTEP)))
        sub_dt = dt / substeps
        sweep_segments = max(4, min(16, substeps * 2))

        for pid, proj in list(self.projectiles.items()):
            if not proj.active:
                to_remove.append(pid)
                continue

            if proj.from_player and not proj.homing:
                self._update_player_bullet(proj, dt, to_remove, pid)
                continue

            frame_start = proj.position.copy()
            track_target = self._get_locked_missile_target(proj)
            if track_target is None:
                proj.active = False
                to_remove.append(pid)
                continue

            proj.target_id = proj.locked_target_id
            lock_strength = 1.0
            hit_any = False
            hit_tgt: Optional[TargetEntity] = None

            for step_i in range(substeps):
                alpha0 = step_i / substeps
                alpha1 = (step_i + 1) / substeps
                prev_pos = proj.position.copy()

                tgt_pos = self._interp_target_pos(track_target, target_prev, alpha1)
                tgt_vel = track_target.velocity
                proj.tracker.record_target(tgt_pos, tgt_vel)

                tgt_alt = getattr(track_target, "altitude", PLAYER_ALT_DEFAULT)
                proj.altitude += (tgt_alt - proj.altitude) * min(1.0, sub_dt * 2.2)

                if proj.homing:
                    if (
                        not proj.from_player
                        and self.config.player_control
                        and track_target.is_player
                    ):
                        aim = self._enemy_missile_aim_point(
                            track_target, proj.position, proj.speed
                        )
                        aim = proj.tracker.smooth_aim(
                            aim, proj.position, track_target.position
                        )
                    else:
                        lead = compute_lead_point(
                            proj.position, proj.speed, tgt_pos, tgt_vel, lead_factor=1.05
                        )
                        aim = lead
                    to_tgt = tgt_pos - proj.position
                    if float(np.linalg.norm(to_tgt)) < 45.0:
                        aim = tgt_pos + tgt_vel * 0.04
                    proj.velocity, proj.position, _ = proj.tracker.guide_missile(
                        proj.position,
                        proj.velocity,
                        aim,
                        tgt_pos,
                        tgt_vel,
                        proj.speed,
                        turn_rate * (1.0 + 0.15 * lock_strength),
                        sub_dt,
                        difficulty=diff,
                        pn_gain=3.5,
                    )
                else:
                    proj.position, proj.velocity = integrate_projectile(
                        proj.position,
                        proj.velocity,
                        sub_dt,
                        self.config.use_air_resistance,
                    )

                collide_targets = [track_target] if proj.homing else list(self.targets.values())
                for tgt in collide_targets:
                    t_prev = self._interp_target_pos(tgt, target_prev, alpha0)
                    t_curr = self._interp_target_pos(tgt, target_prev, alpha1)
                    alt_prev = getattr(tgt, "altitude", PLAYER_ALT_DEFAULT)
                    alt_curr = float(getattr(tgt, "altitude", alt_prev))
                    if check_collision_3d_swept_both(
                        prev_pos,
                        proj.position,
                        proj.altitude,
                        proj.altitude,
                        PROJECTILE_RADIUS,
                        t_prev,
                        t_curr,
                        alt_prev,
                        alt_curr,
                        TARGET_RADIUS,
                        ALTITUDE_DODGE_BAND,
                        segments=sweep_segments,
                    ):
                        hit_any = True
                        hit_tgt = tgt
                        break
                if hit_any:
                    break

            if self.config.player_control:
                self._apply_arena_clamp(proj)

            proj.prev_position = frame_start
            proj.trail.append(proj.position.copy())
            if len(proj.trail) > TRAIL_MAX_PROJECTILE:
                proj.trail = proj.trail[-TRAIL_MAX_PROJECTILE:]

            if hit_any and hit_tgt is not None:
                self._handle_target_hit(hit_tgt, pid)
                proj.active = False
                to_remove.append(pid)
            elif (
                proj.position[0] < -50
                or proj.position[0] > CANVAS_WIDTH + 50
                or proj.position[1] > CANVAS_HEIGHT + 50
            ):
                proj.active = False
                to_remove.append(pid)

        for pid in to_remove:
            self.projectiles.pop(pid, None)

    def step(self, dt: float) -> None:
        if self.config.paused:
            return
        scaled_dt = dt * self.config.sim_speed
        self.sim_time += scaled_dt
        self._cannon_cooldown = max(0.0, self._cannon_cooldown - scaled_dt)
        if self.hit_timer > 0:
            self.hit_timer -= scaled_dt

        if self.game_over:
            return

        if self._wave_clear_timer > 0.0:
            self._wave_clear_timer = max(0.0, self._wave_clear_timer - scaled_dt)
            target_prev = {tid: t.position.copy() for tid, t in self.targets.items()}
            player = self.targets.get(PLAYER_ID)
            if player:
                self._update_player_target(player, scaled_dt)
            self._update_projectiles(scaled_dt, target_prev)
            return

        self._auto_fire_cooldown = max(0.0, self._auto_fire_cooldown - scaled_dt)
        target_prev = {tid: t.position.copy() for tid, t in self.targets.items()}
        for target in self.targets.values():
            self._update_target(target, scaled_dt)
        priority = self._select_launch_target()
        if priority and self.config.player_control and not self.game_over:
            self.priority_target_id = priority.id
            if PLAYER_ID in self.targets:
                self.selected_target_id = PLAYER_ID
            else:
                self.selected_target_id = priority.id
            self._predict(priority, horizon=2.0)
            self.compute_intercept(priority)
            wp = wave_params(self.game_wave)
            fire_interval = float(wp["fire_interval_base"]) / max(
                0.6, self.config.ai_difficulty
            )
            max_missiles = max(1, int(self.config.max_active_missiles))
            enemy_missiles = sum(
                1
                for p in self.projectiles.values()
                if p.homing and p.active and not p.from_player
            )
            can_fire = enemy_missiles < max_missiles
            if self.config.auto_fire and can_fire and self._auto_fire_cooldown <= 0:
                if self.launch(PLAYER_ID):
                    self._auto_fire_cooldown = fire_interval
        self._update_projectiles(scaled_dt, target_prev)
        if self.projectiles:
            best_proj: Optional[ProjectileEntity] = None
            best_tgt: Optional[TargetEntity] = None
            nearest_d = 1e9
            for proj in self.projectiles.values():
                tgt = self.targets.get(proj.target_id)
                if not tgt:
                    continue
                d = float(np.linalg.norm(proj.position - tgt.position))
                if d < nearest_d:
                    nearest_d = d
                    best_proj = proj
                    best_tgt = tgt
            if best_proj is not None and best_tgt is not None:
                t_col = estimate_collision_time(
                    best_proj.position,
                    best_proj.velocity,
                    best_tgt.position,
                    best_tgt.velocity,
                    TARGET_RADIUS + PROJECTILE_RADIUS,
                )
                if t_col is not None:
                    self.collision_time = t_col
        now = time.perf_counter()
        frame_dt = now - self._last_frame
        self._last_frame = now
        if frame_dt > 0:
            self._fps = 0.9 * self._fps + 0.1 * (1.0 / frame_dt)

    def get_prediction_result(self, horizon: float = 2.0) -> PredictionResult:
        target = self.get_selected_target()
        if not target:
            return PredictionResult(linear=Vector2D(), trajectory=[])
        self._predict(target, horizon)
        return PredictionResult(
            linear=Vector2D(x=float(self.linear_prediction[0]), y=float(self.linear_prediction[1])),
            kalman=Vector2D(x=float(self.kalman_prediction[0]), y=float(self.kalman_prediction[1])),
            lstm=Vector2D(
                x=float(self.lstm_prediction[0]),
                y=float(self.lstm_prediction[1]),
            )
            if self.lstm_prediction is not None
            else None,
            trajectory=[Vector2D(x=float(p[0]), y=float(p[1])) for p in self.predicted_trajectory],
            horizon=horizon,
        )

    @staticmethod
    def _downsample_points(points: List[np.ndarray], max_pts: int = 28) -> List[dict]:
        if len(points) <= max_pts:
            return [{"x": float(p[0]), "y": float(p[1])} for p in points]
        step = max(1, len(points) // max_pts)
        return [{"x": float(points[i][0]), "y": float(points[i][1])} for i in range(0, len(points), step)]

    def to_ws_payload(self) -> dict:
        self._ws_tick += 1
        send_heavy = self._ws_tick % WS_HEAVY_EVERY == 0
        target = self.get_selected_target()
        tgt_pos = target.position if target else np.zeros(2)
        tgt_vel = target.velocity if target else np.zeros(2)
        return {
            "fps": round(self._fps, 1),
            "sim_time": self.sim_time,
            "hit": self.hit,
            "hit_timer": self.hit_timer,
            "canvas": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT},
            "arena": {
                "shape": "sphere",
                "center": {
                    "x": ARENA_CENTER_X,
                    "z": ARENA_CENTER_Z,
                    "altitude": ARENA_ALT_CENTER,
                },
                "radius": ARENA_RADIUS,
            },
            "launcher": {"x": float(LAUNCHER_POS[0]), "y": float(LAUNCHER_POS[1])},
            "config": self.config.model_dump(),
            "selected_target_id": self.selected_target_id,
            "targets": [
                {
                    "id": t.id,
                    "position": {"x": float(t.position[0]), "y": float(t.position[1])},
                    "velocity": {"x": float(t.velocity[0]), "y": float(t.velocity[1])},
                    "trail": [{"x": float(p[0]), "y": float(p[1])} for p in t.trail[-WS_TRAIL_TARGET:]],
                    "is_player": t.is_player,
                    "is_drone": t.is_drone or t.id.startswith("drone-"),
                    "heading": float(getattr(t, "heading", 0.0)),
                    "pitch": float(getattr(t, "pitch", 0.0)),
                    "altitude": float(getattr(t, "altitude", PLAYER_ALT_DEFAULT)),
                    "throttle": float(getattr(t, "throttle", 0.5)),
                    "bank": float(getattr(t, "bank", 0.0)),
                    "speed_kmh": float(np.linalg.norm(t.velocity) * 3.6),
                    "hp": float(getattr(t, "hp", DRONE_MAX_HP)),
                    "hp_max": float(
                        PLAYER_MAX_HP if t.is_player else DRONE_MAX_HP
                    ),
                }
                for t in self.targets.values()
            ],
            "game": {
                "hp": float(self.player_hp),
                "hp_max": PLAYER_MAX_HP,
                "score": int(self.game_score),
                "kills": int(self.game_kills),
                "wave": int(self.game_wave),
                "cannon_ready": self._cannon_cooldown <= 0.01,
                "game_over": bool(self.game_over),
                "wave_clear": self._wave_clear_timer > 0.05,
                "wave_clear_timer": float(self._wave_clear_timer),
                "drones_alive": self._count_drones(),
                "drones_total": int(self._wave_drone_total),
                "missile_hp_max": float(self._wave_missile_hp),
                "max_missiles": int(self.config.max_active_missiles),
            },
            "projectiles": [
                {
                    "id": p.id,
                    "position": {"x": float(p.position[0]), "y": float(p.position[1])},
                    "velocity": {"x": float(p.velocity[0]), "y": float(p.velocity[1])},
                    "trail": [{"x": float(p[0]), "y": float(p[1])} for p in p.trail[-WS_TRAIL_PROJECTILE:]],
                    "active": p.active,
                    "homing": p.homing,
                    "target_id": p.locked_target_id or p.target_id,
                    "locked_target_id": p.locked_target_id or p.target_id,
                    "lock_score": round(p.lock_score, 3),
                    "altitude": float(getattr(p, "altitude", PLAYER_ALT_DEFAULT)),
                    "from_player": bool(getattr(p, "from_player", False)),
                    "hp": float(getattr(p, "hp", 0.0)),
                    "hp_max": float(
                        self._wave_missile_hp
                        if p.homing and not p.from_player
                        else 0.0
                    ),
                }
                for p in self.projectiles.values()
                if p.active
            ],
            "priority_target_id": self.priority_target_id,
            "prediction": (
                {"trajectory": [], "future": {"x": 0.0, "y": 0.0}}
                if SKIP_WS_PREDICTION and self.config.player_control
                else {
                    "linear": {"x": float(self.linear_prediction[0]), "y": float(self.linear_prediction[1])},
                    "kalman": {"x": float(self.kalman_prediction[0]), "y": float(self.kalman_prediction[1])},
                    "lstm": {
                        "x": float(self.lstm_prediction[0]),
                        "y": float(self.lstm_prediction[1]),
                    }
                    if self.lstm_prediction is not None
                    else None,
                    "future": {"x": float(self.future_prediction[0]), "y": float(self.future_prediction[1])},
                    "trajectory": self._downsample_points(self.predicted_trajectory, 28)
                    if send_heavy
                    else [],
                }
            ),
            "projectile_trajectory": (
                []
                if SKIP_WS_PREDICTION and self.config.player_control
                else (
                    self._downsample_points(self.projectile_trajectory, 24)
                    if send_heavy
                    else []
                )
            ),
            "debug": (
                {
                    "drone_count": sum(1 for t in self.targets.values() if t.is_drone),
                    "last_hit_target_id": self.last_hit_target_id,
                }
                if SKIP_WS_DEBUG and self.config.player_control
                else {
                    "target_position": {"x": float(tgt_pos[0]), "y": float(tgt_pos[1])},
                    "velocity": {"x": float(tgt_vel[0]), "y": float(tgt_vel[1])},
                    "speed_kmh": float(np.linalg.norm(tgt_vel) * 3.6),
                    "altitude": float(getattr(target, "altitude", PLAYER_ALT_DEFAULT)) if target else PLAYER_ALT_DEFAULT,
                    "future_prediction": {
                        "x": float(self.future_prediction[0]),
                        "y": float(self.future_prediction[1]),
                    },
                    "launch_angle": self.launch_angle_deg,
                    "collision_time": self.collision_time,
                    "priority_target_id": self.priority_target_id,
                    "last_hit_target_id": self.last_hit_target_id,
                }
            ),
            "intercept": self.last_intercept.model_dump() if self.last_intercept else None,
            "engine_version": 3,
            "target_count": len(self.targets),
            "drone_count": sum(1 for t in self.targets.values() if t.is_drone),
        }

    def get_status(self) -> dict:
        return {
            "running": not self.config.paused,
            "fps": self._fps,
            "selected_target_id": self.selected_target_id,
            "config": self.config.model_dump(),
            "last_intercept": self.last_intercept.model_dump() if self.last_intercept else None,
            "collision_time": self.collision_time,
            "hit": self.hit,
        }
