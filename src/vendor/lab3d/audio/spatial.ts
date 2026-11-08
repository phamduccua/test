/** Định vị 3D: listener theo camera, PannerNode HRTF theo điểm/vật (cập nhật mỗi frame khi có nguồn định vị). */
import * as THREE from 'three';
import type { SoundAt } from './types';

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _f = new THREE.Vector3();
const _u = new THREE.Vector3();

function setParam(p: AudioParam | undefined, v: number, t: number): void {
  if (p) p.setTargetAtTime(v, t, 0.02);
}

function setVec(x: AudioParam, y: AudioParam, z: AudioParam, v: { x: number; y: number; z: number }, t: number): void {
  setParam(x, v.x, t);
  setParam(y, v.y, t);
  setParam(z, v.z, t);
}

/** Đặt listener = vị trí + hướng camera. */
export function syncListener(ctx: BaseAudioContext, camera: THREE.Camera): void {
  camera.updateMatrixWorld();
  camera.matrixWorld.decompose(_p, _q, _s);
  _f.set(0, 0, -1).applyQuaternion(_q);
  _u.set(0, 1, 0).applyQuaternion(_q);
  const l = ctx.listener, t = ctx.currentTime;
  if (l.positionX) {
    setVec(l.positionX, l.positionY, l.positionZ, _p, t);
    setVec(l.forwardX, l.forwardY, l.forwardZ, _f, t);
    setVec(l.upX, l.upY, l.upZ, _u, t);
  } else {
    // Firefox cũ / Safari cũ: API kiểu cũ.
    const old = l as unknown as { setPosition(x: number, y: number, z: number): void; setOrientation(...a: number[]): void };
    old.setPosition(_p.x, _p.y, _p.z);
    old.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z);
  }
}

export function worldPos(at: SoundAt, out: THREE.Vector3): THREE.Vector3 {
  if ((at as THREE.Object3D).isObject3D) return (at as THREE.Object3D).getWorldPosition(out);
  return out.copy(at as THREE.Vector3);
}

export function createPanner(ctx: BaseAudioContext, refDistance: number): PannerNode {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = refDistance;
  p.rolloffFactor = 1;
  p.maxDistance = refDistance * 1000;
  return p;
}

export function placePanner(p: PannerNode, at: SoundAt, ctx: BaseAudioContext, instant = false): void {
  worldPos(at, _p);
  const t = ctx.currentTime;
  if (p.positionX) {
    if (instant) {
      p.positionX.value = _p.x;
      p.positionY.value = _p.y;
      p.positionZ.value = _p.z;
    } else {
      setVec(p.positionX, p.positionY, p.positionZ, _p, t);
    }
  } else (p as unknown as { setPosition(x: number, y: number, z: number): void }).setPosition(_p.x, _p.y, _p.z);
}
