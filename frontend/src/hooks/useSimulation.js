import { useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  createWebSocket,
  sendWsConfig,
  sendWsSync,
  API_BASE,
  sendWsLaunch,
  sendWsPause,
  sendWsRestart,
  sendWsSelect,
} from '../services/api';
import { useSimulationStore } from '../store/simulationStore';

export function useSimulation() {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const syncOnceRef = useRef(false);
  const {
    connected,
    config,
    selectedTargetId,
    setConnected,
    applyServerState,
    updateConfig,
  } = useSimulationStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = createWebSocket(
      (msg) => {
        if (msg.type === 'state' && msg.payload) {
          applyServerState(msg.payload);
        } else if (msg.type === 'fire_result' && msg.payload?.hit) {
          useSimulationStore.setState({ lastFireHit: true });
          setTimeout(() => useSimulationStore.setState({ lastFireHit: false }), 120);
        }
      },
      async () => {
        setConnected(true);
        syncOnceRef.current = false;
        const cfg = useSimulationStore.getState().config;
        try {
          const health = await axios.get(`${API_BASE}/health`, { timeout: 3000 });
          if ((health.data?.drone_count ?? 0) < 1) {
            await axios.post(`${API_BASE}/restart`, {}, { timeout: 5000 });
          }
        } catch {
          /* 백엔드 미실행 */
        }
        if (!syncOnceRef.current) {
          syncOnceRef.current = true;
          sendWsSync(ws, {
            ...cfg,
            paused: false,
            player_control: true,
            ai_targets: true,
            auto_fire: true,
          });
        }
      },
      () => {
        setConnected(false);
        syncOnceRef.current = false;
        reconnectRef.current = setTimeout(connect, 2000);
      }
    );
    wsRef.current = ws;
  }, [applyServerState, setConnected]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const pushConfig = useCallback(
    (partial) => {
      const next = updateConfig(partial);
      sendWsConfig(wsRef.current, next);
    },
    [updateConfig]
  );

  const launch = useCallback(() => {
    sendWsLaunch(wsRef.current, selectedTargetId);
  }, [selectedTargetId]);

  const restart = useCallback(() => {
    sendWsRestart(wsRef.current);
  }, []);

  const togglePause = useCallback(() => {
    const paused = !config.paused;
    pushConfig({ paused });
    sendWsPause(wsRef.current, paused);
  }, [config.paused, pushConfig]);

  const selectTarget = useCallback((targetId) => {
    sendWsSelect(wsRef.current, targetId);
    useSimulationStore.setState({ selectedTargetId: targetId });
  }, []);

  return {
    connected,
    config,
    wsRef,
    pushConfig,
    launch,
    restart,
    togglePause,
    selectTarget,
  };
}
