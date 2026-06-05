import * as THREE from 'three';

export function makeTex(canvas) {
  if (!canvas) return null;
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeSkyGradient() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0a1a3a');
  g.addColorStop(0.18, '#1a4a7a');
  g.addColorStop(0.42, '#3d7eb8');
  g.addColorStop(0.68, '#7eb8e0');
  g.addColorStop(0.88, '#c8e4f8');
  g.addColorStop(1, '#eef6fc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

export function makeSunSpriteTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,248,220,1)');
  g.addColorStop(0.25, 'rgba(255,230,160,0.85)');
  g.addColorStop(0.55, 'rgba(255,200,100,0.25)');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
