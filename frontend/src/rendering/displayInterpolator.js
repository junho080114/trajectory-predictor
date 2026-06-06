/** 서버 15Hz 스냅샷 → 60FPS 부드러운 화면 보간 */

const SERVER_STEP = 1 / 15;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function snapTarget(t) {
  return {
    id: t.id,
    is_player: t.is_player,
    is_drone: t.is_drone,
    position: { x: t.position?.x ?? 0, y: t.position?.y ?? 0 },
    velocity: { x: t.velocity?.x ?? 0, y: t.velocity?.y ?? 0 },
    heading: t.heading ?? 0,
    pitch: t.pitch ?? 0,
    bank: t.bank ?? 0,
    altitude: t.altitude ?? 4500,
    throttle: t.throttle ?? 0.5,
    speed_kmh: t.speed_kmh,
    hp: t.hp,
    hp_max: t.hp_max,
  };
}

function snapProjectile(p) {
  return {
    id: p.id,
    position: { x: p.position?.x ?? 0, y: p.position?.y ?? 0 },
    velocity: { x: p.velocity?.x ?? 0, y: p.velocity?.y ?? 0 },
    altitude: p.altitude ?? 4300,
    homing: p.homing,
    from_player: p.from_player,
    hp: p.hp,
    hp_max: p.hp_max,
    target_id: p.target_id,
    locked_target_id: p.locked_target_id,
  };
}

function blendTarget(a, b, t) {
  return {
    ...b,
    position: {
      x: lerp(a.position.x, b.position.x, t),
      y: lerp(a.position.y, b.position.y, t),
    },
    velocity: {
      x: lerp(a.velocity.x, b.velocity.x, t),
      y: lerp(a.velocity.y, b.velocity.y, t),
    },
    heading: lerpAngle(a.heading, b.heading, t),
    pitch: lerp(a.pitch, b.pitch, t),
    bank: lerp(a.bank, b.bank, t),
    altitude: lerp(a.altitude, b.altitude, t),
    throttle: lerp(a.throttle, b.throttle, t),
  };
}

function blendProjectile(a, b, t) {
  return {
    ...b,
    position: {
      x: lerp(a.position.x, b.position.x, t),
      y: lerp(a.position.y, b.position.y, t),
    },
    velocity: {
      x: lerp(a.velocity.x, b.velocity.x, t),
      y: lerp(a.velocity.y, b.velocity.y, t),
    },
    altitude: lerp(a.altitude, b.altitude, t),
  };
}

export function createDisplayInterpolator() {
  let prev = null;
  let curr = null;
  let lastSimTime = -1;
  let feedAt = performance.now();

  return {
    feed(state) {
      const simTime = state.simTime ?? 0;
      if (simTime === lastSimTime && curr) {
        return;
      }
      prev = curr;
      curr = {
        simTime,
        targets: (state.targets ?? []).map(snapTarget),
        projectiles: (state.projectiles ?? []).map(snapProjectile),
        game: state.game,
        arena: state.arena,
        hit: state.hit,
        hitTimer: state.hitTimer,
      };
      lastSimTime = simTime;
      feedAt = performance.now();
    },

    getView(now = performance.now()) {
      if (!curr) return null;
      const elapsed = (now - feedAt) / 1000;
      const alpha = Math.min(1.05, elapsed / SERVER_STEP);
      if (!prev || alpha >= 1) {
        return curr;
      }
      const byId = new Map(prev.targets.map((t) => [t.id, t]));
      const targets = curr.targets.map((t) => {
        const p = byId.get(t.id);
        return p ? blendTarget(p, t, alpha) : t;
      });
      const pById = new Map(prev.projectiles.map((p) => [p.id, p]));
      const projectiles = curr.projectiles.map((p) => {
        const o = pById.get(p.id);
        return o ? blendProjectile(o, p, alpha) : p;
      });
      return { ...curr, targets, projectiles };
    },
  };
}
