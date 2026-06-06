import * as THREE from 'three';
import { altitudeToY, ALT_TO_WORLD } from './skyEnvironment';

/** 백엔드 arena.py 와 동일 */
export const ARENA = {
  cx: 600,
  cz: 350,
  alt: 4500,
  radius: 720,
};

/** 구 경계까지 남은 거리(m), 음수면 밖 */
export function distanceToArenaBoundary(px, pz, altM) {
  const dx = px - ARENA.cx;
  const dy = altM - ARENA.alt;
  const dz = pz - ARENA.cz;
  return ARENA.radius - Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** @deprecated 사각 경계 — 구형 distanceToArenaBoundary 사용 */
export function distanceToBoundary(px, pz, width, height, margin = 14) {
  return distanceToArenaBoundary(px, pz, ARENA.alt);
}

/** 3D 구형 전투 구역 (와이어프레임) */
export function createWorldBounds(_width, _height) {
  const group = new THREE.Group();
  group.name = 'sphereArena';

  const wy = altitudeToY(ARENA.alt);
  const ry = ARENA.radius * ALT_TO_WORLD;

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(ARENA.radius, 18, 12),
    new THREE.MeshBasicMaterial({
      color: 0xff5533,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  shell.scale.set(1, ry / ARENA.radius, 1);
  shell.position.set(ARENA.cx, wy, ARENA.cz);
  group.add(shell);

  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(ARENA.radius, 12, 8)),
    new THREE.LineBasicMaterial({ color: 0xff9955, transparent: true, opacity: 0.42 })
  );
  wire.scale.set(1, ry / ARENA.radius, 1);
  wire.position.set(ARENA.cx, wy, ARENA.cz);
  group.add(wire);

  const ringMat = new THREE.LineBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 3; i++) {
    const r = ARENA.radius * (0.55 + i * 0.18);
    const pts = [];
    for (let j = 0; j <= 32; j++) {
      const a = (j / 32) * Math.PI * 2;
      pts.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const ring = new THREE.Line(g, ringMat);
    ring.position.set(ARENA.cx, wy + (i - 1) * ry * 0.22, ARENA.cz);
    group.add(ring);
  }

  return {
    group,
    width: ARENA.radius * 2,
    height: ARENA.radius * 2,
    margin: 14,
    setAltitude(altM) {
      const y = altitudeToY(altM);
      shell.position.y = y;
      wire.position.y = y;
      group.children.forEach((c, i) => {
        if (i > 1) c.position.y = y + (i - 2) * altitudeToY(ARENA.alt) * 0.22 * 0.08;
      });
    },
    dispose() {
      shell.geometry.dispose();
      shell.material.dispose();
      wire.geometry.dispose();
      wire.material.dispose();
      ringMat.dispose();
      group.traverse((o) => {
        if (o.geometry && o !== shell && o !== wire) o.geometry.dispose();
      });
    },
  };
}
