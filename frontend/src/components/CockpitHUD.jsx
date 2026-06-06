import { useSimulationStore } from '../store/simulationStore';
import { distanceToArenaBoundary, ARENA } from '../rendering/worldBounds';

/** 1인칭 Split Control 스타일 조종석 HUD */
export default function CockpitHUD() {
  const cameraMode = useSimulationStore((s) => s.cameraMode);
  const player = useSimulationStore((s) => s.targets.find((t) => t.is_player));
  const projectiles = useSimulationStore((s) => s.projectiles);
  const debug = useSimulationStore((s) => s.debug);
  const config = useSimulationStore((s) => s.config);
  const canvas = useSimulationStore((s) => s.canvas);

  if (cameraMode !== 'cockpit') return null;

  const edgeDist =
    player?.position != null
      ? distanceToArenaBoundary(
          player.position.x,
          player.position.y,
          player.altitude ?? ARENA.alt
        )
      : 999;

  const spd = player?.speed_kmh ?? debug.speed_kmh ?? 0;
  const alt = player?.altitude ?? debug.altitude ?? 4500;
  const heading = ((player?.heading ?? 0) * (180 / Math.PI) + 360) % 360;
  const pitch = (player?.pitch ?? 0) * (180 / Math.PI);
  const throttle = (player?.throttle ?? 0) * 100;
  const roll = Math.max(-28, Math.min(28, (player?.bank ?? 0) * (180 / Math.PI)));

  let missileWarn = false;
  let missileDir = 0;
  if (player && projectiles?.length) {
    const px = player.position?.x ?? 0;
    const pz = player.position?.y ?? 0;
    let nearest = 9999;
    for (const m of projectiles) {
      const d = Math.hypot((m.position?.x ?? 0) - px, (m.position?.y ?? 0) - pz);
      if (d < nearest) {
        nearest = d;
        missileDir = Math.atan2((m.position?.x ?? 0) - px, (m.position?.y ?? 0) - pz);
      }
    }
    missileWarn = nearest < 200;
  }

  const horizonPitch = pitch * 2.2;
  const missileDeg = ((missileDir - (player?.heading ?? 0)) * (180 / Math.PI) + 360) % 360;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden select-none">
      {/* 캐노피 프레임 */}
      <div className="absolute inset-0 border-[14px] border-black/75 rounded-[3%] shadow-[inset_0_0_80px_rgba(0,0,0,0.5)]" />
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/85 to-transparent" />
      <div className="absolute top-12 left-0 w-24 h-[calc(100%-6rem)] bg-gradient-to-r from-black/70 to-transparent" />
      <div className="absolute top-12 right-0 w-24 h-[calc(100%-6rem)] bg-gradient-to-l from-black/70 to-transparent" />

      {/* 상단 브랜딩 */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] text-green-400/80 font-mono tracking-widest">
        미사일 궤적 예측 피하기
      </div>

      {/* 인공 수평선 */}
      <div
        className="absolute left-1/2 top-1/2 w-[120%] h-px bg-green-400/90 -translate-x-1/2 transition-transform duration-150 ease-out"
        style={{
          transform: `translate(-50%, calc(-50% + ${horizonPitch}px)) rotate(${roll}deg)`,
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-green-500/30 rounded-full"
        style={{ transform: `translate(-50%, calc(-50% + ${horizonPitch}px)) rotate(${roll}deg)` }}
      />
      {/* 피치 래더 */}
      {[-20, -10, 10, 20].map((deg) => (
        <div
          key={deg}
          className="absolute left-1/2 text-[9px] text-green-400/70 font-mono -translate-x-1/2"
          style={{ top: `calc(50% + ${horizonPitch + deg * 2.5}px)` }}
        >
          <span className="inline-block w-12 text-right mr-2">{deg > 0 ? '+' : ''}{deg}</span>
          <span className="inline-block w-16 h-px bg-green-500/50 align-middle" />
          <span className="inline-block w-12 text-left ml-2">{deg > 0 ? '+' : ''}{deg}</span>
        </div>
      ))}

      {/* 조준선 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 border border-green-400/80 rounded-sm" />
      <div className="absolute left-1/2 top-1/2 w-px h-6 bg-green-400 -translate-x-1/2 -translate-y-8" />
      <div className="absolute left-1/2 top-1/2 w-px h-6 bg-green-400 -translate-x-1/2 translate-y-2" />
      <div className="absolute left-1/2 top-1/2 h-px w-6 bg-green-400 -translate-y-1/2 -translate-x-8" />
      <div className="absolute left-1/2 top-1/2 h-px w-6 bg-green-400 -translate-y-1/2 translate-x-2" />

      {/* 속도 테이프 (좌) */}
      <div className="absolute left-8 top-1/2 -translate-y-1/2 font-mono text-green-400 text-right w-20">
        <div className="text-[9px] opacity-60 mb-1">IAS km/h</div>
        <div className="text-2xl font-bold tabular-nums">{Math.round(spd)}</div>
        <div className="text-xs opacity-70 mt-2">MAX {config.target_speed}</div>
      </div>

      {/* 고도 테이프 (우) */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 font-mono text-green-400 w-20">
        <div className="text-[9px] opacity-60 mb-1">ALT m</div>
        <div className="text-2xl font-bold tabular-nums">{Math.round(alt)}</div>
        <div className="text-xs opacity-70 mt-2">MSL</div>
      </div>

      {/* 하단 나침반 */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-72">
        <div className="flex justify-between text-[10px] text-green-400/80 font-mono px-4">
          <span>270</span>
          <span>000</span>
          <span>090</span>
          <span>180</span>
        </div>
        <div className="relative h-8 mt-1 border border-green-600/50 bg-black/40">
          <div
            className="absolute top-0 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-green-400"
            style={{ left: `${(heading / 360) * 100}%`, transform: 'translateX(-50%)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-green-300 tabular-nums">
            {Math.round(heading).toString().padStart(3, '0')}°
          </div>
        </div>
      </div>

      {/* 스로틀 */}
      <div className="absolute bottom-24 left-10 w-3 h-32 bg-black/50 border border-green-700/60">
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-orange-600 to-yellow-400/90"
          style={{ height: `${throttle}%` }}
        />
        <span className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] text-green-500 font-mono">
          THR
        </span>
      </div>

      {/* 구역 경계 */}
      {edgeDist < 140 && (
        <div
          className={`absolute top-16 right-10 font-mono text-sm border px-3 py-2 ${
            edgeDist < 70
              ? 'text-red-300 border-red-500/80 bg-red-950/70 animate-pulse'
              : 'text-amber-200 border-amber-500/60 bg-black/50'
          }`}
        >
          경계 {Math.max(0, Math.round(edgeDist))} m
        </div>
      )}

      {/* 미사일 경고 */}
      {missileWarn && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 animate-pulse">
          <div className="bg-red-600/90 text-white font-bold px-4 py-2 text-sm tracking-wider border border-red-300">
            MISSILE — {Math.round(missileDeg)}°
          </div>
        </div>
      )}

      {/* 하단 조작 힌트 */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] text-green-500/50 font-mono">
        W/S 스로틀 · Space/Ctrl 상하 · Shift WEP · A/D 선회 · 마우스 시야 · V 시점
      </div>
    </div>
  );
}
