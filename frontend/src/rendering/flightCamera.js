import * as THREE from 'three';
import { expSmooth } from './aircraftMeshes';

const _fwd = new THREE.Vector3();
const _look = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _offset = new THREE.Vector3();

export const CAMERA_MODES = ['cockpit', 'chase', 'orbit'];

export function cameraModeLabel(mode) {
  if (mode === 'cockpit') return '1인칭 (조종석)';
  if (mode === 'orbit') return '3인칭 (자유)';
  return '3인칭 (추적)';
}

/** 기체 heading/pitch = 시야 방향 (서버와 동기) */
function forwardFromPose(yaw, pitch) {
  _fwd.set(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  );
  return _fwd;
}

export function updateFlightCamera(camera, pose, camState, opts, dt) {
  const { mode, distance, orbitYaw, orbitPitch, viewYaw = 0, viewPitch = 0 } = opts;
  const yaw = pose.yaw + viewYaw;
  const pitch = (pose.pitch ?? 0) + viewPitch;
  const px = pose.x;
  const py = pose.y;
  const pz = pose.z;

  forwardFromPose(yaw, pitch);
  const fwd = _fwd;

  if (mode === 'cockpit') {
    _camPos.set(px, py + 2.2, pz);
    _look.copy(_camPos).addScaledVector(fwd, 600);
    const cockpitLag = 14;
    camState.x = expSmooth(camState.x, _camPos.x, cockpitLag, dt);
    camState.y = expSmooth(camState.y, _camPos.y, cockpitLag, dt);
    camState.z = expSmooth(camState.z, _camPos.z, cockpitLag, dt);
    camera.position.set(camState.x, camState.y, camState.z);
    camera.lookAt(_look.x, _look.y, _look.z);
    camera.fov = 92;
    camera.updateProjectionMatrix();
    return;
  }

  if (mode === 'orbit') {
    const dist = distance;
    const oy = orbitYaw + yaw;
    const op = orbitPitch;
    _camPos.set(
      px - Math.sin(oy) * Math.cos(op) * dist,
      py + Math.sin(op) * dist * 0.55 + 45,
      pz - Math.cos(oy) * Math.cos(op) * dist
    );
    camState.x = expSmooth(camState.x, _camPos.x, 8, dt);
    camState.y = expSmooth(camState.y, _camPos.y, 8, dt);
    camState.z = expSmooth(camState.z, _camPos.z, 8, dt);
    camera.position.set(camState.x, camState.y, camState.z);
    _look.set(px, py + 8, pz).addScaledVector(fwd, 120);
    camera.lookAt(_look.x, _look.y, _look.z);
    const zoomFactor = THREE.MathUtils.clamp((dist - 50) / 570, 0, 1);
    camera.fov = THREE.MathUtils.lerp(38, 72, zoomFactor);
    camera.updateProjectionMatrix();
    return;
  }

  const dist = distance;
  const zoomFactor = THREE.MathUtils.clamp((dist - 50) / 570, 0, 1);
  const backX = -Math.sin(yaw);
  const backZ = -Math.cos(yaw);
  const height = 28 + dist * 0.085;
  const lag = 4.2 + zoomFactor * 1.5;
  _camPos.set(px + backX * dist * 0.92, py + height, pz + backZ * dist * 0.92);
  camState.x = expSmooth(camState.x, _camPos.x, lag, dt);
  camState.y = expSmooth(camState.y, _camPos.y, lag, dt);
  camState.z = expSmooth(camState.z, _camPos.z, lag, dt);
  camera.position.set(camState.x, camState.y, camState.z);
  _look.set(px, py + 6, pz).addScaledVector(fwd, 180 + dist * 0.15);
  camera.lookAt(_look.x, _look.y, _look.z);
  camera.fov = THREE.MathUtils.lerp(52, 68, zoomFactor);
  camera.updateProjectionMatrix();
}
