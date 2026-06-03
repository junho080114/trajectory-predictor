import * as THREE from 'three';
import { altitudeToY } from './skyEnvironment';

const MAX_PARTICLES = 72;
const TRAIL_LEN = 10;

function spawnParticle(pool, pos, vel, life, kind) {
  const p = pool.find((x) => !x.active);
  if (!p) return;
  p.active = true;
  p.life = life;
  p.maxLife = life;
  p.pos.copy(pos);
  p.vel.copy(vel);
  p.kind = kind;
}

export function createFlightEffects(scene) {
  const group = new THREE.Group();
  group.name = 'fx';
  scene.add(group);

  const pool = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    life: 0,
    maxLife: 1,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    kind: 'smoke',
  }));

  const smokeGeo = new THREE.BufferGeometry();
  const smokePos = new Float32Array(MAX_PARTICLES * 3);
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smokePts = new THREE.Points(
    smokeGeo,
    new THREE.PointsMaterial({
      color: 0xb8c0cc,
      size: 7,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  group.add(smokePts);

  const flameGeo = new THREE.BufferGeometry();
  const flamePos = new Float32Array(MAX_PARTICLES * 3);
  flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3));
  const flamePts = new THREE.Points(
    flameGeo,
    new THREE.PointsMaterial({
      color: 0xff9944,
      size: 9,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );
  group.add(flamePts);

  const missileFx = new Map();
  const tmp = new THREE.Vector3();
  const back = new THREE.Vector3();
  let shake = 0;
  let exhaustAcc = 0;

  const trailMat = new THREE.LineBasicMaterial({
    color: 0xff6633,
    transparent: true,
    opacity: 0.4,
  });

  function getMissileFx(id) {
    if (!missileFx.has(id)) {
      const g = new THREE.Group();
      const trailGeo = new THREE.BufferGeometry();
      const trailPos = new Float32Array(TRAIL_LEN * 3);
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
      const trail = new THREE.Line(trailGeo, trailMat);
      g.add(trail);
      group.add(g);
      missileFx.set(id, { group: g, trail, trailGeo, trailPos, points: [] });
    }
    return missileFx.get(id);
  }

  return {
    shake,
    update(dt, player, projectiles, entities) {
      shake *= Math.exp(-8 * dt);
      const activeIds = new Set(projectiles?.map((p) => p.id) ?? []);

      for (const [id, fx] of missileFx) {
        if (!activeIds.has(id)) {
          group.remove(fx.group);
          fx.trailGeo.dispose();
          missileFx.delete(id);
        }
      }

      let si = 0;
      let fi = 0;

      for (const p of projectiles ?? []) {
        const mesh = entities?.projectiles?.get?.(p.id);
        const x = mesh?.position?.x ?? p.position?.x ?? 0;
        const y = mesh?.position?.y ?? altitudeToY(p.altitude ?? 4300);
        const z = mesh?.position?.z ?? p.position?.y ?? 0;
        const vx = p.velocity?.x ?? 0;
        const vy = p.velocity?.y ?? 0;
        const spd = Math.hypot(vx, vy);

        const fx = getMissileFx(p.id);
        fx.group.position.set(x, y, z);

        const yaw = Math.atan2(vx, vy);
        fx.points.push(new THREE.Vector3(x, y, z));
        if (fx.points.length > TRAIL_LEN) fx.points.shift();
        const n = fx.points.length;
        for (let i = 0; i < TRAIL_LEN; i++) {
          const pt = fx.points[Math.max(0, n - TRAIL_LEN + i)] || fx.points[0];
          if (pt) {
            fx.trailPos[i * 3] = pt.x;
            fx.trailPos[i * 3 + 1] = pt.y;
            fx.trailPos[i * 3 + 2] = pt.z;
          }
        }
        fx.trailGeo.attributes.position.needsUpdate = true;
        fx.trailGeo.setDrawRange(0, Math.max(2, n));

        if (spd > 50 && Math.random() < 0.35) {
          tmp.set(x, y, z);
          back.set(-Math.sin(yaw), 0, -Math.cos(yaw));
          spawnParticle(
            pool,
            tmp,
            back.multiplyScalar(-12).add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4)),
            0.35 + Math.random() * 0.2,
            'smoke'
          );
        }
      }

      if (player) {
        const mesh = entities?.targets?.get?.(player.id);
        const s = mesh?.userData?.smooth;
        if (s) {
          const yaw = s.yaw ?? 0;
          const pitch = player.pitch ?? 0;
          const viewYaw = player._viewYaw ?? 0;
          const aimYaw = yaw + viewYaw;
          const spd = player.speed_kmh ?? 0;
          if (player.muzzleFlash) {
            tmp.set(
              s.x + Math.sin(aimYaw) * Math.cos(pitch) * 14,
              s.y + Math.sin(pitch) * 8,
              s.z + Math.cos(aimYaw) * Math.cos(pitch) * 14
            );
            for (let i = 0; i < 6; i++) {
              spawnParticle(
                pool,
                tmp,
                new THREE.Vector3(
                  Math.sin(aimYaw) * 80 + (Math.random() - 0.5) * 20,
                  Math.sin(pitch) * 40,
                  Math.cos(aimYaw) * 80 + (Math.random() - 0.5) * 20
                ),
                0.08 + Math.random() * 0.06,
                'flame'
              );
            }
          }
          exhaustAcc += dt;
          if (spd > 120 && exhaustAcc > 0.08) {
            exhaustAcc = 0;
            tmp.set(s.x - Math.sin(yaw) * 12, s.y - 1, s.z - Math.cos(yaw) * 12);
            spawnParticle(
              pool,
              tmp,
              new THREE.Vector3(-Math.sin(yaw) * 22, 1, -Math.cos(yaw) * 22),
              0.2,
              'flame'
            );
            spawnParticle(
              pool,
              tmp,
              new THREE.Vector3(-Math.sin(yaw) * 10, 2, -Math.cos(yaw) * 10),
              0.45,
              'smoke'
            );
          }
        }
      }

      if (player && projectiles?.length) {
        const px = player.position?.x ?? 0;
        const pz = player.position?.y ?? 0;
        for (const m of projectiles) {
          const horiz = Math.hypot((m.position?.x ?? 0) - px, (m.position?.y ?? 0) - pz);
          if (horiz < 100) shake = Math.max(shake, 0.2 * (1 - horiz / 100));
        }
      }

      for (const part of pool) {
        if (!part.active) continue;
        part.life -= dt;
        if (part.life <= 0) {
          part.active = false;
          continue;
        }
        const t = part.life / part.maxLife;
        part.pos.addScaledVector(part.vel, dt * (0.6 + t * 0.4));
        part.vel.y += (part.kind === 'smoke' ? 2.5 : -0.5) * dt;
        if (part.kind === 'flame' && fi < MAX_PARTICLES) {
          flamePos[fi * 3] = part.pos.x;
          flamePos[fi * 3 + 1] = part.pos.y;
          flamePos[fi * 3 + 2] = part.pos.z;
          fi++;
        } else if (part.kind === 'smoke' && si < MAX_PARTICLES) {
          smokePos[si * 3] = part.pos.x;
          smokePos[si * 3 + 1] = part.pos.y;
          smokePos[si * 3 + 2] = part.pos.z;
          si++;
        }
      }
      flameGeo.setDrawRange(0, fi);
      flameGeo.attributes.position.needsUpdate = true;
      smokeGeo.setDrawRange(0, si);
      smokeGeo.attributes.position.needsUpdate = true;
      this.shake = shake;
    },
    dispose() {
      scene.remove(group);
      smokeGeo.dispose();
      smokePts.material.dispose();
      flameGeo.dispose();
      flamePts.material.dispose();
      trailMat.dispose();
      for (const fx of missileFx.values()) fx.trailGeo.dispose();
      missileFx.clear();
    },
  };
}
