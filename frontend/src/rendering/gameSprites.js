/**
 * 렌더링: 사진 에셋 우선, 로드 전/실패 시 절차적 3D 폴백
 */
import { arePhotoAssetsReady } from './assetLoader';
import * as photo from './photoSprites';
import * as fallback from './fallbackSprites';

export { drawSkyBackground as drawBattleBackground } from './skyBackgroundCache';

function usePhoto() {
  return arePhotoAssetsReady();
}

export function drawPhotoSkyBackground(ctx, width, height) {
  if (usePhoto()) photo.drawPhotoBackground(ctx, width, height);
  else fallback.drawSkyBackground(ctx, width, height, 0);
}

export function drawLauncherTurret(ctx, x, y, angle) {
  if (usePhoto()) photo.drawLauncherTurret(ctx, x, y, angle);
  else fallback.drawLauncherTurret(ctx, x, y, angle);
}

export function drawPlayerFighter(ctx, target, isSelected, time) {
  if (usePhoto()) photo.drawPlayerFighter(ctx, target, isSelected, time);
  else fallback.drawPlayerFighter(ctx, target, isSelected, time);
}

export function drawEnemyDrone(ctx, target, underFire, time) {
  if (usePhoto()) photo.drawEnemyDrone(ctx, target, underFire, time);
  else fallback.drawEnemyDrone(ctx, target, underFire, time);
}

export function drawHomingMissile(ctx, projectile, time) {
  if (usePhoto()) photo.drawHomingMissile(ctx, projectile, time);
  else fallback.drawHomingMissile(ctx, projectile, time);
}

export function drawExplosion(ctx, x, y, intensity) {
  if (usePhoto()) photo.drawExplosion(ctx, x, y, intensity);
  else fallback.drawExplosion(ctx, x, y, intensity);
}
