import * as THREE from 'three';
import { expSmooth, expSmoothAngle } from './aircraftMeshes';

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
  const bank = pose.bank ?? 0;
  const px = pose.x;
  const py = pose.y;
  const pz = pose.z;

  forwardFromPose(yaw, pitch);
  const fwd = _fwd;

  if (!camState.roll) camState.roll = 0;
  if (!camState.velLag) camState.velLag = { x: 0, y: 0, z: 0 };

  if (mode === 'cockpit') {
    const gRoll = bank * 0.35;
    const gPitch = pitch * 0.12;
    camState.roll = expSmoothAngle(camState.roll, gRoll, 6, dt);

    _camPos.set(px, py + 2.15, pz);
    _look.copy(_camPos).addScaledVector(fwd, 800);
    const cockpitLag = 18;
    camState.x = expSmooth(camState.x, _camPos.x, cockpitLag, dt);
    camState.y = expSmooth(camState.y, _camPos.y, cockpitLag, dt);
    camState.z = expSmooth(camState.z, _camPos.z, cockpitLag, dt);
    camera.position.set(camState.x, camState.y, camState.z);
    camera.lookAt(_look.x, _look.y, _look.z);
    camera.rotation.z = camState.roll;
    camera.fov = THREE.MathUtils.lerp(camera.fov, 94, 1 - Math.exp(-4 * dt));
    camera.updateProjectionMatrix();
    return;
  }

  camera.rotation.z = expSmooth(camera.rotation.z, 0, 8, dt);

  if (mode === 'orbit') {
    const dist = distance;
    const oy = orbitYaw + yaw;
    const op = orbitPitch;
    _camPos.set(
      px - Math.sin(oy) * Math.cos(op) * dist,
      py + Math.sin(op) * dist * 0.55 + 45,
      pz - Math.cos(oy) * Math.cos(op) * dist
    );
    camState.x = expSmooth(camState.x, _camPos.x, 10, dt);
    camState.y = expSmooth(camState.y, _camPos.y, 10, dt);
    camState.z = expSmooth(camState.z, _camPos.z, 10, dt);
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
  const height = 30 + dist * 0.09;
  const lag = 5.5 + zoomFactor * 1.2;
  _camPos.set(px + backX * dist * 0.92, py + height, pz + backZ * dist * 0.92);
  camState.x = expSmooth(camState.x, _camPos.x, lag, dt);
  camState.y = expSmooth(camState.y, _camPos.y, lag, dt);
  camState.z = expSmooth(camState.z, _camPos.z, lag, dt);
  camera.position.set(camState.x, camState.y, camState.z);
  _look.set(px, py + 6, pz).addScaledVector(fwd, 200 + dist * 0.12);
  camera.lookAt(_look.x, _look.y, _look.z);
  camera.fov = THREE.MathUtils.lerp(50, 68, zoomFactor);
  camera.updateProjectionMatrix();
}
