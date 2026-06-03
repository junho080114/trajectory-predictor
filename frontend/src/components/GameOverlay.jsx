import { useSimulationStore } from '../store/simulationStore';
import { sendWsRestart } from '../services/api';

export default function GameOverlay({ wsRef, onStart }) {
  const connected = useSimulationStore((s) => s.connected);
  const gameStarted = useSimulationStore((s) => s.gameStarted);
  const game = useSimulationStore((s) => s.game);
  const hit = useSimulationStore((s) => s.hit);
  const hitTimer = useSimulationStore((s) => s.hitTimer);
  const setPanelOpen = useSimulationStore((s) => s.setPanelOpen);
  const panelOpen = useSimulationStore((s) => s.panelOpen);

  if (!gameStarted) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-gradient-to-b from-[#0a1628]/92 to-[#1a3a5c]/88 backdrop-blur-sm pointer-events-auto">
        <div className="max-w-md text-center px-8 py-10 rounded-xl border border-cyan-500/40 bg-black/55 shadow-2xl">
          <h1 className="text-3xl font-bold text-white tracking-wide mb-2">에어 컴뱃</h1>
          <p className="text-cyan-200/90 text-sm mb-6 leading-relaxed">
            적 드론을 격추하고 들어오는 미사일을 피하세요.
            <br />
            실시간 3D 전투 시뮬레이션
          </p>
          <div
            className={`text-xs font-mono mb-4 px-3 py-2 rounded ${
              connected ? 'bg-green-900/50 text-green-300' : 'bg-red-900/60 text-red-200 animate-pulse'
            }`}
          >
            {connected ? '● 서버 연결됨 — 전투 준비 완료' : '○ 서버 연결 대기… start.bat 실행 후 재시도'}
          </div>
          <button
            type="button"
            disabled={!connected}
            onClick={onStart}
            className="w-full py-3 rounded-lg font-bold text-lg bg-gradient-to-r from-orange-600 to-amber-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:from-orange-500 hover:to-amber-400 transition"
          >
            전투 시작
          </button>
          <p className="text-[10px] text-white/45 mt-4 font-mono leading-relaxed">
            W/S 가속 · A/D 뱅크 선회 · Space/Ctrl 피치
            <br />
            클릭+마우스 시야 · 좌클릭/F 사격 · V 시점 · 휠 줌
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-25 pointer-events-none select-none">
      <div className="absolute top-3 left-3 flex gap-3 font-mono text-sm drop-shadow-lg">
        <div className="bg-black/50 border border-white/20 px-3 py-2 rounded">
          <span className="text-white/60 text-[10px] block">HP</span>
          <div className="w-28 h-2 bg-gray-800 rounded mt-1 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-green-500 transition-all duration-200"
              style={{ width: `${(game.hp / game.hp_max) * 100}%` }}
            />
          </div>
          <span className="text-green-300 text-xs tabular-nums">
            {Math.round(game.hp)} / {Math.round(game.hp_max)}
          </span>
        </div>
        <div className="bg-black/50 border border-white/20 px-3 py-2 rounded text-yellow-300">
          <span className="text-white/60 text-[10px] block">SCORE</span>
          <span className="text-xl font-bold tabular-nums">{game.score}</span>
        </div>
        <div className="bg-black/50 border border-white/20 px-3 py-2 rounded text-cyan-300">
          <span className="text-white/60 text-[10px] block">WAVE</span>
          <span className="text-xl font-bold">{game.wave}</span>
          <span className="text-[10px] text-white/50 ml-1">K{game.kills}</span>
        </div>
      </div>

      {hit && hitTimer > 0 && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 text-red-500 font-black text-2xl tracking-widest animate-pulse drop-shadow-lg">
          ◆ MISSILE HIT
        </div>
      )}

      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          className="text-[10px] font-mono bg-black/45 text-white/70 border border-white/20 px-3 py-1 rounded hover:bg-black/60"
        >
          {panelOpen ? '설정 닫기' : '설정'}
        </button>
      </div>

      {!connected && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-red-900/80 text-white text-sm px-4 py-2 rounded animate-pulse pointer-events-auto">
          연결 끊김 — 백엔드 재시작 중…
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => sendWsRestart(wsRef?.current)}
          >
            재연결
          </button>
        </div>
      )}
    </div>
  );
}
