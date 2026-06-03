/** 의사 3D 스프라이트 — 오프스크린 1회 생성 후 drawImage로 고속 렌더 */

const cache = {};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function cylGrad(ctx, x0, y0, x1, y1, light, mid, dark) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  return g;
}

export function getUnitShadow() {
  if (cache.shadow) return cache.shadow;
  const c = makeCanvas(48, 20);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(24, 10, 2, 24, 10, 22);
  g.addColorStop(0, 'rgba(20, 35, 50, 0.45)');
  g.addColorStop(0.6, 'rgba(20, 35, 50, 0.18)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(24, 10, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  cache.shadow = c;
  return c;
}

export function getFighterSprite() {
  if (cache.fighter) return cache.fighter;
  const w = 72;
  const h = 88;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const cx = w / 2;
  const cy = h / 2 + 4;

  ctx.translate(cx, cy);

  // 동체 (원통형 그라데이션)
  ctx.fillStyle = cylGrad(ctx, -8, 0, 8, 0, '#7eb8d8', '#3d6a88', '#1e3d52');
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.bezierCurveTo(10, -18, 11, 8, 8, 20);
  ctx.lineTo(-8, 20);
  ctx.bezierCurveTo(-11, 8, -10, -18, 0, -28);
  ctx.closePath();
  ctx.fill();

  // 날개 (원근 — 뒤쪽 넓게)
  ctx.fillStyle = cylGrad(ctx, -22, 0, 22, 0, '#5a8aa8', '#2d5068', '#152a38');
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(26, 14);
  ctx.lineTo(22, 20);
  ctx.lineTo(0, 10);
  ctx.lineTo(-22, 20);
  ctx.lineTo(-26, 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cylGrad(ctx, -14, 0, 14, 0, '#6a9ab8', '#355a72', '#1a3040');
  ctx.fillRect(-14, 6, 28, 5);

  // 캐노피 유리
  const canopy = ctx.createRadialGradient(-2, -10, 1, 0, -8, 10);
  canopy.addColorStop(0, 'rgba(200, 240, 255, 0.95)');
  canopy.addColorStop(0.5, 'rgba(80, 160, 220, 0.75)');
  canopy.addColorStop(1, 'rgba(30, 80, 120, 0.5)');
  ctx.fillStyle = canopy;
  ctx.beginPath();
  ctx.ellipse(0, -10, 7, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-3, -13, 3, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // 수직미익
  ctx.fillStyle = '#2a4558';
  ctx.fillRect(-3, 18, 6, 8);

  cache.fighter = c;
  return c;
}

export function getDroneSprite() {
  if (cache.drone) return cache.drone;
  const s = 64;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const cx = s / 2;
  const cy = s / 2;
  ctx.translate(cx, cy);

  // 바닥면 그림자(기체)
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3D 박스 본체 — 윗면 + 측면
  const top = cylGrad(ctx, -12, -8, 12, -8, '#6a7078', '#4a5058', '#353a42');
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(-12, -6);
  ctx.lineTo(12, -6);
  ctx.lineTo(10, 2);
  ctx.lineTo(-10, 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cylGrad(ctx, 8, 0, 14, 0, '#3d4248', '#2a2e34', '#1a1c20');
  ctx.beginPath();
  ctx.moveTo(10, 2);
  ctx.lineTo(14, 4);
  ctx.lineTo(14, 10);
  ctx.lineTo(10, 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cylGrad(ctx, -14, 0, -8, 0, '#2e3338', '#22262a', '#141618');
  ctx.beginPath();
  ctx.moveTo(-10, 2);
  ctx.lineTo(-10, 8);
  ctx.lineTo(-14, 10);
  ctx.lineTo(-14, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#25282c';
  ctx.fillRect(-10, 2, 20, 6);

  // 카메라 돔
  const dome = ctx.createRadialGradient(0, -2, 0, 0, -2, 6);
  dome.addColorStop(0, 'rgba(120, 200, 255, 0.9)');
  dome.addColorStop(1, 'rgba(20, 60, 90, 0.8)');
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.arc(0, -2, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#c03030';
  ctx.fillRect(-2, 5, 4, 2);

  // 암 (정적 — 회전은 런타임에 얇은 선만)
  const arms = [
    [18, -18],
    [-18, -18],
    [-18, 18],
    [18, 18],
  ];
  ctx.strokeStyle = '#2a2e34';
  ctx.lineWidth = 3;
  arms.forEach(([ax, ay]) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.fillStyle = '#1a1c20';
    ctx.beginPath();
    ctx.arc(ax, ay, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  cache.drone = c;
  return c;
}

export function getDroneRotorBlur() {
  if (cache.rotorBlur) return cache.rotorBlur;
  const c = makeCanvas(24, 24);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(80, 90, 100, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(12, 12, 10, 3, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(12, 12, 10, 3, Math.PI / 2, 0, Math.PI * 2);
  ctx.stroke();
  cache.rotorBlur = c;
  return c;
}

export function getMissileSprite(homing) {
  const key = homing ? 'missileH' : 'missile';
  if (cache[key]) return cache[key];
  const w = 56;
  const h = 24;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.translate(8, h / 2);

  const body = homing
    ? cylGrad(ctx, 0, -6, 0, 6, '#b8c0c8', '#6a727a', '#3a4048')
    : cylGrad(ctx, 0, -5, 0, 5, '#9aa0a8', '#5a6068', '#32383e');

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(0, -5);
  ctx.lineTo(0, 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = homing
    ? cylGrad(ctx, 28, -3, 38, 3, '#f0f2f4', '#c8d0d8', '#889098')
    : '#a8aeb6';
  ctx.beginPath();
  ctx.moveTo(38, 0);
  ctx.lineTo(28, -3);
  ctx.lineTo(28, 3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = homing ? '#c02818' : '#505860';
  ctx.beginPath();
  ctx.moveTo(42, 0);
  ctx.lineTo(34, -2);
  ctx.lineTo(34, 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#404850';
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(6, -8);
  ctx.lineTo(10, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(6, 8);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();

  if (homing) {
    ctx.strokeStyle = 'rgba(220, 80, 40, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, -9);
    ctx.lineTo(40, 0);
    ctx.lineTo(8, 9);
    ctx.stroke();
  }

  cache[key] = c;
  return c;
}

export function getTurretSprite() {
  if (cache.turret) return cache.turret;
  const s = 96;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.translate(s / 2, s / 2 + 8);

  ctx.fillStyle = cylGrad(ctx, -20, 0, 20, 0, '#5a6a58', '#3a4a38', '#222a20');
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = cylGrad(ctx, 0, -8, 0, 8, '#6a7a68', '#4a5a48', '#2a3228');
  ctx.fillRect(-6, -6, 44, 12);
  ctx.fillStyle = cylGrad(ctx, 20, -10, 40, 10, '#8a9a88', '#5a6a58', '#3a4238');
  ctx.fillRect(12, -8, 32, 16);

  ctx.fillStyle = '#c44a28';
  ctx.beginPath();
  ctx.arc(46, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  cache.turret = c;
  return c;
}

export function getExplosionSprite() {
  if (cache.explosion) return cache.explosion;
  const s = 96;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const cx = s / 2;
  const cy = s / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 44);
  g.addColorStop(0, 'rgba(255, 255, 220, 1)');
  g.addColorStop(0.25, 'rgba(255, 180, 60, 0.9)');
  g.addColorStop(0.55, 'rgba(255, 80, 20, 0.55)');
  g.addColorStop(1, 'rgba(80, 30, 0, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, 44, 0, Math.PI * 2);
  ctx.fill();
  cache.explosion = c;
  return c;
}

export function clearSpriteCache() {
  Object.keys(cache).forEach((k) => delete cache[k]);
}
