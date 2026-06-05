import * as THREE from 'three';
import { altitudeToY } from './skyEnvironment';
import { ARENA } from './worldBounds';
import { getTerrainMapTexture } from './terrainTextures';

function sampleHeight(x, z) {
  return (
    Math.sin(x * 0.008) * 8 +
    Math.cos(z * 0.009) * 7 +
    Math.sin((x + z) * 0.006) * 5 +
    Math.sin(x * 0.022 + z * 0.019) * 2.5 +
    Math.cos(x * 0.035) * Math.sin(z * 0.032) * 1.8
  );
}

function buildHorizonMountains() {
  const positions = [];
  const colors = [];
  const count = 28;
  const baseR = ARENA.radius * 1.55;
  const cx = ARENA.cx;
  const cz = ARENA.cz;

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const jitter = (i % 5) * 0.08;
    const r = baseR + 120 + (i % 7) * 45;
    const bx = cx + Math.cos(a + jitter) * r;
    const bz = cz + Math.sin(a + jitter) * r;
    const h = 55 + (i % 6) * 22 + (i % 3) * 15;
    const w = 90 + (i % 4) * 35;

    const peak = [bx, h, bz];
    const left = [bx - w * 0.5, 0, bz - w * 0.12];
    const right = [bx + w * 0.5, 0, bz + w * 0.12];
    positions.push(...left, ...right, ...peak, ...left);

    const shade = 0.32 + (i % 5) * 0.04;
    for (let v = 0; v < 3; v++) {
      colors.push(shade * 0.55, shade * 0.62, shade * 0.78);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  return new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      fog: true,
    })
  );
}

/** 전투 구역 지형 — 프로시저럴 텍스처 + 원거리 산맥 (드로우콜 최소) */
export function createFlightGround() {
  const group = new THREE.Group();
  group.name = 'flightGround';

  const size = ARENA.radius * 2.2;
  const segs = 36;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colorArr = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = sampleHeight(x, z);
    pos.setY(i, h);

    const hn = Math.max(0, Math.min(1, (h + 14) / 28));
    colorArr[i * 3] = 0.18 + hn * 0.12;
    colorArr[i * 3 + 1] = 0.32 + hn * 0.22;
    colorArr[i * 3 + 2] = 0.14 + hn * 0.08;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
  geo.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({
      map: getTerrainMapTexture(),
      vertexColors: true,
      flatShading: false,
    })
  );
  terrain.position.set(ARENA.cx, -12, ARENA.cz);
  group.add(terrain);

  const mountains = buildHorizonMountains();
  mountains.position.y = -12;
  group.add(mountains);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(ARENA.radius * 0.94, ARENA.radius * 1.02, 64),
    new THREE.MeshBasicMaterial({
      color: 0xff7722,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(ARENA.cx, -3, ARENA.cz);
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
      mountains.geometry.dispose();
      mountains.material.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
    },
  };
}
