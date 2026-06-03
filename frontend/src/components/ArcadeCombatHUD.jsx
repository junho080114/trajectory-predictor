import { useSimulationStore } from '../store/simulationStore';
import { findPrimaryThreat, bearingToScreenOffset } from '../utils/wtCombat';

function EnemyMarker({ player, drone, aimHeading, aimPitch, fov }) {
  if (!player?.position || !drone?.position) return null;
  const px = player.position.x;
  const pz = player.position.y;
  const dx = drone.position.x - px;
  const dz = drone.position.y - pz;
  const dist = Math.hypot(dx, dz);
  if (dist > 520) return null;
  const bearing = Math.atan2(dx, dz);
  const off = bearingToScreenOffset(aimHeading, bearing, aimPitch, fov);
  const nx = Math.max(-44, Math.min(44, (off.x / window.innerWidth) * 100));
  const ny = Math.max(-38, Math.min(38, (off.y / window.innerHeight) * 100));
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `calc(50% + ${nx}vw)`, top: `calc(50% + ${ny}vh)` }}
    >
      <div className="w-3 h-3 rounded-full border-2 border-orange-400 bg-orange-500/40" />
      <div className="absolute left-4 -top-1 text-[9px] font-mono text-orange-200 whitespace-nowrap drop-shadow">
        DRN {Math.round(dist)}m
      </div>
    </div>
  );
}

/** War Thunder 아케이드: 리드 마커·적 표시·속도/고도 */
export default function ArcadeCombatHUD() {
  const player = useSimulationStore((s) => s.targets.find((t) => t.is_player));
  const targets = useSimulationStore((s) => s.targets);
  const projectiles = useSimulationStore((s) => s.projectiles);
  const viewYaw = useSimulationStore((s) => s.viewYaw);
  const viewPitch = useSimulationStore((s) => s.viewPitch);
  const cameraMode = useSimulationStore((s) => s.cameraMode);
  const config = useSimulationStore((s) => s.config);

  const gameStarted = useSimulationStore((s) => s.gameStarted);
  if (!gameStarted || !player || !config.player_control) return null;

  const threat = findPrimaryThreat(player, targets, projectiles);
  const aimHeading = (player.heading ?? 0) + viewYaw;
  const aimPitch = (player.pitch ?? 0) + viewPitch;
  const fov = cameraMode === 'cockpit' ? 88 : 62;
  const drones = targets.filter((t) => t.is_drone);
  const spd = player.speed_kmh ?? 0;
  const alt = player.altitude ?? 4500;
  const throttle = (player.throttle ?? 0.5) * 100;
  const lowAlt = alt < 4120;
  const showReticle = cameraMode !== 'cockpit';

  let leadStyle = null;
  if (threat?.lead && player.position) {
    const lx = threat.lead.x - player.position.x;
    const lz = threat.lead.z - player.position.y;
    const off = bearingToScreenOffset(aimHeading, Math.atan2(lx, lz), aimPitch, fov);
    leadStyle = {
      left: `calc(50% + ${Math.max(-42, Math.min(42, (off.x / window.innerWidth) * 100))}vw)`,
      top: `calc(50% + ${Math.max(-35, Math.min(35, (off.y / window.innerHeight) * 100))}vh)`,
    };
  }

  return (
    <div className="absolute inset-0 z-15 pointer-events-none select-none">
      {showReticle && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-14 h-14 border border-white/45 rounded-sm" />
          <div className="absolute left-1/2 top-1/2 w-2 h-2 bg-green-400/85 rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute left-1/2 top-0 w-px h-4 bg-white/65 -translate-x-1/2 -translate-y-full" />
          <div className="absolute left-1/2 bottom-0 w-px h-4 bg-white/65 -translate-x-1/2 translate-y-full" />
          <div className="absolute top-1/2 left-0 w-4 h-px bg-white/65 -translate-y-1/2 -translate-x-full" />
          <div className="absolute top-1/2 right-0 w-4 h-px bg-white/65 -translate-y-1/2 translate-x-full" />
        </div>
      )}

      {drones.map((d) => (
        <EnemyMarker
          key={d.id}
          player={player}
          drone={d}
          aimHeading={aimHeading}
          aimPitch={aimPitch}
          fov={fov}
        />
      ))}

      {leadStyle && threat && threat.dist < 450 && (
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={leadStyle}>
          <div
            className={`w-5 h-5 rotate-45 border-2 ${
              threat.kind === 'missile'
                ? 'border-red-400 bg-red-500/35 shadow-[0_0_12px_rgba(248,113,113,0.6)]'
                : 'border-yellow-300 bg-yellow-400/30'
            }`}
          />
          <div className="absolute left-6 top-0 text-[10px] font-mono text-white/90 whitespace-nowrap drop-shadow-md">
            {threat.kind === 'missile' ? 'MSL' : 'TGT'} {Math.round(threat.dist)}m
          </div>
        </div>
      )}

      {lowAlt && (
        <div className="absolute top-[28%] left-1/2 -translate-x-1/2 text-red-500 font-bold text-sm animate-pulse tracking-[0.2em] drop-shadow-lg">
          ▼ PULL UP
        </div>
      )}

      {cameraMode === 'chase' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-end gap-6 font-mono text-white/90 text-xs drop-shadow-md">
          <div className="text-center">
            <div className="text-[9px] text-white/55">IAS</div>
            <div className="text-xl font-bold tabular-nums text-yellow-200">{Math.round(spd)}</div>
            <div className="text-[9px] text-white/50">km/h</div>
          </div>
          <div className="w-2 h-24 bg-black/45 border border-white/25 relative">
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-orange-600 to-amber-300"
              style={{ height: `${Math.min(100, throttle)}%` }}
            />
            <span className="absolute -left-5 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] text-white/50">
              THR
            </span>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-white/55">ALT</div>
            <div className="text-xl font-bold tabular-nums text-cyan-200">{Math.round(alt)}</div>
            <div className="text-[9px] text-white/50">m MSL</div>
          </div>
        </div>
      )}

      <div className="absolute top-3 right-4 text-[10px] font-mono text-white/55 tracking-wider">
        ARCADE
      </div>
    </div>
  );
}
