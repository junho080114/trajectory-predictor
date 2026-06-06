import { useEffect, useRef } from 'react';
import { sendWsFire, sendWsInput } from '../services/api';
import { useSimulationStore } from '../store/simulationStore';

const FLIGHT_KEYS = new Set([
  'KeyW',
  'KeyS',
  'KeyA',
  'KeyD',
  'Space',
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'KeyF',
]);

function buildPayload(keys) {
  let throttle = 0;
  let moveStrafe = 0;
  let moveVertical = 0;
  let boost = false;

  if (keys.has('KeyW')) throttle += 1;
  if (keys.has('KeyS')) throttle -= 1;
  if (keys.has('KeyA')) moveStrafe += 1;
  if (keys.has('KeyD')) moveStrafe -= 1;
  if (keys.has('Space')) moveVertical = 1;
  else if (keys.has('ControlLeft') || keys.has('ControlRight')) moveVertical = -1;
  if (keys.has('ShiftLeft') || keys.has('ShiftRight')) boost = true;

  const st = useSimulationStore.getState();

  return {
    move_x: moveStrafe,
    move_y: throttle > 0 ? 1 : throttle < 0 ? -1 : 0,
    move_forward: throttle > 0 ? 1 : 0,
    move_strafe: moveStrafe,
    move_vertical: moveVertical,
    throttle_input: throttle,
    boost,
    view_yaw: st.viewYaw,
    view_pitch: st.viewPitch,
    yaw_rate: st.yawRate,
    pitch_rate: st.pitchRate,
  };
}

export function usePlayerInput(wsRef, enabled) {
  const keysRef = useRef(new Set());
  const firingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const send = () => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      sendWsInput(ws, buildPayload(keysRef.current));
    };

    const tryFire = () => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (firingRef.current) return;
      firingRef.current = true;
      sendWsFire(ws);
      setTimeout(() => {
        firingRef.current = false;
      }, 90);
    };

    const onKeyDown = (e) => {
      if (e.code === 'KeyV' && !e.repeat) {
        e.preventDefault();
        useSimulationStore.getState().cycleCameraMode();
        return;
      }
      if (e.code === 'KeyF' && !e.repeat) {
        e.preventDefault();
        tryFire();
        return;
      }
      if (!FLIGHT_KEYS.has(e.code)) return;
      e.preventDefault();
      keysRef.current.add(e.code);
      send();
    };

    const onKeyUp = (e) => {
      keysRef.current.delete(e.code);
      if (FLIGHT_KEYS.has(e.code)) {
        e.preventDefault();
        send();
      }
    };

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (!useSimulationStore.getState().pointerLocked) return;
      e.preventDefault();
      tryFire();
    };

    const onBlur = () => {
      keysRef.current.clear();
      send();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('blur', onBlur);
    document.body.style.overflow = 'hidden';

    const interval = setInterval(() => {
      useSimulationStore.getState().decayControlRates(0.04);
      send();
    }, 40);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('blur', onBlur);
      clearInterval(interval);
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        sendWsInput(ws, {
          move_x: 0,
          move_y: 0,
          move_forward: 0,
          move_strafe: 0,
          move_vertical: 0,
          throttle_input: 0,
          boost: false,
          view_yaw: 0,
          view_pitch: 0,
        });
      }
      document.body.style.overflow = '';
    };
  }, [wsRef, enabled]);

  return {};
}
