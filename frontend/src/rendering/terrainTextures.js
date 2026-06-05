import * as THREE from 'three';
import { ARENA } from './worldBounds';

let terrainMapCache = null;
let cloudTexCache = null;

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return (
    a * (1 - ux) * (1 - uy) +
    b * ux * (1 - uy) +
    c * (1 - ux) * uy +
    d * ux * uy
  );
}

function fbm(x, y, oct = 4) {
  let v = 0;
  let amp = 0.55;
  let freq = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * smoothNoise(x * freq, y * freq);
    freq *= 2.1;
    amp *= 0.48;
  }
  return v;
}

/** 512px 지형 알베도 — 1회 생성, GPU 업로드만 */
export function getTerrainMapTexture() {
  if (terrainMapCache) return terrainMapCache;

  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const worldSize = ARENA.radius * 2.2;
  const cx = ARENA.cx;
  const cz = ARENA.cz;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const wx = (px / size - 0.5) * worldSize + cx;
      const wz = (py / size - 0.5) * worldSize + cz;

      const n1 = fbm(wx * 0.012, wz * 0.012, 5);
      const n2 = fbm(wx * 0.045 + 40, wz * 0.038, 3);
      const ridge = Math.abs(Math.sin(wx * 0.006) * Math.cos(wz * 0.007));
      const moist = fbm(wx * 0.02 - 20, wz * 0.02 + 10, 2);

      let r = 28 + n1 * 55 + ridge * 22;
      let g = 52 + n1 * 72 + moist * 35;
      let b = 22 + n1 * 28 + n2 * 18;

      if (n2 > 0.62) {
        r = 72 + n2 * 40;
        g = 68 + n2 * 35;
        b = 52 + n2 * 28;
      }
      if (n1 > 0.72) {
        r = 88 + n1 * 30;
        g = 82 + n1 * 25;
        b = 70 + n1 * 20;
      }

      const dx = wx - cx;
      const dz = wz - cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const gridX = Math.abs((wx % 80) - 40) < 1.2;
      const gridZ = Math.abs((wz % 80) - 40) < 1.2;
      if (gridX || gridZ) {
        r = r * 0.75 + 70;
        g = g * 0.75 + 110;
        b = b * 0.75 + 130;
      }

      const ringW = 5;
      const ringInner = ARENA.radius * 0.9;
      const ringOuter = ARENA.radius;
      if (dist > ringInner && dist < ringOuter) {
        const t = (dist - ringInner) / (ringOuter - ringInner);
        r = 255 * (0.6 + t * 0.4);
        g = 110 + t * 40;
        b = 20;
      }

      const i = (py * size + px) * 4;
      d[i] = Math.min(255, r);
      d[i + 1] = Math.min(255, g);
      d[i + 2] = Math.min(255, b);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  terrainMapCache = tex;
  return tex;
}

/** 구름 스프라이트 공용 소프트 텍스처 */
export function getCloudSpriteTexture() {
  if (cloudTexCache) return cloudTexCache;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cloudTexCache = tex;
  return tex;
}

export function disposeTerrainTextures() {
  terrainMapCache?.dispose();
  cloudTexCache?.dispose();
  terrainMapCache = null;
  cloudTexCache = null;
}
