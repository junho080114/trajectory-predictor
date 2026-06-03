import { useCallback, useEffect, useRef, useState } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { preloadPhotoAssets } from '../rendering/assetLoader';
import { drawExplosion, drawLauncherTurret, drawPhotoSkyBackground } from '../rendering/gameSprites';
import { drawProjectile } from './Projectile';
import { drawPrediction } from './PredictionLine';
import { drawTarget } from './Target';

function screenToSim(clientX, clientY, scaleRef, simCanvas) {
  const { sx, sy, ox, oy } = scaleRef.current;
  const x = (clientX - ox) / sx;
  const y = (clientY - oy) / sy;
  return {
    x: Math.max(0, Math.min(simCanvas.width, x)),
    y: Math.max(0, Math.min(simCanvas.height, y)),
  };
}

export default function CanvasSimulation({ playerInput }) {
  const canvasRef = useRef(null);
  const scaleRef = useRef({ sx: 1, sy: 1, ox: 0, oy: 0 });
  const pointerDownRef = useRef(false);
  const timeRef = useRef(0);
  const renderRef = useRef(null);
  const configRef = useRef(useSimulationStore.getState().config);
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    preloadPhotoAssets()
      .then(() => {
        if (!cancelled) setAssetsReady(true);
      })
      .catch(() => {
        if (!cancelled) setAssetsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    renderRef.current = useSimulationStore.getState();
    return useSimulationStore.subscribe((state) => {
      renderRef.current = state;
      configRef.current = state.config;
    });
  }, []);

  const simCanvas = useSimulationStore((s) => s.canvas);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const sx = w / simCanvas.width;
      const sy = h / simCanvas.height;
      const s = Math.min(sx, sy);
      const ox = (w - simCanvas.width * s) / 2;
      const oy = (h - simCanvas.height * s) / 2;
      scaleRef.current = { sx: s, sy: s, ox, oy, dpr };
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [simCanvas.width, simCanvas.height]);

  const handlePointer = useCallback(
    (clientX, clientY) => {
      if (!playerInput?.setAim || !configRef.current.player_control) return;
      const sim = screenToSim(clientX, clientY, scaleRef, simCanvas);
      playerInput.setAim(sim);
    },
    [playerInput, simCanvas]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !configRef.current.player_control) return undefined;

    const onDown = (e) => {
      pointerDownRef.current = true;
      canvas.setPointerCapture(e.pointerId);
      handlePointer(e.clientX, e.clientY);
    };
    const onMove = (e) => {
      if (pointerDownRef.current) handlePointer(e.clientX, e.clientY);
    };
    const onUp = () => {
      pointerDownRef.current = false;
      playerInput?.clearAim?.();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, [handlePointer, playerInput]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: false });
    let rafId;
    let frameCount = 0;
    let fpsLast = performance.now();
    let localFps = 60;

    const render = (now) => {
      timeRef.current = now * 0.001;
      const st = renderRef.current;
      if (!st) {
        rafId = requestAnimationFrame(render);
        return;
      }

      frameCount += 1;
      if (now - fpsLast >= 1000) {
        localFps = frameCount;
        frameCount = 0;
        fpsLast = now;
        useSimulationStore.getState().setLocalFps(localFps);
      }

      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = scaleRef.current.dpr || 1;
      const { sx, sy, ox, oy } = scaleRef.current;
      const { width: simW, height: simH } = st.canvas;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#6eb8e8';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(sx, sy);

      if (!assetsReady) {
        ctx.fillStyle = '#3a7ab0';
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText('사진 에셋 로딩 중...', 24, 40);
      }
      drawPhotoSkyBackground(ctx, simW, simH);

      const player = st.targets.find((t) => t.is_player);
      const playerPos = player?.position ?? null;
      drawPrediction(ctx, st.prediction, st.projectileTrajectory, playerPos);

      let turretAngle = 0;
      if (player) {
        turretAngle = Math.atan2(
          player.position.y - st.launcher.y,
          player.position.x - st.launcher.x
        );
      }
      drawLauncherTurret(ctx, st.launcher.x, st.launcher.y, turretAngle);

      const lockedIds = new Set(st.projectiles.map((p) => p.target_id));
      const tNow = timeRef.current;
      for (let i = 0; i < st.targets.length; i++) {
        const t = st.targets[i];
        drawTarget(ctx, t, t.id === st.selectedTargetId, lockedIds.has(t.id), tNow);
      }
      for (let i = 0; i < st.projectiles.length; i++) {
        drawProjectile(ctx, st.projectiles[i], tNow);
      }

      if (st.hit && st.hitTimer > 0) {
        const sel = st.targets.find((t) => t.id === st.selectedTargetId) || player;
        if (sel) {
          drawExplosion(ctx, sel.position.x, sel.position.y, Math.min(1, st.hitTimer / 1.2));
        }
      }

      ctx.restore();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#1a3a52';
      ctx.font = '12px Consolas, monospace';
      const cfg = st.config;
      const dbg = st.debug;
      const lines = [
        `FPS ${localFps} | 서버 ${st.fps?.toFixed?.(0) ?? st.fps}`,
        cfg.player_control ? 'WASD·Shift·마우스 | 유도탄 회피!' : '',
        `좌표 (${dbg.target_position.x.toFixed(0)}, ${dbg.target_position.y.toFixed(0)})`,
        `속도 ${Math.hypot(dbg.velocity.x, dbg.velocity.y).toFixed(0)} | AI ${cfg.ai_difficulty ?? 1}`,
        `우선 타겟: ${dbg.priority_target_id ?? '—'} | 드론 ${dbg.drone_count ?? 0}기`,
        st.hit && st.hitTimer > 0
          ? `◆ HIT — ${dbg.last_hit_target_id ?? ''}`
          : `충돌예상 ${dbg.collision_time != null ? dbg.collision_time.toFixed(1) + 's' : '—'}`,
      ].filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 16, 26 + i * 17);
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [simCanvas.width, simCanvas.height]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 block touch-none select-none z-0"
      style={{
        width: '100vw',
        height: '100vh',
        cursor: configRef.current.player_control ? 'crosshair' : 'default',
      }}
    />
  );
}
