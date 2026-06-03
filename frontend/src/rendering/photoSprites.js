/**
 * 사진 기반 스프라이트 렌더링 (캐시 drawImage, 회전, 그림자)
 */
import {
  arePhotoAssetsReady,
  getPhotoAsset,
  getBackgroundForSize,
} from './assetLoader';

function velocityAngle(vx, vy) {
  if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) return -Math.PI / 2;
  return Math.atan2(vy, vx);
}

function drawShadow(ctx, x, y) {
  ctx.fillStyle = 'rgba(15, 25, 40, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 22, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRotatedSprite(ctx, sprite, x, y, angle, w, h) {
  if (!sprite) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawTrail(ctx, trail, color, maxPts = 8) {
  if (!trail || trail.length < 3) return;
  const tail = trail.slice(-maxPts);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tail[0].x, tail[0].y);
  for (let i = 1; i < tail.length; i++) ctx.lineTo(tail[i].x, tail[i].y);
  ctx.stroke();
}

export function drawPhotoBackground(ctx, width, height) {
  if (!arePhotoAssetsReady()) {
    ctx.fillStyle = '#5aa8d8';
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const bg = getBackgroundForSize(width, height);
  if (bg) ctx.drawImage(bg, 0, 0, width, height);
  else {
    const sky = getPhotoAsset('sky');
    if (sky) {
      const sw = sky.width || sky.naturalWidth;
      const sh = sky.height || sky.naturalHeight;
      const scale = Math.max(width / sw, height / sh);
      ctx.drawImage(sky, (width - sw * scale) / 2, (height - sh * scale) / 2, sw * scale, sh * scale);
    }
  }
}

export function drawLauncherTurret(ctx, x, y, angleToTarget) {
  if (!arePhotoAssetsReady()) return;
  const spr = getPhotoAsset('turret');
  drawShadow(ctx, x, y);
  drawRotatedSprite(ctx, spr, x, y, angleToTarget, 72, 72);
}

export function drawPlayerFighter(ctx, target, isSelected, time = 0) {
  if (!arePhotoAssetsReady()) return;
  const { position, velocity, trail, is_player: isPlayer } = target;
  const x = position.x;
  const y = position.y;
  const angle = velocityAngle(velocity?.x ?? 0, velocity?.y ?? 0) + Math.PI / 2;
  const speed = Math.hypot(velocity?.x ?? 0, velocity?.y ?? 0);

  drawTrail(ctx, trail, 'rgba(255, 255, 255, 0.25)', 8);
  drawShadow(ctx, x, y);

  if (isSelected) {
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 36, 0, Math.PI * 2);
    ctx.stroke();
  }

  const spr = getPhotoAsset('fighter');
  drawRotatedSprite(ctx, spr, x, y, angle, 64, 64);

  if (speed > 30) {
    const flame = 6 + Math.min(14, speed * 0.04);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const fg = ctx.createLinearGradient(0, 28, 0, 28 + flame);
    fg.addColorStop(0, 'rgba(255, 200, 100, 0.8)');
    fg.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-3, 30);
    ctx.lineTo(0, 30 + flame + Math.sin(time * 12) * 2);
    ctx.lineTo(3, 30);
    ctx.fill();
    ctx.restore();
  }

  if (isPlayer) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.strokeText('FIGHTER', x - 28, y - 40);
    ctx.fillText('FIGHTER', x - 28, y - 40);
  }
}

export function drawEnemyDrone(ctx, target, underFire = false, time = 0) {
  if (!arePhotoAssetsReady()) return;
  const { position, velocity, trail } = target;
  const x = position.x;
  const y = position.y;
  const angle = velocityAngle(velocity?.x ?? 0, velocity?.y ?? 0);

  drawTrail(ctx, trail, 'rgba(40, 45, 55, 0.2)', 6);
  drawShadow(ctx, x, y);

  if (underFire) {
    ctx.strokeStyle = 'rgba(255, 80, 50, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const spr = getPhotoAsset('drone');
  const wobble = Math.sin(time * 18) * 0.04;
  drawRotatedSprite(ctx, spr, x, y, angle + wobble, 52, 52);
}

export function drawHomingMissile(ctx, projectile, time = 0) {
  if (!arePhotoAssetsReady()) return;
  const { position, velocity, trail, homing } = projectile;
  const x = position.x;
  const y = position.y;
  const angle = velocityAngle(velocity?.x ?? 0, velocity?.y ?? 0);

  drawTrail(ctx, trail, homing ? 'rgba(255, 120, 50, 0.3)' : 'rgba(180, 180, 190, 0.25)', 6);
  drawShadow(ctx, x, y - 2);

  const spr = getPhotoAsset('missile');
  drawRotatedSprite(ctx, spr, x, y, angle, homing ? 48 : 44, homing ? 16 : 14);

  if (homing) {
    const speed = Math.hypot(velocity?.x ?? 0, velocity?.y ?? 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(255, 140, 60, ${0.35 + Math.min(0.4, speed * 0.001)})`;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-32 - Math.sin(time * 20) * 4, -4);
    ctx.lineTo(-32, 4);
    ctx.fill();
    ctx.restore();
  }
}

export function drawExplosion(ctx, x, y, intensity) {
  if (!arePhotoAssetsReady()) return;
  const spr = getPhotoAsset('explosion');
  const alpha = Math.min(1, intensity);
  const scale = 0.4 + alpha * 0.9;
  const s = 90 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, x - s / 2, y - s / 2, s, s);
  ctx.restore();
}
