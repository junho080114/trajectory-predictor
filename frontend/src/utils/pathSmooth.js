/** 화면용 궤적 폴리라인 스무딩 (Chaikin + 베지어) */

export function chaikinSmooth(points, iterations = 2) {
  if (points.length < 3) return points.map((p) => ({ ...p }));
  let pts = points.map((p) => ({ x: p.x, y: p.y }));
  for (let n = 0; n < iterations; n++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      next.push(
        { x: p0.x * 0.75 + p1.x * 0.25, y: p0.y * 0.75 + p1.y * 0.25 },
        { x: p0.x * 0.25 + p1.x * 0.75, y: p0.y * 0.25 + p1.y * 0.75 }
      );
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

export function resamplePath(points, targetCount = 48) {
  if (points.length < 2) return points;
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    lengths.push(lengths[i - 1] + Math.hypot(dx, dy));
  }
  const total = lengths[lengths.length - 1];
  if (total < 1e-3) return points;
  const out = [];
  for (let k = 0; k < targetCount; k++) {
    const d = (k / (targetCount - 1)) * total;
    let j = 1;
    while (j < lengths.length && lengths[j] < d) j++;
    const t = (d - lengths[j - 1]) / Math.max(1e-6, lengths[j] - lengths[j - 1]);
    const a = points[j - 1];
    const b = points[Math.min(j, points.length - 1)];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

export function smoothPathForDisplay(points) {
  if (points.length < 2) return points;
  const sampled = resamplePath(points, Math.min(56, Math.max(24, points.length)));
  return chaikinSmooth(sampled, 1);
}

export function strokeSmoothPath(ctx, points) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    return;
  }
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  ctx.stroke();
}
