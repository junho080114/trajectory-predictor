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
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2d5f8f');
  g.addColorStop(0.45, '#6ca8d8');
  g.addColorStop(0.85, '#c5e2f5');
  g.addColorStop(1, '#e2f0fa');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}
