import { useEffect, useRef, useState } from 'react';

import * as THREE from 'three';

import { useSimulationStore } from '../store/simulationStore';

import { preloadPhotoAssets, getPhotoAsset } from '../rendering/assetLoader';

import { makeTex } from '../rendering/sceneUtils';

import { createSkyEnvironment, altitudeToY } from '../rendering/skyEnvironment';

import { createWorldBounds, distanceToArenaBoundary, ARENA } from '../rendering/worldBounds';

import { createFlightGround } from '../rendering/flightGround';
import { disposeTerrainTextures } from '../rendering/terrainTextures';

import { createFlightEffects } from '../rendering/flightEffects';

import {

  createFighter3D,

  FIGHTER_MESH_VERSION,

  DRONE_MESH_VERSION,

  updateFighter3D,

  createDrone3D,

  updateDrone3D,

  createBullet3D,

  updateBullet3D,

  createMissile3D,

  updateMissile3D,

  getAircraftPose,

} from '../rendering/aircraftMeshes';

import { updateFlightCamera, cameraModeLabel } from '../rendering/flightCamera';
import { createDisplayInterpolator } from '../rendering/displayInterpolator';
import ArcadeCombatHUD from './ArcadeCombatHUD';
import CockpitHUD from './CockpitHUD';



const SIM_W = 1200;

const SIM_H = 700;



function updateTrajectoryLine(line, points, altM = 4500) {

  const y = altitudeToY(altM);

  if (!line || !points?.length || points.length < 2) {

    if (line) line.visible = false;

    return;

  }

  const verts = new Float32Array(points.length * 3);

  for (let i = 0; i < points.length; i++) {

    verts[i * 3] = points[i].x;

    verts[i * 3 + 1] = y;

    verts[i * 3 + 2] = points[i].y;

  }

  line.geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));

  line.geometry.setDrawRange(0, points.length);

  line.visible = true;

}



export default function Scene3D() {

  const containerRef = useRef(null);

  const renderRef = useRef(null);

  const configRef = useRef(useSimulationStore.getState().config);

  const [ready, setReady] = useState(false);

  const clockRef = useRef({ last: 0 });

  const lookDragRef = useRef(false);



  useEffect(() => {
    setReady(true);
    preloadPhotoAssets();
  }, []);



  useEffect(() => {

    renderRef.current = useSimulationStore.getState();

    return useSimulationStore.subscribe((state) => {

      renderRef.current = state;

      configRef.current = state.config;

    });

  }, []);



  useEffect(() => {

    const container = containerRef.current;

    if (!container || !ready) return undefined;



    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 1, 12000);

    const camSmooth = { x: SIM_W * 0.5, y: altitudeToY(4500), z: SIM_H * 0.5 };



    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
      stencil: false,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));

    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    container.appendChild(renderer.domElement);

    const cinematic = document.createElement('div');
    cinematic.className = 'cinematic-overlay';
    container.appendChild(cinematic);

    const displayInterp = createDisplayInterpolator();



    const sky = createSkyEnvironment(scene);

    const worldBounds = createWorldBounds(SIM_W, SIM_H);

    const flightGround = createFlightGround();

    scene.add(worldBounds.group);

    scene.add(flightGround.group);

    scene.add(new THREE.AmbientLight(0x8ab4d0, 0.55));
    scene.add(new THREE.HemisphereLight(0xd8ecff, 0x3a4a5a, 0.5));

    const sun = new THREE.DirectionalLight(0xfff4e0, 0.9);

    sun.position.set(400, 1200, 200);

    scene.add(sun);

    scene.add(sun.target);

    const sunRef = { light: sun };



    const texMissile = makeTex(getPhotoAsset('missile'));

    const texExplosion = makeTex(getPhotoAsset('explosion'));



    const entities = { targets: new Map(), projectiles: new Map(), explosion: null };

    const effects = createFlightEffects(scene);

    const lockLines = new THREE.Group();

    scene.add(lockLines);

    const lockMat = new THREE.LineBasicMaterial({
      color: 0xff4422,
      transparent: true,
      opacity: 0.38,
    });

    const lockLinePool = [];



    const predLine = new THREE.Line(

      new THREE.BufferGeometry(),

      new THREE.LineBasicMaterial({ color: 0xffee66, transparent: true, opacity: 0.55 })

    );

    scene.add(predLine);



    const projPrevLine = new THREE.Line(

      new THREE.BufferGeometry(),

      new THREE.LineDashedMaterial({ color: 0xff7755, transparent: true, opacity: 0.4, dashSize: 10, gapSize: 6 })

    );

    scene.add(projPrevLine);



    const resize = () => {

      const w = window.innerWidth;

      const h = window.innerHeight;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));

      renderer.setSize(w, h);

      camera.aspect = w / h;

      camera.updateProjectionMatrix();

    };

    resize();

    window.addEventListener('resize', resize);



    const el = renderer.domElement;

    const onCtx = (e) => e.preventDefault();



    const onPointerDown = (e) => {

      if (!configRef.current.player_control) return;

      if (e.button === 0) {

        lookDragRef.current = true;

        el.tabIndex = 0;

        el.focus?.();

        el.requestPointerLock?.();

      }

    };



    const onPointerUp = () => {

      lookDragRef.current = false;

    };



    const onPointerMove = (e) => {

      if (!lookDragRef.current && document.pointerLockElement !== el) return;

      const st = useSimulationStore.getState();

      const sens = 0.0034;
      if (st.cameraMode === 'orbit') {
        st.addOrbitYaw(e.movementX * sens * 1.2);
        st.addOrbitPitch(e.movementY * sens);
      } else {
        st.addViewYaw(e.movementX * sens);
        st.addViewPitch(e.movementY * sens);
        st.addControlRates(e.movementX * sens * 0.4, e.movementY * sens * 0.4);
      }

    };



    const onLockChange = () => {

      useSimulationStore.getState().setPointerLocked(document.pointerLockElement === el);

    };



    el.addEventListener('pointerdown', onPointerDown);

    el.addEventListener('pointerup', onPointerUp);

    el.addEventListener('pointermove', onPointerMove);

    el.addEventListener('contextmenu', onCtx);

    document.addEventListener('pointerlockchange', onLockChange);

    const onWheel = (e) => {
      const st = useSimulationStore.getState();
      if (st.cameraMode === 'cockpit') return;
      e.preventDefault();
      st.adjustCameraDistance(e.deltaY * 0.45);
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    let rafId;

    let frameCount = 0;

    let fpsLast = performance.now();

    clockRef.current.last = performance.now();



    const syncTarget = (t, isPlayer, dt, time) => {

      let mesh = entities.targets.get(t.id);

      const wantVer = isPlayer ? FIGHTER_MESH_VERSION : DRONE_MESH_VERSION;
      if (mesh && mesh.userData.meshVersion !== wantVer) {
        scene.remove(mesh);
        entities.targets.delete(t.id);
        mesh = null;
      }

      if (!mesh) {

        mesh = isPlayer ? createFighter3D() : createDrone3D();

        entities.targets.set(t.id, mesh);

        scene.add(mesh);

      }

      const vx = t.velocity?.x ?? 0;

      const vy = t.velocity?.y ?? 0;

      const spd = t.speed_kmh ?? Math.hypot(vx, vy) * 3.6;

      if (isPlayer) {

        updateFighter3D(mesh, t.position.x, t.position.y, vx, vy, spd, dt, time, {

          altitude: t.altitude,

          heading: t.heading,

          pitch: t.pitch,

          bank: t.bank,

          throttle: t.throttle,

          directAttitude: true,

        });

      } else {

        updateDrone3D(mesh, t.position.x, t.position.y, vx, vy, dt, time, {
          altitude: t.altitude ?? 4500,
          heading: t.heading,
        });

      }

    };



    const syncProjectile = (p, dt) => {

      let mesh = entities.projectiles.get(p.id);

      const isBullet = !!p.from_player;

      if (!mesh) {

        mesh = isBullet
          ? createBullet3D()
          : createMissile3D(texMissile, !!p.homing, p.hp_max ?? 0);

        entities.projectiles.set(p.id, mesh);

        scene.add(mesh);

      }

      if (isBullet) {
        updateBullet3D(
          mesh,
          p.position.x,
          p.position.y,
          p.velocity?.x ?? 0,
          p.velocity?.y ?? 0,
          dt,
          p.altitude ?? 4500
        );
      } else {
        updateMissile3D(
          mesh,
          p.position.x,
          p.position.y,
          p.velocity?.x ?? 0,
          p.velocity?.y ?? 0,
          dt,
          p.altitude ?? 4300
        );
      }

    };



    const tick = (now) => {
      if (document.hidden) {
        clockRef.current.last = now;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min(0.05, (now - clockRef.current.last) / 1000);

      clockRef.current.last = now;



      const stRaw = renderRef.current;
      if (stRaw) displayInterp.feed(stRaw);
      const st = displayInterp.getView(now) ?? stRaw;

      if (st) {

        frameCount += 1;

        if (now - fpsLast >= 1000) {

          useSimulationStore.getState().setLocalFps(frameCount);

          frameCount = 0;

          fpsLast = now;

        }



        const activeT = new Set(st.targets.map((t) => t.id));

        for (const [id, mesh] of entities.targets) {

          if (!activeT.has(id)) {

            scene.remove(mesh);

            entities.targets.delete(id);

          }

        }

        const activeP = new Set(st.projectiles.map((p) => p.id));

        for (const [id, mesh] of entities.projectiles) {

          if (!activeP.has(id)) {

            scene.remove(mesh);

            entities.projectiles.delete(id);

          }

        }



        const player = st.targets.find((t) => t.is_player);

        for (let i = 0; i < st.targets.length; i++) {

          const t = st.targets[i];

          syncTarget(t, t.is_player, dt, now * 0.001);

        }



        for (let i = 0; i < st.projectiles.length; i++) {

          syncProjectile(st.projectiles[i], dt);

        }



        const playerMesh = player ? entities.targets.get(player.id) : null;
        const camStore = useSimulationStore.getState();

        if (player) {

          const px = player.position.x;

          const pz = player.position.y;

          const pAlt = player.altitude ?? 4500;

          const pvx = player.velocity?.x ?? 0;

          const pvz = player.velocity?.y ?? 0;

          const a = st.arena;
          const boundsInfo = {
            radius: a?.radius ?? 500,
            centerX: a?.center?.x ?? ARENA.cx,
            centerZ: a?.center?.z ?? ARENA.cz,
            centerAlt: a?.center?.altitude ?? ARENA.alt,
          };

          sky.follow(
            px,
            pz,
            pAlt,
            player.heading ?? 0,
            pvx,
            pvz,
            boundsInfo
          );

          flightGround.setAltitude(pAlt);
          const wave = st.game?.wave ?? 1;
          flightGround.setWave(wave);

          flightGround.scroll(px, pz);

          worldBounds.setAltitude(pAlt);
          sunRef.light.position.set(px + 400, altitudeToY(pAlt) + 800, pz + 200);

          sunRef.light.target.position.set(px, altitudeToY(pAlt), pz);
          sunRef.light.target.updateMatrixWorld();

          const pose = getAircraftPose(playerMesh, {

            heading: player.heading,

            pitch: player.pitch,

            bank: player.bank,

          }) || {

            x: player.position.x,

            y: altitudeToY(player.altitude ?? 4500),

            z: player.position.y,

            yaw: player.heading ?? 0,

            pitch: player.pitch ?? 0,

            bank: player.bank ?? 0,

          };

          playerMesh.visible = camStore.cameraMode !== 'cockpit';

          updateFlightCamera(camera, pose, camSmooth, {

            mode: camStore.cameraMode,

            distance: camStore.cameraDistance,

            orbitYaw: camStore.orbitYaw,

            orbitPitch: camStore.orbitPitch,

            viewYaw: camStore.viewYaw,

            viewPitch: camStore.viewPitch,

          }, dt);



          const sh = effects.shake;

          if (sh > 0.01) {

            camera.position.x += (Math.random() - 0.5) * sh * 4;

            camera.position.y += (Math.random() - 0.5) * sh * 3;

          }

          const playFx = {
            ...player,
            muzzleFlash: st.lastFireHit,
            _viewYaw: camStore.viewYaw,
          };
          effects.update(dt, playFx, st.projectiles, entities);
        } else {
          effects.update(dt, null, st.projectiles, entities);

          sky.follow(SIM_W * 0.5, SIM_H * 0.5);

          camera.position.set(SIM_W * 0.5, altitudeToY(4500) + 80, SIM_H * 0.5 + 200);

          camera.lookAt(SIM_W * 0.5, altitudeToY(4500), SIM_H * 0.5);

        }



        const pAlt = player?.altitude ?? 4500;
        const gameMode = configRef.current?.player_control;

        if (gameMode) {
          predLine.visible = false;
          projPrevLine.visible = false;
        } else {
          updateTrajectoryLine(predLine, st.prediction?.trajectory, pAlt);
          updateTrajectoryLine(projPrevLine, st.projectileTrajectory, pAlt - 80);
          if (projPrevLine.visible) projPrevLine.computeLineDistances();
        }



        let lockIdx = 0;

        for (const p of st.projectiles) {

          if (!p.homing) continue;

          const lockId = p.locked_target_id || p.target_id;

          const tgt = st.targets.find((t) => t.id === lockId);

          if (!tgt) continue;

          let line = lockLinePool[lockIdx];

          if (!line) {

            const g = new THREE.BufferGeometry();

            line = new THREE.Line(g, lockMat);

            lockLines.add(line);

            lockLinePool[lockIdx] = line;

          }

          const m = entities.projectiles.get(p.id);

          const fromY = m?.position?.y ?? altitudeToY(p.altitude);

          const toY = altitudeToY(tgt.altitude ?? 4500);

          line.geometry.setAttribute(

            'position',

            new THREE.Float32BufferAttribute(

              [p.position.x, fromY, p.position.y, tgt.position.x, toY, tgt.position.y],

              3

            )

          );

          line.visible = true;

          lockIdx++;

        }

        for (let i = lockIdx; i < lockLinePool.length; i++) {

          if (lockLinePool[i]) lockLinePool[i].visible = false;

        }



        if (st.hit && st.hitTimer > 0) {

          const sel = st.targets.find((t) => t.id === st.selectedTargetId) || player;

          if (sel) {

            if (!entities.explosion) {

              const mat = new THREE.SpriteMaterial({ map: texExplosion, transparent: true });

              entities.explosion = new THREE.Sprite(mat);

              scene.add(entities.explosion);

            }

            entities.explosion.visible = true;

            entities.explosion.position.set(

              sel.position.x,

              altitudeToY(sel.altitude ?? 4500),

              sel.position.y

            );

            const sc = 60 + (st.hitTimer / 1.2) * 90;

            entities.explosion.scale.set(sc, sc, 1);

            entities.explosion.material.opacity = Math.min(1, st.hitTimer / 1.2);

          }

        } else if (entities.explosion) {

          entities.explosion.visible = false;

        }

      }



      renderer.render(scene, camera);

      rafId = requestAnimationFrame(tick);

    };

    rafId = requestAnimationFrame(tick);



    return () => {

      cancelAnimationFrame(rafId);

      window.removeEventListener('resize', resize);

      el.removeEventListener('pointerdown', onPointerDown);

      el.removeEventListener('pointerup', onPointerUp);

      el.removeEventListener('pointermove', onPointerMove);

      el.removeEventListener('contextmenu', onCtx);
      el.removeEventListener('wheel', onWheel);

      document.removeEventListener('pointerlockchange', onLockChange);

      effects.dispose();

      lockMat.dispose();

      lockLinePool.forEach((ln) => ln?.geometry?.dispose());

      worldBounds.dispose();

      flightGround.dispose();
      disposeTerrainTextures();

      sky.dispose();

      renderer.dispose();

      container.removeChild(renderer.domElement);

    };

  }, [ready]);



  return (

    <div className="fixed inset-0 z-0 touch-none select-none cursor-crosshair" ref={containerRef}>

      {!ready && (

        <div className="absolute inset-0 flex items-center justify-center bg-[#4a8fc4] text-white/90 text-lg z-20">

          하늘 환경 로딩...

        </div>

      )}

      <HudOverlay />
      <ArcadeCombatHUD />
      <CockpitHUD />
      <Crosshair />

    </div>

  );

}



function Crosshair() {

  const locked = useSimulationStore((s) => s.pointerLocked);

  const mode = useSimulationStore((s) => s.cameraMode);

  if (mode === 'cockpit') return null;
  if (!locked && mode !== 'orbit') return null;

  return (

    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">

      <div className="w-8 h-8 border border-white/50 rounded-full opacity-70" />

      <div className="absolute w-px h-3 bg-white/60 top-1/2 left-1/2 -translate-x-1/2 -translate-y-5" />

      <div className="absolute w-px h-3 bg-white/60 top-1/2 left-1/2 -translate-x-1/2 translate-y-2" />

      <div className="absolute h-px w-3 bg-white/60 top-1/2 left-1/2 -translate-y-1/2 -translate-x-5" />

      <div className="absolute h-px w-3 bg-white/60 top-1/2 left-1/2 -translate-y-1/2 translate-x-2" />

    </div>

  );

}



function HudOverlay() {

  const fps = useSimulationStore((s) => s.localFps);

  const serverFps = useSimulationStore((s) => s.fps);

  const config = useSimulationStore((s) => s.config);

  const debug = useSimulationStore((s) => s.debug);

  const hit = useSimulationStore((s) => s.hit);

  const hitTimer = useSimulationStore((s) => s.hitTimer);

  const cameraMode = useSimulationStore((s) => s.cameraMode);

  const pointerLocked = useSimulationStore((s) => s.pointerLocked);

  const player = useSimulationStore((s) => s.targets.find((t) => t.is_player));
  const cameraDistance = useSimulationStore((s) => s.cameraDistance);
  const canvas = useSimulationStore((s) => s.canvas);

  if (cameraMode === 'cockpit') return null;

  const spd = debug.speed_kmh ?? player?.speed_kmh ?? Math.hypot(debug.velocity?.x ?? 0, debug.velocity?.y ?? 0) * 3.6;
  const alt = debug.altitude ?? player?.altitude ?? 4500;
  const edgeDist =
    player?.position != null
      ? distanceToArenaBoundary(
          player.position.x,
          player.position.y,
          player.altitude ?? ARENA.alt
        )
      : null;

  return (
    <>
      <div className="absolute top-4 left-4 z-10 font-mono text-xs text-white drop-shadow-md pointer-events-none space-y-1">

        <div className="text-amber-200/90 text-sm font-bold tracking-wide">미사일 궤적 예측 피하기</div>

        <div>FPS {fps} | 서버 {serverFps?.toFixed?.(0) ?? serverFps}</div>

        {config.player_control && (

          <>

            <div>W/S 가속 · A/D 뱅크 · Space/Ctrl 피치 · Shift 부스트</div>

            <div>클릭+마우스 시야 · V 시점 · 휠 줌</div>

            <div className="text-cyan-200">
              {cameraModeLabel(cameraMode)} {pointerLocked ? '(시야 고정)' : '(클릭하여 시야)'}
              {cameraMode !== 'cockpit' ? ` · 휠 줌 ${Math.round(cameraDistance)}` : ''}
            </div>

          </>

        )}

        <div className="text-lg text-yellow-300 font-bold">

          {spd.toFixed(0)} km/h

        </div>

        <div>고도 {alt.toFixed(0)} m · 최대 {config.target_speed?.toFixed?.(0)} km/h</div>

        <div className="text-gray-300 text-[10px]">고도 차이 70m+ 이면 미사일 회피</div>

        <div className="text-orange-200/90">
          구형 전투 구역 R{ARENA.radius}m
          {edgeDist != null && edgeDist < 140
            ? ` · 경계까지 ${Math.max(0, Math.round(edgeDist))} m`
            : ''}
        </div>

        {edgeDist != null && edgeDist < 80 && (
          <div className="text-red-400 font-bold animate-pulse">◆ 구역 경계 근접</div>
        )}

        <div>AI {config.ai_difficulty ?? 1} | 드론 {debug.drone_count ?? 0}기</div>

        {hit && hitTimer > 0 ? (

          <div className="text-red-400 font-bold">◆ 피격 — {debug.last_hit_target_id ?? ''}</div>

        ) : (

          <div>충돌예상 {debug.collision_time != null ? `${debug.collision_time.toFixed(1)}s` : '—'}</div>

        )}

      </div>

      {!pointerLocked && config.player_control && (

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-white/80 text-sm bg-black/40 px-4 py-2 rounded pointer-events-none">

          화면 클릭 후 WASD 이동 · 마우스 시야 (Esc 해제)

        </div>

      )}

    </>

  );

}


