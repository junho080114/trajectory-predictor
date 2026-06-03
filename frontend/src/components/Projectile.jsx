import { drawHomingMissile } from '../rendering/gameSprites';

export function drawProjectile(ctx, projectile, time = 0) {
  drawHomingMissile(ctx, projectile, time);
}
