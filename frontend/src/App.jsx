import { useCallback } from 'react';
import Scene3D from './components/Scene3D';
import ControlPanel from './components/ControlPanel';
import GameOverlay from './components/GameOverlay';
import { usePlayerInput } from './hooks/usePlayerInput';
import { useSimulation } from './hooks/useSimulation';
import { useSimulationStore } from './store/simulationStore';
import { sendWsRestart } from './services/api';

export default function App() {
  const {
    connected,
    config,
    wsRef,
    pushConfig,
    launch,
    restart,
    togglePause,
    selectTarget,
  } = useSimulation();
  const gameStarted = useSimulationStore((s) => s.gameStarted);
  const panelOpen = useSimulationStore((s) => s.panelOpen);
  const setGameStarted = useSimulationStore((s) => s.setGameStarted);
  const targets = useSimulationStore((s) => s.targets);
  const selectedTargetId = useSimulationStore((s) => s.selectedTargetId);

  usePlayerInput(wsRef, config.player_control && gameStarted);

  const handleStart = useCallback(() => {
    setGameStarted(true);
    pushConfig({ paused: false, player_control: true, ai_targets: true, auto_fire: true });
    sendWsRestart(wsRef.current);
    document.body.requestPointerLock?.();
  }, [setGameStarted, pushConfig, wsRef]);

  const handleRetry = useCallback(() => {
    setGameStarted(true);
    pushConfig({ paused: false, player_control: true, ai_targets: true, auto_fire: true });
    sendWsRestart(wsRef.current);
    document.body.requestPointerLock?.();
  }, [setGameStarted, pushConfig, wsRef]);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#030510]">
      <Scene3D />
      <GameOverlay wsRef={wsRef} onStart={handleStart} onRetry={handleRetry} />
      {panelOpen && (
        <ControlPanel
          config={config}
          pushConfig={pushConfig}
          launch={launch}
          restart={restart}
          togglePause={togglePause}
          selectTarget={selectTarget}
          connected={connected}
          targets={targets}
          selectedTargetId={selectedTargetId}
          wsRef={wsRef}
        />
      )}
    </div>
  );
}
