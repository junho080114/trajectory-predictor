import { create } from 'zustand';

const defaultConfig = {
  target_speed: 780,
  target_acceleration: 0,
  noise_level: 0,
  muzzle_velocity: 220,
  auto_fire: true,
  use_kalman: true,
  use_lstm: false,
  use_air_resistance: false,
  evasion_mode: false,
  sim_speed: 1,
  paused: false,
  player_control: true,
  ai_targets: true,
  homing_missiles: true,
  homing_turn_rate: 7.5,
  max_active_missiles: 3,
  ai_difficulty: 1.0,
};

export { CAMERA_MODES } from '../rendering/flightCamera';

const defaultCamera = {
  cameraMode: 'chase',
  cameraDistance: 300,
  orbitYaw: 0,
  orbitPitch: 0.42,
  viewYaw: 0,
  viewPitch: 0,
  yawRate: 0,
  pitchRate: 0,
  pointerLocked: false,
};

const defaultDebug = {
  target_position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  future_prediction: { x: 0, y: 0 },
  launch_angle: 0,
  collision_time: null,
};

export const useSimulationStore = create((set, get) => ({
  connected: false,
  fps: 60,
  localFps: 60,
  hit: false,
  hitTimer: 0,
  simTime: 0,
  canvas: { width: 1200, height: 700 },
  arena: {
    shape: 'sphere',
    center: { x: 600, z: 350, altitude: 4500 },
    radius: 500,
  },
  launcher: { x: 100, y: 600 },
  targets: [],
  projectiles: [],
  selectedTargetId: 'target-0',
  config: { ...defaultConfig },
  ...defaultCamera,
  prediction: {
    linear: { x: 0, y: 0 },
    kalman: { x: 0, y: 0 },
    lstm: null,
    future: { x: 0, y: 0 },
    trajectory: [],
  },
  projectileTrajectory: [],
  intercept: null,
  debug: { ...defaultDebug },
  game: {
    hp: 100,
    hp_max: 100,
    score: 0,
    kills: 0,
    wave: 1,
    cannon_ready: true,
    game_over: false,
    wave_clear: false,
    wave_clear_timer: 0,
    drones_alive: 0,
    drones_total: 3,
    missile_hp_max: 3,
    max_missiles: 3,
  },
  gameStarted: false,
  panelOpen: false,
  lastFireHit: false,
  lastFireIntercept: false,
  lastFireMsg: '',

  setConnected: (connected) => set({ connected }),
  setGameStarted: (gameStarted) => set({ gameStarted }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setLocalFps: (localFps) => set({ localFps }),

  applyServerState: (payload) => {
    const targets = payload.targets ?? [];
    const prev = get();
    const droneCount =
      payload.drone_count ??
      targets.filter((t) => t.is_drone || String(t.id || '').startsWith('drone')).length;
    const incomingPred = payload.prediction;
    const incomingTraj = payload.projectile_trajectory;
    const oldPlayer = prev.targets.find((t) => t.is_player);
    const newPlayer = targets.find((t) => t.is_player);
    let viewYaw = prev.viewYaw;
    let viewPitch = prev.viewPitch;
    if (oldPlayer && newPlayer && newPlayer.heading != null && oldPlayer.heading != null) {
      let dh = newPlayer.heading - oldPlayer.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      viewYaw -= dh;
      if (Math.abs(viewYaw) < 0.012) viewYaw = 0;
    }
    set({
      viewYaw,
      viewPitch,
      fps: payload.fps ?? prev.fps,
      hit: payload.hit ?? false,
      hitTimer: payload.hit_timer ?? 0,
      simTime: payload.sim_time ?? 0,
      canvas: payload.canvas ?? prev.canvas,
      arena: payload.arena ?? prev.arena,
      launcher: payload.launcher ?? prev.launcher,
      targets,
      projectiles: payload.projectiles ?? [],
      selectedTargetId: payload.selected_target_id ?? prev.selectedTargetId,
      config: {
        ...prev.config,
        ...(payload.config ?? {}),
        paused: payload.config?.paused ?? false,
      },
      prediction: incomingPred
        ? {
            ...prev.prediction,
            ...incomingPred,
            trajectory:
              incomingPred.trajectory?.length > 0
                ? incomingPred.trajectory
                : prev.prediction.trajectory,
          }
        : prev.prediction,
      projectileTrajectory:
        incomingTraj?.length > 0 ? incomingTraj : prev.projectileTrajectory,
      intercept: payload.intercept ?? null,
      debug: {
        ...(payload.debug ?? get().debug),
        drone_count: droneCount,
        engine_version: payload.engine_version ?? 0,
      },
      game: payload.game ?? prev.game,
    });
  },

  updateConfig: (partial) => {
    const config = { ...get().config, ...partial };
    set({ config });
    return config;
  },

  setCameraMode: (cameraMode) => set({ cameraMode }),
  cycleCameraMode: () => {
    const modes = ['cockpit', 'chase', 'orbit'];
    const idx = modes.indexOf(get().cameraMode);
    const next = modes[(idx + 1) % modes.length];
    set({ cameraMode: next });
    return next;
  },
  addControlRates: (yawDelta, pitchDelta) => {
    const y = Math.max(-1, Math.min(1, get().yawRate + yawDelta));
    const p = Math.max(-1, Math.min(1, get().pitchRate - pitchDelta));
    set({
      yawRate: y,
      pitchRate: p,
      viewYaw: Math.max(-0.9, Math.min(0.9, get().viewYaw + yawDelta * 0.35)),
      viewPitch: Math.max(-0.75, Math.min(0.75, get().viewPitch - pitchDelta * 0.35)),
    });
  },
  decayControlRates: (dt) => {
    const d = Math.exp(-5.5 * dt);
    set({
      yawRate: get().yawRate * d,
      pitchRate: get().pitchRate * d,
    });
  },
  addViewYaw: (delta) =>
    set({ viewYaw: Math.max(-1.35, Math.min(1.35, get().viewYaw + delta)) }),
  addViewPitch: (delta) => {
    const p = Math.max(-1.05, Math.min(1.05, get().viewPitch + delta));
    set({ viewPitch: p });
  },
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  adjustCameraDistance: (delta) => {
    const mode = get().cameraMode;
    if (mode === 'cockpit') return get().cameraDistance;
    const d = Math.max(50, Math.min(620, get().cameraDistance + delta));
    set({ cameraDistance: d });
    return d;
  },
  addOrbitYaw: (delta) => set({ orbitYaw: get().orbitYaw + delta }),
  addOrbitPitch: (delta) => {
    const p = Math.max(0.08, Math.min(1.2, get().orbitPitch + delta));
    set({ orbitPitch: p });
  },

  reset: () =>
    set({
      targets: [],
      projectiles: [],
      hit: false,
      prediction: {
        linear: { x: 0, y: 0 },
        kalman: { x: 0, y: 0 },
        lstm: null,
        future: { x: 0, y: 0 },
        trajectory: [],
      },
      projectileTrajectory: [],
      intercept: null,
      debug: { ...defaultDebug },
    }),
}));
