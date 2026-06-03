/** 시뮬 캔버스 크기별 정적 하늘·3D 지형 — 1회 빌드 후 drawImage */

const cache = new Map();
let cloudSprite = null;

function getCloudSprite() {
  if (cloudSprite) return cloudSprite;
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 64;
  const ctx = c.getContext('2d');
  const puff = (x, y, r) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    g.addColorStop(0.55, 'rgba(245, 250, 255, 0.7)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  puff(60, 32, 34);
  puff(32, 38, 26);
  puff(88, 36, 24);
  puff(48, 18, 20);
  cloudSprite = c;
  return c;
}

function drawMountains3D(ctx, width, height) {
  const baseY = height * 0.72;
  const layers = [
    { light: '#7a9a8a', mid: '#5a7a6a', dark: '#3d5548', alpha: 0.32, offset: 0, amp: 42 },
    { light: '#6a8a78', mid: '#4a6a58', dark: '#2d4038', alpha: 0.48, offset: 120, amp: 55 },
    { light: '#5a7a68', mid: '#3d5548', dark: '#1e3028', alpha: 0.62, offset: 60, amp: 38 },
  ];
  layers.forEach((layer) => {
    ctx.globalAlpha = layer.alpha;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width + 40; x += 24) {
      const ridge =
        baseY +
        Math.sin((x + layer.offset) * 0.008) * layer.amp +
        Math.sin((x + layer.offset) * 0.019) * (layer.amp * 0.45);
      ctx.lineTo(x, ridge);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, baseY - 60, 0, height);
    g.addColorStop(0, layer.light);
    g.addColorStop(0.35, layer.mid);
    g.addColorStop(1, layer.dark);
    ctx.fillStyle = g;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function buildStaticLayer(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#0e4a82');
  sky.addColorStop(0.22, '#2a7ab8');
  sky.addColorStop(0.5, '#5aa8d8');
  sky.addColorStop(0.78, '#a8d4f0');
  sky.addColorStop(1, '#e8f4fc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sunX = width * 0.78;
  const sunY = height * 0.12;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120);
  glow.addColorStop(0, 'rgba(255, 252, 220, 1)');
  glow.addColorStop(0.2, 'rgba(255, 235, 150, 0.5)');
  glow.addColorStop(0.5, 'rgba(255, 210, 100, 0.12)');
  glow.addColorStop(1, 'rgba(255, 200, 80, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff8d0';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
  ctx.fill();

  drawMountains3D(ctx, width, height);

  const ground = ctx.createLinearGradient(0, height * 0.68, 0, height);
  ground.addColorStop(0, 'rgba(90, 130, 90, 0)');
  ground.addColorStop(0.45, 'rgba(60, 95, 70, 0.3)');
  ground.addColorStop(1, 'rgba(40, 70, 50, 0.5)');
  ctx.fillStyle = ground;
  ctx.fillRect(0, height * 0.65, width, height * 0.35);

  return c;
}

const CLOUD_SEEDS = [
  { bx: 0.1, by: 0.1, s: 1.1, sp: 0.035 },
  { bx: 0.45, by: 0.07, s: 0.9, sp: 0.028 },
  { bx: 0.75, by: 0.12, s: 1.05, sp: 0.032 },
];

export function drawSkyBackground(ctx, width, height, time = 0) {
  const key = `${Math.round(width)}x${Math.round(height)}`;
  if (!cache.has(key)) {
    cache.set(key, buildStaticLayer(width, height));
  }
  ctx.drawImage(cache.get(key), 0, 0, width, height);

  const cloud = getCloudSprite();
  const cw = 120;
  const ch = 64;
  CLOUD_SEEDS.forEach((c, i) => {
    const drift = (time * 20 * c.sp + i * 60) % (width + cw);
    const cx = (c.bx * width + drift) % (width + cw) - cw * 0.5;
    const cy = c.by * height;
    const scale = c.s;
    ctx.drawImage(cloud, cx, cy, cw * scale, ch * scale);
  });

  ctx.fillStyle = 'rgba(40, 60, 80, 0.08)';
  ctx.fillRect(0, height * 0.85, width, height * 0.15);
}

export function clearSkyCache() {
  cache.clear();
  cloudSprite = null;
}
