import * as THREE from 'three';
import { makeSkyGradient } from './sceneUtils';
import { ARENA } from './worldBounds';

export const ALT_TO_WORLD = 1 / 42;

export function altitudeToY(altM) {
  return (altM ?? 4500) * ALT_TO_WORLD;
}

function cloudLocalPos(i, px, pz) {
  const cell = 480;
  const gx = Math.floor(px / cell);
  const gz = Math.floor(pz / cell);
  const seed = (i * 17 + gx * 31 + gz * 53) % 997;
  const lx = ((seed * 13) % 1000) / 1000 - 0.5;
  const lz = ((seed * 7) % 1000) / 1000 - 0.5;
  return {
    x: gx * cell + lx * cell * 0.9 - px,
    z: gz * cell + lz * cell * 0.9 - pz,
  };
}

/** 경량 하늘 — 그라데이션 돔 + 소량 구름 */
export function createSkyEnvironment(scene) {
  const root = new THREE.Group();
  root.name = 'skyRoot';

  const grad = makeSkyGradient();
  const skyMat = new THREE.MeshBasicMaterial({
    map: grad,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(6000, 16, 10), skyMat);
  root.add(skyDome);

  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: 0xfff0d8,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
  );
  sun.scale.set(620, 620, 1);
  sun.position.set(2400, 1650, -1200);
  root.add(sun);

  const cloudSprites = [];
  for (let i = 0; i < 10; i++) {
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.1 + (i % 3) * 0.04,
        depthWrite: false,
      })
    );
    const s = 160 + (i % 4) * 30;
    spr.scale.set(s, s * 0.22, 1);
    root.add(spr);
    cloudSprites.push(spr);
  }

  scene.add(root);
  scene.background = new THREE.Color(0x7eb0d4);
  scene.fog = new THREE.FogExp2(0x9eb8d8, 0.00012);

  let lastCell = -9999;

  return {
    root,
    follow(centerX, centerZ, altM = 4500, heading = 0, vx = 0, vz = 0, bounds = null) {
      const altY = altitudeToY(altM);
      root.position.set(centerX, altY * 0.06, centerZ);
      root.rotation.y = heading * 0.06;

      const cell = Math.floor(centerX / 400) + Math.floor(centerZ / 400) * 1000;
      if (cell !== lastCell) {
        lastCell = cell;
        for (let i = 0; i < cloudSprites.length; i++) {
          const off = cloudLocalPos(i, centerX, centerZ);
          cloudSprites[i].position.set(off.x, 35 + (i % 4) * 12, off.z);
        }
      }

      const edgeDist =
        bounds?.radius != null
          ? bounds.radius -
            Math.sqrt(
              (centerX - (bounds.centerX ?? 600)) ** 2 +
                ((altM - (bounds.centerAlt ?? 4500)) ** 2) +
                (centerZ - (bounds.centerZ ?? 350)) ** 2
            )
          : 200;
      const edgeFactor = Math.max(0, 1 - edgeDist / 120);
      const span = bounds?.radius ?? ARENA.radius;
      const cx = bounds?.centerX ?? ARENA.cx;
      scene.background.setHSL(
        0.56 + ((centerX - cx) / span) * 0.03,
        0.3,
        0.58 + Math.min(0.12, altY / 420)
      );
      scene.fog.density = 0.0001 + edgeFactor * 0.00004;
    },
    dispose() {
      scene.remove(root);
      skyDome.geometry.dispose();
      skyMat.dispose();
      grad.dispose();
    },
  };
}
