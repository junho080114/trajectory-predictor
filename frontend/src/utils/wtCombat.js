/** War Thunder 스타일 전투 HUD 계산 */

const MSL_SPEED_MPS = 130;

export function computeLeadPoint(px, pz, pAlt, tx, tz, tAlt, tvx, tvz, muzzleMps = MSL_SPEED_MPS) {
  const dx = tx - px;
  const dz = tz - pz;
  const horiz = Math.hypot(dx, dz);
  if (horiz < 8) return { x: tx, z: tz, alt: tAlt, tHit: 0 };
  const tHit = horiz / Math.max(80, muzzleMps);
  return {
    x: tx + tvx * tHit,
    z: tz + tvz * tHit,
    alt: tAlt,
    tHit,
  };
}

export function bearingToScreenOffset(playerHeading, bearingRad, pitchRad, fovDeg = 70) {
  let d = bearingRad - playerHeading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const hFov = (fovDeg * Math.PI) / 180;
  const x = (d / hFov) * window.innerWidth * 0.48;
  const y = -pitchRad * window.innerHeight * 0.38;
  return { x, y };
}

export function findPrimaryThreat(player, targets, projectiles) {
  if (!player?.position) return null;
  const px = player.position.x;
  const pz = player.position.y;
  const pAlt = player.altitude ?? 4500;
  let best = null;
  let bestScore = -1;

  for (const m of projectiles ?? []) {
    if (!m.homing) continue;
    const dx = (m.position?.x ?? 0) - px;
    const dz = (m.position?.y ?? 0) - pz;
    const d = Math.hypot(dx, dz);
    const score = 1000 - d;
    if (score > bestScore) {
      bestScore = score;
      best = {
        kind: 'missile',
        id: m.id,
        dist: d,
        hp: m.hp ?? m.hp_max ?? 3,
        hpMax: m.hp_max ?? 3,
        bearing: Math.atan2(dx, dz),
        alt: m.altitude ?? pAlt,
        vx: m.velocity?.x ?? 0,
        vz: m.velocity?.y ?? 0,
        lead: computeLeadPoint(
          px,
          pz,
          pAlt,
          m.position?.x ?? 0,
          m.position?.y ?? 0,
          m.altitude ?? pAlt,
          m.velocity?.x ?? 0,
          m.velocity?.y ?? 0
        ),
      };
    }
  }

  for (const t of targets ?? []) {
    if (t.is_player || !t.is_drone) continue;
    const dx = (t.position?.x ?? 0) - px;
    const dz = (t.position?.y ?? 0) - pz;
    const d = Math.hypot(dx, dz);
    const score = 800 - d;
    if (score > bestScore) {
      bestScore = score;
      best = {
        kind: 'drone',
        id: t.id,
        dist: d,
        bearing: Math.atan2(dx, dz),
        alt: t.altitude ?? pAlt,
        vx: t.velocity?.x ?? 0,
        vz: t.velocity?.y ?? 0,
        lead: computeLeadPoint(
          px,
          pz,
          pAlt,
          t.position?.x ?? 0,
          t.position?.y ?? 0,
          t.altitude ?? pAlt,
          t.velocity?.x ?? 0,
          t.velocity?.y ?? 0
        ),
      };
    }
  }
  return best;
}
