/** 사진 로드 실패 시 절차적 3D 폴백 */
export { drawSkyBackground } from './skyBackgroundCache';
import {
  getUnitShadow,
  getFighterSprite,
  getDroneSprite,
  getDroneRotorBlur,
  getMissileSprite,
  getTurretSprite,
  getExplosionSprite,
} from './sprite3dCache';

function velocityAngle(vx, vy) {
  if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return -Math.PI / 2;
  return Math.atan2(vy, vx);
}

function drawShadow(ctx, x, y) {
  const sh = getUnitShadow();
  ctx.drawImage(sh, x - 24, y + 6, 48, 20);
}

export function drawLauncherTurret(ctx, x, y, angleToTarget) {
  drawShadow(ctx, x, y);
  const spr = getTurretSprite();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleToTarget);
  ctx.drawImage(spr, -48, -52, 96, 96);
  ctx.restore();
}

export function drawPlayerFighter(ctx, target, isSelected, time = 0) {
  const { position, velocity, trail, is_player: isPlayer } = target;
  const x = position.x;
  const y = position.y;
  const angle = velocityAngle(velocity?.x ?? 0, velocity?.y ?? 0);
  const speed = Math.hypot(velocity?.x ?? 0, velocity?.y ?? 0);
  if (trail?.length > 3) {
    const tail = trail.slice(-8);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tail[0].x, tail[0].y);
    for (let i = 1; i < tail.length; i++) ctx.lineTo(tail[i].x, tail[i].y);
    ctx.stroke();
  }
  drawShadow(ctx, x, y);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.drawImage(getFighterSprite(), -36, -44, 72, 88);
  const flame = 8 + Math.min(18, speed * 0.06);
  const fg = ctx.createLinearGradient(0, 36, 0, 36 + flame);
  fg.addColorStop(0, 'rgba(255,200,100,0.85)');
  fg.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-4, 36);
  ctx.lineTo(0, 36 + flame);
  ctx.lineTo(4, 36);
  ctx.fill();
  ctx.restore();
  if (isPlayer) {
    ctx.fillStyle = '#1a3a52';
    ctx.font = 'bold 11px system-ui,sans-serif';
    ctx.fillText('FIGHTER', x - 28, y - 38);
  }
}

export function drawEnemyDrone(ctx, target, underFire = false, time = 0) {
  const { position, velocity, trail } = target;
  const x = position.x;
  const y = position.y;
  const angle = velocityAngle(velocity?.x ?? 0, velocity?.y ?? 0);
  drawShadow(ctx, x, y);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(getDroneSprite(), -32, -32, 64, 64);
  const rotor = getDroneRotorBlur();
  const spin = time * 16;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ctx.save();
    ctx.translate(Math.cos(a) * 18, Math.sin(a) * 18);
    ctx.rotate(spin + i);
    ctx.drawImage(rotor, -12, -12, 24, 24);
    ctx.restore();
  }
  ctx.restore();
}

export function drawHomingMissile(ctx, projectile, time = 0) {
  const { position, velocity, trail, homing } = projectile;
  const x = position.x;
  const y = position.y;
  const angle = velocityAngle(velocity?.x ?? 0, velocity?.y ?? 0);
  drawShadow(ctx, x, y);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(getMissileSprite(!!homing), -8, -12, 56, 24);
  ctx.restore();
}

export function drawExplosion(ctx, x, y, intensity) {
  const alpha = Math.min(1, intensity);
  const s = 96 * (0.5 + alpha * 0.9);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(getExplosionSprite(), x - s / 2, y - s / 2, s, s);
  ctx.restore();
}
