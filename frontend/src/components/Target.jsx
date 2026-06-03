import { drawEnemyDrone, drawPlayerFighter } from '../rendering/gameSprites';

export function drawTarget(ctx, target, isSelected, lockedByMissile = false, time = 0) {
  if (target.is_player) {
    drawPlayerFighter(ctx, target, isSelected, time);
  } else {
    drawEnemyDrone(ctx, target, lockedByMissile, time);
  }
}
