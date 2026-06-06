import * as THREE from 'three';
import { altitudeToY } from './skyEnvironment';
import { ARENA } from './worldBounds';
import { getTerrainMapTexture, sampleTerrainHeight } from './terrainTextures';

function buildHorizonMountains(waveSeed = 1) {
  const positions = [];
  const colors = [];
  const count = 14;
  const baseR = ARENA.radius * 1.45;
  const phase = waveSeed * 0.4;

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + phase;
    const r = baseR + (i % 5) * 35;
    const bx = ARENA.cx + Math.cos(a) * r;
    const bz = ARENA.cz + Math.sin(a) * r;
    const h = 42 + (i % 4) * 14;
    const w = 100 + (i % 3) * 24;

    const peak = [bx, h, bz];
    const left = [bx - w * 0.48, -2, bz - w * 0.1];
    const right = [bx + w * 0.48, -2, bz + w * 0.1];
    positions.push(...left, ...right, ...peak, ...left);

    const shade = 0.3 + (i % 4) * 0.03;
    for (let v = 0; v < 3; v++) {
      colors.push(shade * 0.5, shade * 0.58, shade * 0.72);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  return new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: true })
  );
}

function buildTerrainMesh(waveSeed = 1) {
  const size = ARENA.radius * 2.2;
  const segs = 24;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, sampleTerrainHeight(x, z, waveSeed));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({
    map: getTerrainMapTexture(waveSeed),
    color: 0xffffff,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(ARENA.cx, -12, ARENA.cz);
  return { mesh, geo, mat };
}

/** 단순 전투 구역 지형 */
export function createFlightGround() {
  const group = new THREE.Group();
  group.name = 'flightGround';

  let currentWave = 1;
  let terrainEntry = buildTerrainMesh(currentWave);
  group.add(terrainEntry.mesh);

  let mountains = buildHorizonMountains(currentWave);
  mountains.position.y = -12;
  group.add(mountains);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(ARENA.radius * 0.95, ARENA.radius * 1.01, 40),
    new THREE.MeshBasicMaterial({
      color: 0xff8833,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(ARENA.cx, -4, ARENA.cz);
  group.add(ring);

  function setWave(wave) {
    const w = Math.max(1, wave | 0);
    if (w === currentWave) return;
    currentWave = w;

    group.remove(terrainEntry.mesh);
    terrainEntry.geo.dispose();
    terrainEntry.mat.dispose();
    terrainEntry = buildTerrainMesh(w);
    group.add(terrainEntry.mesh);

    group.remove(mountains);
    mountains.geometry.dispose();
    mountains.material.dispose();
    mountains = buildHorizonMountains(w);
    mountains.position.y = -12;
    group.add(mountains);
  }

  return {
    group,
    setWave,
    setAltitude(altM) {
      group.position.y = altitudeToY(altM) - 10;
    },
    scroll() {},
    update() {},
    dispose() {
      terrainEntry.geo.dispose();
      terrainEntry.mat.dispose();
      mountains.geometry.dispose();
      mountains.material.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
    },
  };
}
