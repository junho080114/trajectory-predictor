import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000/ws';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export async function fetchPredict(targetId = 'target-0', horizon = 2.0) {
  const { data } = await client.get('/predict', {
    params: { target_id: targetId, horizon },
  });
  return data;
}

export async function launchProjectile(payload) {
  const { data } = await client.post('/launch', payload);
  return data;
}

export async function fetchStatus() {
  const { data } = await client.get('/status');
  return data;
}

export async function updateConfig(config) {
  const { data } = await client.post('/config', config);
  return data;
}

export async function restartSimulation() {
  const { data } = await client.post('/restart');
  return data;
}

export async function selectTarget(targetId) {
  const { data } = await client.post(`/select/${targetId}`);
  return data;
}

export function createWebSocket(onMessage, onOpen, onClose) {
  const ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    if (onOpen) onOpen();
  };
  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onMessage(parsed);
    } catch {
      /* ignore malformed */
    }
  };
  ws.onclose = () => {
    if (onClose) onClose();
  };
  ws.onerror = () => {
    if (onClose) onClose();
  };
  return ws;
}

export function sendWsConfig(ws, config) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'config', payload: config }));
  }
}

/** 설정 적용 + 시뮬 재시작 (드론 스폰 등) */
export function sendWsSync(ws, config) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'sync', payload: config }));
  }
}

export function sendWsLaunch(ws, targetId) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'launch', payload: { target_id: targetId } }));
  }
}

export function sendWsRestart(ws) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'restart', payload: {} }));
  }
}

export function sendWsPause(ws, paused) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'pause', payload: { paused } }));
  }
}

export function sendWsSelect(ws, targetId) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'select', payload: { target_id: targetId } }));
  }
}

export function sendWsInput(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'input', payload }));
  }
}

export function sendWsFire(ws) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'fire', payload: {} }));
  }
}

export function sendWsGameMode(ws, config) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'sync', payload: config }));
  }
}
