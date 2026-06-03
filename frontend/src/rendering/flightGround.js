import * as THREE from 'three';
import { altitudeToY } from './skyEnvironment';
import { ARENA } from './worldBounds';

/** 전투 구역 지형 + 격자 */
export function createFlightGround() {
  const group = new THREE.Group();
  group.name = 'flightGround';

  const size = ARENA.radius * 2.2;
  const segs = 32;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h =
      Math.sin(x * 0.008) * 6 +
      Math.cos(z * 0.009) * 5 +
      Math.sin((x + z) * 0.006) * 4;
    pos.setY(i, h);
  }
  geo.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({
      color: 0x3d5c48,
      flatShading: true,
    })
  );
  terrain.position.set(ARENA.cx, -12, ARENA.cz);
  group.add(terrain);

  const grid = new THREE.GridHelper(ARENA.radius * 1.6, 24, 0x6a9eb8, 0x3a5a6a);
  grid.position.set(ARENA.cx, -6, ARENA.cz);
  group.add(grid);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(ARENA.radius * 0.92, ARENA.radius, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(ARENA.cx, -4, ARENA.cz);
  group.add(ring);

  return {
    group,
    setAltitude(altM) {
      group.position.y = altitudeToY(altM) - 10;
    },
    scroll() {},
    dispose() {
      geo.dispose();
      terrain.material.dispose();
      grid.geometry.dispose();
      grid.material.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
    },
  };
}
