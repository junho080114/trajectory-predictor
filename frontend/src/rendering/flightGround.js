import * as THREE from 'three';
import { altitudeToY } from './skyEnvironment';
import { ARENA } from './worldBounds';
import {
  getTerrainMapTexture,
  sampleTerrainHeight,
  terrainSurfaceWorldY,
  isTerrainWater,
} from './terrainTextures';

const GROUND_Y = 0;
const TERRAIN_SIZE = 2400;
const TERRAIN_SEGS = 56;

function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildTerrainMesh(waveSeed = 1) {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainSurfaceWorldY(x, z, waveSeed));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: getTerrainMapTexture(waveSeed),
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.03,
  });
  return { mesh: new THREE.Mesh(geo, mat), geo, mat };
}

function buildHorizonMountains(waveSeed = 1) {
  const positions = [];
  const colors = [];
  const count = 36;
  const baseR = TERRAIN_SIZE * 0.46;
  const phase = waveSeed * 0.55;
  const rnd = seededRand(waveSeed * 991);

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + phase;
    const r = baseR + rnd() * 180;
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    const h = 90 + rnd() * 120 + (i % 4) * 25;
    const w = 160 + rnd() * 100;

    const peak = [bx, h, bz];
    const left = [bx - w * 0.5, -8, bz - w * 0.12];
    const right = [bx + w * 0.5, -8, bz + w * 0.12];
    positions.push(...left, ...right, ...peak, ...left);

    const shade = 0.22 + rnd() * 0.18;
    for (let v = 0; v < 3; v++) {
      colors.push(shade * 0.45, shade * 0.52, shade * 0.68);
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

function buildTreeInstances(waveSeed = 1) {
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 2.2, 5);
  const crownGeo = new THREE.ConeGeometry(2.2, 5.5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3528 });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2d6b38 });

  const group = new THREE.Group();
  const rnd = seededRand(waveSeed * 313);
  const count = 140;
  const dummy = new THREE.Object3D();

  for (let i = 0; i < count; i++) {
    const x = (rnd() - 0.5) * TERRAIN_SIZE * 0.82;
    const z = (rnd() - 0.5) * TERRAIN_SIZE * 0.82;
    const h = terrainSurfaceWorldY(x, z, waveSeed);
    if (h < 4 || h > 42 || isTerrainWater(x, z, waveSeed)) continue;

    const scale = 0.7 + rnd() * 0.9;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.1 * scale;
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.y = 4.2 * scale;
    tree.add(trunk, crown);
    tree.position.set(x, h, z);
    tree.rotation.y = rnd() * Math.PI * 2;
    tree.scale.setScalar(scale);
    group.add(tree);
  }
  return group;
}

function buildRockClusters(waveSeed = 1) {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0x6a6560, flatShading: true });
  const group = new THREE.Group();
  const rnd = seededRand(waveSeed * 557);

  for (let i = 0; i < 85; i++) {
    const x = (rnd() - 0.5) * TERRAIN_SIZE * 0.78;
    const z = (rnd() - 0.5) * TERRAIN_SIZE * 0.78;
    const h = terrainSurfaceWorldY(x, z, waveSeed);
    if (h < 18 || isTerrainWater(x, z, waveSeed)) continue;

    const rock = new THREE.Mesh(geo, mat);
    const s = 1.2 + rnd() * 3.5;
    rock.scale.set(s * 1.2, s * 0.8, s);
    rock.position.set(x, h + s * 0.35, z);
    rock.rotation.set(rnd(), rnd(), rnd());
    group.add(rock);
  }
  return group;
}

function buildVillages(waveSeed = 1) {
  const group = new THREE.Group();
  const rnd = seededRand(waveSeed * 773);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x8a8078 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6b4030 });

  for (let v = 0; v < 6; v++) {
    const cx = (rnd() - 0.5) * TERRAIN_SIZE * 0.55;
    const cz = (rnd() - 0.5) * TERRAIN_SIZE * 0.55;
    const baseH = terrainSurfaceWorldY(cx, cz, waveSeed);
    if (baseH < 2 || baseH > 28 || isTerrainWater(cx, cz, waveSeed)) continue;

    const village = new THREE.Group();
    const n = 4 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      const bx = cx + (rnd() - 0.5) * 55;
      const bz = cz + (rnd() - 0.5) * 55;
      const h = terrainSurfaceWorldY(bx, bz, waveSeed);
      const body = new THREE.Mesh(new THREE.BoxGeometry(5 + rnd() * 4, 3 + rnd() * 3, 5 + rnd() * 4), wallMat);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2.5, 4), roofMat);
      body.position.set(bx, h + 1.5, bz);
      roof.position.set(bx, h + 4.2, bz);
      roof.rotation.y = rnd() * Math.PI;
      village.add(body, roof);
    }
    group.add(village);
  }
  return group;
}

function buildWaterPlanes(waveSeed = 1) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a6a8a,
    transparent: true,
    opacity: 0.72,
    roughness: 0.15,
    metalness: 0.35,
  });
  const step = 48;
  const half = TERRAIN_SIZE * 0.4;

  for (let gx = -half; gx < half; gx += step) {
    for (let gz = -half; gz < half; gz += step) {
      const cx = gx + step * 0.5;
      const cz = gz + step * 0.5;
      if (!isTerrainWater(cx, cz, waveSeed)) continue;
      const h = terrainSurfaceWorldY(cx, cz, waveSeed);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(step * 0.95, step * 0.95), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(cx, h - 0.4, cz);
      group.add(plane);
    }
  }
  return group;
}

function buildAltitudeMarkers(waveSeed = 1) {
  const group = new THREE.Group();
  const rnd = seededRand(waveSeed * 131);
  const colors = [0xff6644, 0xffaa44, 0x44cc88, 0x4488ff];

  for (let i = 0; i < 16; i++) {
    const x = (rnd() - 0.5) * TERRAIN_SIZE * 0.35;
    const z = (rnd() - 0.5) * TERRAIN_SIZE * 0.35;
    const h = terrainSurfaceWorldY(x, z, waveSeed);
    if (h < 8) continue;

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 28, 6),
      new THREE.MeshBasicMaterial({ color: colors[i % colors.length] })
    );
    pole.position.set(x, h + 14, z);
    group.add(pole);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.12, 6, 16),
      new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, h + 26, z);
    group.add(ring);
  }
  return group;
}

function buildWorldContent(waveSeed) {
  const content = new THREE.Group();
  content.name = 'worldContent';

  const terrainEntry = buildTerrainMesh(waveSeed);
  content.add(terrainEntry.mesh);

  const mountains = buildHorizonMountains(waveSeed);
  mountains.position.y = -6;
  content.add(mountains);

  content.add(buildWaterPlanes(waveSeed));
  content.add(buildTreeInstances(waveSeed));
  content.add(buildRockClusters(waveSeed));
  content.add(buildVillages(waveSeed));
  content.add(buildAltitudeMarkers(waveSeed));

  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 14),
    new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.85, metalness: 0.1 })
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, terrainSurfaceWorldY(0, 0, waveSeed) + 0.15, 0);
  content.add(runway);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8d8e8 });
  for (let i = -50; i <= 50; i += 10) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 10), lineMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(i, runway.position.y + 0.05, 0);
    content.add(stripe);
  }

  return { content, terrainEntry, mountains };
}

/** 3D 전투 구역 — 고정 지형 + 플레이어 고도로 상승/항강 체감 */
export function createFlightGround() {
  const group = new THREE.Group();
  group.name = 'flightGround';
  group.position.y = GROUND_Y;

  let currentWave = 1;
  let world = buildWorldContent(currentWave);
  group.add(world.content);

  const arenaRing = new THREE.Mesh(
    new THREE.RingGeometry(ARENA.radius * 0.92, ARENA.radius * 0.98, 64),
    new THREE.MeshBasicMaterial({
      color: 0xff8833,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  arenaRing.rotation.x = -Math.PI / 2;
  arenaRing.position.y = 2;
  group.add(arenaRing);

  function disposeWorld(w) {
    const geos = new Set();
    const mats = new Set();
    w.content.traverse((obj) => {
      if (obj.geometry) geos.add(obj.geometry);
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => mats.add(m));
        else mats.add(obj.material);
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    group.remove(w.content);
  }

  function setWave(wave) {
    const w = Math.max(1, wave | 0);
    if (w === currentWave) return;
    currentWave = w;
    disposeWorld(world);
    world = buildWorldContent(w);
    group.add(world.content);
  }

  return {
    group,
    setWave,
    /** 지형은 고정 — 고도 변화는 기체 Y로만 표현 */
    setAltitude() {},
    scroll(px, pz) {
      group.position.x = px;
      group.position.z = pz;
    },
    update(px, pz, altM, wave) {
      setWave(wave);
      scroll(px, pz);
      const altY = altitudeToY(altM);
      const haze = Math.max(0.12, 1 - (altY - 80) / 120);
      world.terrainEntry.mat.opacity = 0.92 + haze * 0.08;
      arenaRing.position.y = 2 + Math.sin(Date.now() * 0.001) * 0.2;
    },
    dispose() {
      disposeWorld(world);
      arenaRing.geometry.dispose();
      arenaRing.material.dispose();
    },
  };
}
