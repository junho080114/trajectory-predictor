import { smoothPathForDisplay } from '../utils/pathSmooth';

let cachedPath = null;

function getDisplayPath(points) {
  if (points.length < 2) return points;
  const key = `${points.length}-${points[0]?.x?.toFixed(0)}`;
  if (!cachedPath || cachedPath.key !== key) {
    cachedPath = { key, pts: smoothPathForDisplay(points) };
  }
  return cachedPath.pts;
}

function strokePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

export function drawPrediction(ctx, prediction, projectileTrajectory, playerPos) {
  const trajectory = prediction?.trajectory ?? [];
  if (trajectory.length === 0 && !playerPos) return;

  const path = [];
  if (playerPos) path.push({ x: playerPos.x, y: playerPos.y });
  trajectory.forEach((p) => path.push({ x: p.x, y: p.y }));

  if (path.length > 1) {
    const display = getDisplayPath(path);
    const grad = ctx.createLinearGradient(
      display[0].x,
      display[0].y,
      display[display.length - 1].x,
      display[display.length - 1].y
    );
    grad.addColorStop(0, 'rgba(255, 248, 130, 0.75)');
    grad.addColorStop(1, 'rgba(255, 150, 50, 0.25)');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    strokePath(ctx, display);
  }

  const future = prediction?.future;
  if (future?.x != null) {
    ctx.fillStyle = 'rgba(70, 160, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(future.x, future.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (projectileTrajectory?.length > 1) {
    const miss = projectileTrajectory.map((p) => ({ x: p.x, y: p.y }));
    ctx.strokeStyle = 'rgba(255, 100, 70, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    strokePath(ctx, getDisplayPath(miss));
    ctx.setLineDash([]);
  }
}
