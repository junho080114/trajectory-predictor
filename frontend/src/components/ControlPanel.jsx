import { sendWsGameMode } from '../services/api';
import { useSimulationStore, CAMERA_MODES } from '../store/simulationStore';
import { cameraModeLabel } from '../rendering/flightCamera';

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-300">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="text-yellow-400">{typeof value === 'number' ? value.toFixed(1) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-yellow-400"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between text-xs text-gray-300 cursor-pointer">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-yellow-400 w-4 h-4"
      />
    </label>
  );
}

export default function ControlPanel({
  config,
  pushConfig,
  launch,
  restart,
  togglePause,
  selectTarget,
  connected,
  targets,
  selectedTargetId,
  wsRef,
}) {
  const setGameMode = (partial) => {
    const next = { ...config, ...partial };
    useSimulationStore.setState({ config: next });
    sendWsGameMode(wsRef?.current, next);
  };

  const cameraMode = useSimulationStore((s) => s.cameraMode);
  const cameraDistance = useSimulationStore((s) => s.cameraDistance);
  const setCameraMode = useSimulationStore((s) => s.setCameraMode);

  return (
    <div className="fixed right-2 top-2 max-h-[calc(100vh-1rem)] w-[min(18rem,calc(100vw-1rem))] overflow-y-auto overflow-x-hidden bg-gray-900/95 border border-gray-700 rounded-lg p-3 flex flex-col gap-3 backdrop-blur-sm z-30 pointer-events-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-yellow-400">에어 컴뱃 설정</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            connected ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
          }`}
        >
          {connected ? '연결됨' : '연결 끊김'}
        </span>
      </div>

      <div className="border-t border-gray-700 pt-2 flex flex-col gap-2">
        <Toggle
          label="플레이어 조작 (게임 모드)"
          checked={config.player_control}
          onChange={(v) => setGameMode({ player_control: v })}
        />
        <Toggle
          label="AI 드론 추가"
          checked={config.ai_targets}
          onChange={(v) => setGameMode({ ai_targets: v })}
        />
      </div>

      {!config.player_control && (
        <div className="border-t border-gray-700 pt-2">
          <p className="text-xs text-gray-400 mb-2">목표 선택</p>
          <div className="flex flex-wrap gap-1">
            {targets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTarget(t.id)}
                className={`text-xs px-2 py-1 rounded ${
                  t.id === selectedTargetId
                    ? 'bg-yellow-600 text-black'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {t.id}
              </button>
            ))}
          </div>
        </div>
      )}

      {config.player_control && (
        <div className="text-xs text-cyan-300/90 bg-cyan-950/40 border border-cyan-800/50 rounded p-2 leading-relaxed">
          <p className="font-bold text-cyan-200 mb-1">전투 조작</p>
          <p>W/S 스로틀 · A/D 선회 · Space/Ctrl 고도</p>
          <p>클릭+마우스 조준 · 좌클릭/F 기관포</p>
          <p>적 미사일 회피 · 드론 격추로 점수</p>
          <p>V 시점 · 휠 줌</p>
        </div>
      )}

      {config.player_control && (
        <div className="border-t border-gray-700 pt-2 flex flex-col gap-2">
          <p className="text-xs text-gray-400">시점 (비행 시뮬)</p>
          <p className="text-xs text-cyan-300">{cameraModeLabel(cameraMode)}</p>
          <div className="flex flex-wrap gap-1">
            {CAMERA_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setCameraMode(m)}
                className={`text-[10px] px-2 py-1 rounded ${
                  cameraMode === m
                    ? 'bg-cyan-700 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {m === 'chase' ? '추적' : m === 'cockpit' ? '1인칭' : '궤도'}
              </button>
            ))}
          </div>
          {cameraMode !== 'cockpit' && (
            <Slider
              label="카메라 거리"
              value={cameraDistance}
              min={80}
              max={480}
              step={10}
              onChange={(v) => useSimulationStore.setState({ cameraDistance: v })}
            />
          )}
        </div>
      )}

      <Slider
        label={config.player_control ? '최대 속도 (km/h)' : '목표 속도'}
        value={config.target_speed}
        min={config.player_control ? 200 : 20}
        max={config.player_control ? 1100 : 300}
        step={10}
        onChange={(v) => pushConfig({ target_speed: v })}
      />
      <Slider
        label="가속도"
        value={config.target_acceleration}
        min={0}
        max={80}
        step={2}
        onChange={(v) => pushConfig({ target_acceleration: v })}
      />
      <Slider
        label="랜덤 노이즈"
        value={config.noise_level}
        min={0}
        max={30}
        step={1}
        onChange={(v) => pushConfig({ noise_level: v })}
      />
      <Slider
        label="미사일 속도 (느릴수록 회피 쉬움)"
        value={config.muzzle_velocity}
        min={120}
        max={320}
        step={10}
        onChange={(v) => pushConfig({ muzzle_velocity: v })}
      />
      <Slider
        label="시뮬레이션 속도"
        value={config.sim_speed}
        min={0.25}
        max={3}
        step={0.25}
        onChange={(v) => pushConfig({ sim_speed: v })}
      />

      <div className="border-t border-gray-700 pt-2 flex flex-col gap-2">
        <Toggle
          label="자동 발사"
          checked={config.auto_fire}
          onChange={(v) => pushConfig({ auto_fire: v })}
        />
        <Toggle
          label="유도 미사일 (이동 추적)"
          checked={config.homing_missiles}
          onChange={(v) => pushConfig({ homing_missiles: v })}
        />
        <Slider
          label="AI 난이도"
          value={config.ai_difficulty ?? 1}
          min={0.5}
          max={2}
          step={0.1}
          onChange={(v) => pushConfig({ ai_difficulty: v })}
        />
        <Slider
          label="유도 강도 (선회율)"
          value={config.homing_turn_rate ?? 14}
          min={6}
          max={20}
          step={0.5}
          onChange={(v) => pushConfig({ homing_turn_rate: v })}
        />
        <Slider
          label="동시 미사일 수"
          value={config.max_active_missiles ?? 2}
          min={1}
          max={5}
          step={1}
          onChange={(v) => pushConfig({ max_active_missiles: v })}
        />
        <Toggle
          label="칼만 필터"
          checked={config.use_kalman}
          onChange={(v) => pushConfig({ use_kalman: v })}
        />
        <Toggle
          label="LSTM 예측"
          checked={config.use_lstm}
          onChange={(v) => pushConfig({ use_lstm: v })}
        />
        <Toggle
          label="공기 저항"
          checked={config.use_air_resistance}
          onChange={(v) => pushConfig({ use_air_resistance: v })}
        />
        <Toggle
          label="회피 모드"
          checked={config.evasion_mode}
          onChange={(v) => pushConfig({ evasion_mode: v })}
        />
      </div>

      <div className="flex flex-col gap-2 mt-auto border-t border-gray-700 pt-3">
        <button
          type="button"
          onClick={launch}
          className="w-full py-2 bg-green-700 hover:bg-green-600 text-white text-sm rounded font-medium"
        >
          수동 발사
        </button>
        <button
          type="button"
          onClick={togglePause}
          className="w-full py-2 bg-blue-800 hover:bg-blue-700 text-white text-sm rounded"
        >
          {config.paused ? '재개' : '일시정지'}
        </button>
        <button
          type="button"
          onClick={restart}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
        >
          재시작
        </button>
        <p className="text-[10px] text-amber-400/90 leading-relaxed">
          드론 0기면 백엔드를 꼭 다시 실행하세요:
          <br />
          backend\run_server.bat 더블클릭
          <br />
          확인: http://127.0.0.1:8000/health → drone_count: 2
        </p>
      </div>

      <div className="text-[10px] text-gray-500 leading-relaxed">
        <p>🔵 YOU · 🟠 유도탄 · 🟢 일반탄</p>
        <p>🟡 예측 궤적 · 흰선 요격 경로</p>
      </div>
    </div>
  );
}
