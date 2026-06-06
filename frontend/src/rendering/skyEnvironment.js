import * as THREE from 'three';
import { makeSkyGradient, makeSunSpriteTexture } from './sceneUtils';
import { getCloudSpriteTexture } from './terrainTextures';
import { ARENA } from './worldBounds';

export const ALT_TO_WORLD = 1 / 42;

export function altitudeToY(altM) {
  return (altM ?? 4500) * ALT_TO_WORLD;
}

function cloudLocalPos(i, px, pz) {
  const cell = 520;
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

/** 경량 하늘 — 고품질 그라데이션 + 소프트 구름 */
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

  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(6000, 20, 12), skyMat);
  root.add(skyDome);

  const sunTex = makeSunSpriteTexture();
  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunTex,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  sun.scale.set(720, 720, 1);
  sun.position.set(2400, 1750, -1200);
  root.add(sun);

  const cloudTex = getCloudSpriteTexture();
  const cloudMat = new THREE.SpriteMaterial({
    map: cloudTex,
    transparent: true,
    depthWrite: false,
    color: 0xffffff,
  });

  const cloudSprites = [];
  for (let i = 0; i < 8; i++) {
    const spr = new THREE.Sprite(cloudMat.clone());
    spr.material.opacity = 0.1 + (i % 3) * 0.04;
    const s = 150 + (i % 4) * 35;
    spr.scale.set(s * 1.3, s * 0.32, 1);
    root.add(spr);
    cloudSprites.push(spr);
  }

  scene.add(root);
  scene.background = new THREE.Color(0x4a8ab8);
  scene.fog = new THREE.FogExp2(0x7aa8cc, 0.000085);

  let lastCell = -9999;

  return {
    root,
    follow(centerX, centerZ, altM = 4500, heading = 0, _vx = 0, _vz = 0, bounds = null) {
      const altY = altitudeToY(altM);
      root.position.set(centerX, altY * 0.06, centerZ);
      root.rotation.y = heading * 0.06;

      const cell = Math.floor(centerX / 400) + Math.floor(centerZ / 400) * 1000;
      if (cell !== lastCell) {
        lastCell = cell;
        for (let i = 0; i < cloudSprites.length; i++) {
          const off = cloudLocalPos(i, centerX, centerZ);
          cloudSprites[i].position.set(off.x, 40 + (i % 4) * 12, off.z);
        }
      }

      const edgeDist =
        bounds?.radius != null
          ? bounds.radius -
            Math.sqrt(
              (centerX - (bounds.centerX ?? 600)) ** 2 +
                (altM - (bounds.centerAlt ?? 4500)) ** 2 +
                (centerZ - (bounds.centerZ ?? 350)) ** 2
            )
          : 200;
      const edgeFactor = Math.max(0, 1 - edgeDist / 120);
      const span = bounds?.radius ?? ARENA.radius;
      const cx = bounds?.centerX ?? ARENA.cx;
      scene.background.setHSL(
        0.55 + ((centerX - cx) / span) * 0.025,
        0.38,
        0.52 + Math.min(0.14, altY / 400)
      );
      scene.fog.density = 0.000085 + edgeFactor * 0.000035;
      scene.fog.color.setHSL(0.58, 0.28, 0.72);
    },
    dispose() {
      scene.remove(root);
      skyDome.geometry.dispose();
      skyMat.dispose();
      grad.dispose();
      sunTex.dispose();
      cloudSprites.forEach((s) => s.material.dispose());
    },
  };
}
