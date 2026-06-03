import * as THREE from 'three';
import { altitudeToY } from './skyEnvironment';

const _dir = new THREE.Vector3();
const _modelForward = new THREE.Vector3(0, 0, 1);
const _quatTarget = new THREE.Quaternion();
const _quatBank = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export const FIGHTER_MESH_VERSION = 6;
export const DRONE_MESH_VERSION = 2;

const SMOOTH_POS = 11;
const SMOOTH_ALT = 9;
const SMOOTH_ROT = 9;
const SMOOTH_ROT_DIRECT = 16;
const SMOOTH_VEL = 7;
const SMOOTH_POS_PLAYER = 16;

const sharedMat = {
  fighterBody: new THREE.MeshLambertMaterial({ color: 0x5a7a94 }),
  fighterWing: new THREE.MeshLambertMaterial({ color: 0x4a6a82 }),
  fighterDark: new THREE.MeshLambertMaterial({ color: 0x3a5068 }),
  fighterGlass: new THREE.MeshLambertMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.75 }),
  exhaust: new THREE.MeshBasicMaterial({
    color: 0xffaa55,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  }),
  droneBody: new THREE.MeshLambertMaterial({ color: 0x4a5568 }),
  droneArm: new THREE.MeshLambertMaterial({ color: 0x2e3540 }),
  droneRotor: new THREE.MeshLambertMaterial({ color: 0x1a2028 }),
  droneCam: new THREE.MeshLambertMaterial({ color: 0x66aacc }),
};

export function expSmooth(current, target, speed, dt) {
  const t = 1 - Math.exp(-speed * dt);
  if (typeof target === 'number') return current + (target - current) * t;
  return current + (target - current) * t;
}

export function expSmoothAngle(current, target, speed, dt) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-speed * dt));
}

export function headingFromVelocity(vx, vy) {
  if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) return null;
  return Math.atan2(vx, vy);
}

export function orientGroupToHeading(group, heading, pitch, bank, dt) {
  const s = group.userData.smooth;
  s.yaw = expSmoothAngle(s.yaw ?? heading, heading, SMOOTH_ROT, dt);
  s.bank = expSmooth(s.bank ?? 0, bank, 8, dt);
  s.pitch = expSmooth(s.pitch ?? 0, pitch, 8, dt);
  group.rotation.order = 'YXZ';
  group.rotation.set(s.pitch, s.yaw, s.bank);
  return s.yaw;
}

export function orientGroupToVelocity(group, vx, vy, bank, pitch, dt) {
  const speed = Math.hypot(vx, vy);
  const s = group.userData.smooth;
  if (speed < 0.8) {
    group.rotation.order = 'YXZ';
    group.rotation.set(s.pitch ?? 0, s.yaw ?? 0, s.bank ?? 0);
    return s.yaw ?? 0;
  }

  _dir.set(vx, 0, vy).normalize();
  _quatTarget.setFromUnitVectors(_modelForward, _dir);

  if (s.quat) {
    s.quat.slerp(_quatTarget, 1 - Math.exp(-SMOOTH_ROT * dt));
  } else {
    s.quat = _quatTarget.clone();
  }

  _euler.setFromQuaternion(s.quat, 'YXZ');
  s.yaw = _euler.y;
  s.bank = expSmooth(s.bank ?? 0, bank, 7, dt);
  s.pitch = expSmooth(s.pitch ?? 0, pitch, 7, dt);

  group.quaternion.copy(s.quat);
  const rollAxis = _modelForward.clone().applyQuaternion(s.quat).normalize();
  _quatBank.setFromAxisAngle(rollAxis, s.bank);
  group.quaternion.multiply(_quatBank);
  group.rotateX(s.pitch);
  return s.yaw;
}

function addMesh(group, geo, mat, pos, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  group.add(m);
  return m;
}

/** 로우폴리 전투기 — 기수 +Z */
export function createFighter3D() {
  const group = new THREE.Group();
  group.userData.smooth = {
    x: 0,
    y: 20,
    z: 0,
    yaw: 0,
    bank: 0,
    pitch: 0,
    svx: 0,
    svz: 0,
    quat: new THREE.Quaternion(),
    prevVx: 0,
    prevVz: 0,
  };
  group.userData.meshVersion = FIGHTER_MESH_VERSION;

  const hull = new THREE.Group();

  addMesh(hull, new THREE.BoxGeometry(2.4, 2.6, 13), sharedMat.fighterBody, [0, 0.8, 0]);
  addMesh(
    hull,
    new THREE.ConeGeometry(1.6, 5, 6),
    sharedMat.fighterDark,
    [0, 0.9, 8.5],
    [Math.PI / 2, 0, 0]
  );
  addMesh(hull, new THREE.BoxGeometry(15, 0.35, 3.8), sharedMat.fighterWing, [0, 0.6, 0.5]);
  addMesh(hull, new THREE.BoxGeometry(4.5, 0.3, 2.2), sharedMat.fighterWing, [0, 1.1, -5.5]);
  addMesh(hull, new THREE.BoxGeometry(0.5, 3.2, 1.8), sharedMat.fighterDark, [0, 2.2, -6]);
  addMesh(hull, new THREE.SphereGeometry(1.1, 6, 6), sharedMat.fighterGlass, [0, 1.8, 3.5]);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 5), sharedMat.exhaust);
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 1, -7.5);
  flame.visible = false;
  hull.add(flame);

  group.add(hull);
  group.userData.flame = flame;

  return group;
}

export function updateFighter3D(group, simX, simY, vx, vy, speed, dt, time, flight = {}) {
  const s = group.userData.smooth;
  const targetY = altitudeToY(flight.altitude ?? 4500);

  const posSmooth = flight.directAttitude ? SMOOTH_POS_PLAYER : SMOOTH_POS;
  s.x = expSmooth(s.x, simX, posSmooth, dt);
  s.y = expSmooth(s.y, targetY, SMOOTH_ALT, dt);
  s.z = expSmooth(s.z, simY, posSmooth, dt);
  s.svx = expSmooth(s.svx ?? vx, vx, SMOOTH_VEL, dt);
  s.svz = expSmooth(s.svz ?? vy, vy, SMOOTH_VEL, dt);

  const turn = s.svx * s.prevVz - s.svz * s.prevVx;
  s.prevVx = s.svx;
  s.prevVz = s.svz;
  const targetBank =
    flight.bank != null && Number.isFinite(flight.bank)
      ? flight.bank
      : Math.max(-0.5, Math.min(0.5, turn * 0.014));
  const targetPitch = flight.pitch ?? Math.max(-0.3, Math.min(0.3, -speed * 0.00006));

  group.position.set(s.x, s.y, s.z);

  const speed2d = Math.hypot(s.svx, s.svz);
  const h =
    flight.heading != null && Number.isFinite(flight.heading)
      ? flight.heading
      : headingFromVelocity(s.svx, s.svz);

  const rotSpeed = flight.directAttitude ? SMOOTH_ROT_DIRECT : SMOOTH_ROT;

  if (flight.directAttitude && h != null) {
    const s0 = group.userData.smooth;
    s0.yaw = expSmoothAngle(s0.yaw ?? h, h, rotSpeed, dt);
    s0.bank = expSmooth(s0.bank ?? 0, targetBank, rotSpeed, dt);
    s0.pitch = expSmooth(s0.pitch ?? 0, targetPitch, rotSpeed, dt);
    group.rotation.order = 'YXZ';
    group.rotation.set(s0.pitch, s0.yaw, s0.bank);
    s.yaw = s0.yaw;
  } else if (speed2d > 6) {
    orientGroupToVelocity(group, s.svx, s.svz, targetBank, targetPitch, dt);
    s.yaw = headingFromVelocity(s.svx, s.svz) ?? s.yaw ?? h ?? 0;
  } else if (h != null) {
    orientGroupToHeading(group, h, targetPitch, targetBank, dt);
    s.yaw = h;
  }

  const flame = group.userData.flame;
  if (flame) {
    const thr = flight.throttle ?? 0.5;
    const thrust = speed > 60 || thr > 0.55;
    flame.visible = thrust;
    if (thrust) {
      const pulse = 0.92 + Math.sin(time * 12) * 0.08;
      const boost = thr > 0.95 ? 1.35 : 1;
      flame.scale.set(pulse * boost, (0.85 + speed * 0.0015) * boost, pulse * boost);
      flame.material.opacity = 0.45 + Math.min(0.45, speed * 0.0008 + thr * 0.2);
    }
  }
}

/** 로우폴리 쿼드콥터 드론 */
export function createDrone3D() {
  const group = new THREE.Group();
  group.userData.smooth = {
    x: 0,
    y: 16,
    z: 0,
    yaw: 0,
    bank: 0,
    svx: 0,
    svz: 0,
    quat: new THREE.Quaternion(),
    prevVx: 0,
    prevVz: 0,
    rotorPhase: 0,
  };
  group.userData.meshVersion = DRONE_MESH_VERSION;

  addMesh(group, new THREE.BoxGeometry(5, 2.2, 5), sharedMat.droneBody, [0, 2, 0]);
  addMesh(group, new THREE.SphereGeometry(1.2, 5, 5), sharedMat.droneCam, [0, 2.8, 0]);

  const rotors = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const ax = Math.cos(a) * 9;
    const az = Math.sin(a) * 9;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 0.5), sharedMat.droneArm);
    arm.position.set(ax * 0.5, 2.2, az * 0.5);
    arm.rotation.y = a;
    group.add(arm);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.25, 6), sharedMat.droneRotor);
    r.position.set(ax, 2.5, az);
    group.add(r);
    rotors.push(r);
  }
  group.userData.rotors = rotors;

  return group;
}

export function updateDrone3D(group, simX, simY, vx, vy, dt, time = 0, flight = {}) {
  const s = group.userData.smooth;
  const targetY = altitudeToY(flight.altitude ?? 4500);
  s.x = expSmooth(s.x, simX, SMOOTH_POS, dt);
  s.z = expSmooth(s.z, simY, SMOOTH_POS, dt);
  s.y = expSmooth(s.y, targetY, SMOOTH_ALT, dt);
  s.svx = expSmooth(s.svx ?? vx, vx, SMOOTH_VEL, dt);
  s.svz = expSmooth(s.svz ?? vy, vy, SMOOTH_VEL, dt);

  const turn = s.svx * s.prevVz - s.svz * s.prevVx;
  s.prevVx = s.svx;
  s.prevVz = s.svz;
  const targetBank = Math.max(-0.28, Math.min(0.28, turn * 0.008));

  group.position.set(s.x, s.y, s.z);
  orientGroupToVelocity(group, s.svx, s.svz, targetBank, 0, dt);

  s.rotorPhase = (s.rotorPhase ?? 0) + dt * 14;
  const rotors = group.userData.rotors;
  if (rotors) {
    for (let i = 0; i < rotors.length; i++) {
      rotors[i].rotation.y = s.rotorPhase * (i % 2 === 0 ? 1 : -1);
    }
  }
}

export function createMissile3D(_texture, homing) {
  const group = new THREE.Group();
  group.userData.smooth = { x: 0, y: 18, z: 0, yaw: 0, quat: new THREE.Quaternion() };

  const color = homing ? 0xcc4422 : 0x667070;
  const mat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 12, 6), mat);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const warhead = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 3, 6),
    new THREE.MeshLambertMaterial({ color: 0xff3322 })
  );
  warhead.rotation.x = -Math.PI / 2;
  warhead.position.z = 7.5;
  group.add(warhead);

  return group;
}

export function updateMissile3D(group, simX, simY, vx, vy, dt, altM = 4300) {
  const s = group.userData.smooth;
  s.x = expSmooth(s.x, simX, 14, dt);
  s.y = expSmooth(s.y, altitudeToY(altM), 12, dt);
  s.z = expSmooth(s.z, simY, 14, dt);
  s.svx = expSmooth(s.svx ?? vx, vx, 10, dt);
  s.svz = expSmooth(s.svz ?? vy, vy, 10, dt);

  group.position.set(s.x, s.y, s.z);
  const h = headingFromVelocity(s.svx, s.svz);
  if (h != null) orientGroupToHeading(group, h, 0, 0, dt);
  else orientGroupToVelocity(group, s.svx, s.svz, 0, 0, dt);
}

export function getAircraftPose(group, flight = {}) {
  const s = group?.userData?.smooth;
  if (!s) return null;
  return {
    x: s.x,
    y: s.y,
    z: s.z,
    yaw: s.yaw ?? flight.heading ?? 0,
    pitch: s.pitch ?? flight.pitch ?? 0,
  };
}
