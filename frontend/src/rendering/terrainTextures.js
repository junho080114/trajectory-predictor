import * as THREE from 'three';
import { ARENA } from './worldBounds';

const terrainMapCache = new Map();
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
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
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
    freq *= 2.05;
    amp *= 0.5;
  }
  return v;
}

export function sampleTerrainHeight(x, z, waveSeed = 1) {
  const w = waveSeed * 0.41;
  const wx = x * 0.0038 + w;
  const wz = z * 0.0036 - w * 0.55;
  const base = fbm(wx, wz, 5) * 42;
  const ridges = Math.pow(fbm(wx * 2.3 + 11, wz * 2.1 - 7, 4), 1.6) * 68;
  const peaks = Math.max(0, fbm(wx * 0.75 + 33, wz * 0.8 + 19, 4) - 0.38) * 110;
  const canyon = Math.sin(wx * 1.4) * Math.cos(wz * 1.1) * 12;
  const detail =
    Math.sin(x * 0.045 + w) * Math.cos(z * 0.038) * 4 +
    Math.sin(x * 0.11 + z * 0.09) * 2.2;
  return base + ridges + peaks + canyon + detail - 22;
}

/** 지형 고도(m) — 항공 고도(4500m대) 대비 지표면 오프셋 */
export function terrainSurfaceWorldY(x, z, waveSeed = 1) {
  return sampleTerrainHeight(x, z, waveSeed) * 0.85;
}

export function isTerrainWater(x, z, waveSeed = 1) {
  const h = sampleTerrainHeight(x, z, waveSeed);
  const moist = fbm(x * 0.006 + waveSeed, z * 0.006, 2);
  return h < -6 && moist > 0.42;
}

/** 웨이브마다 다른 지형 텍스처 (캐시) */
export function getTerrainMapTexture(waveSeed = 1) {
  const key = waveSeed | 0;
  if (terrainMapCache.has(key)) return terrainMapCache.get(key);

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
  const phase = key * 1.73;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const wx = (px / size - 0.5) * worldSize + cx;
      const wz = (py / size - 0.5) * worldSize + cz;

      const th = sampleTerrainHeight(wx, wz, key);
      const n1 = fbm(wx * 0.011 + phase, wz * 0.011 - phase * 0.6, 4);
      const n2 = fbm(wx * 0.038 + 30 + phase, wz * 0.034, 3);
      const moist = fbm(wx * 0.018 - phase, wz * 0.02 + 12, 2);

      let r = 34 + n1 * 48 + moist * 12;
      let g = 58 + n1 * 62 + moist * 28;
      let b = 26 + n1 * 22 + n2 * 10;

      if (isTerrainWater(wx, wz, key)) {
        r = 28 + moist * 18;
        g = 72 + moist * 22;
        b = 108 + n1 * 20;
      } else if (th > 55) {
        r = 210 + n2 * 18;
        g = 218 + n2 * 14;
        b = 228 + n2 * 10;
      } else if (th > 38) {
        r = 62 + n2 * 28;
        g = 58 + n2 * 22;
        b = 44 + n2 * 16;
      } else if (n2 > 0.58) {
        r = 48 + n2 * 22;
        g = 72 + n2 * 28;
        b = 32 + n2 * 12;
      }

      const gridX = Math.abs((wx % 100) - 50) < 0.8;
      const gridZ = Math.abs((wz % 100) - 50) < 0.8;
      if (gridX || gridZ) {
        r = r * 0.88 + 48;
        g = g * 0.88 + 82;
        b = b * 0.88 + 96;
      }

      const dist = Math.hypot(wx - cx, wz - cz);
      if (dist > ARENA.radius * 0.9 && dist < ARENA.radius) {
        const t = (dist - ARENA.radius * 0.9) / (ARENA.radius * 0.1);
        r = 220 * t + r * (1 - t);
        g = 95 * t + g * (1 - t);
        b = 28 * t + b * (1 - t);
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
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  terrainMapCache.set(key, tex);
  return tex;
}

export function getCloudSpriteTexture() {
  if (cloudTexCache) return cloudTexCache;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cloudTexCache = tex;
  return tex;
}

export function disposeTerrainTextures() {
  terrainMapCache.forEach((t) => t.dispose());
  terrainMapCache.clear();
  cloudTexCache?.dispose();
  cloudTexCache = null;
}
