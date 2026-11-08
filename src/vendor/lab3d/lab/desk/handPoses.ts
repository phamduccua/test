import * as THREE from 'three';
import { FINGERS, fingerTip, padNormal, PALM_HALF, THUMB, wrapCurl, type FingerPose, type PoseSolution, type ThumbPose } from './handSolve';

/** Tư thế bàn tay mẫu + đích ngón cái (tách khỏi handSolve – số đo & lời giải hình học). */

const fp = (a: number, b: number, c: number, spread = 0): FingerPose => ({ curl: [a, b, c], spread });
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Ngón giữa/nhẫn/út gập vào lòng (tư thế chỉ, kẹp). */
const TUCK = [fp(1.45, 1.55, 0.9), fp(1.5, 1.55, 0.9), fp(1.5, 1.5, 0.85)];

export type HandPose = 'open' | 'relaxed' | 'grip' | 'pinch' | 'point' | 'press';
export type ThumbMode = 'wrap' | 'along' | 'cap';
export interface PoseParams {
  /** Bán kính vật nắm (mm) – 'grip'. */
  grip: number;
  /** Bề dày vật kẹp giữa ngón cái – trỏ (mm) – 'pinch'. */
  width: number;
  thumb: ThumbMode;
  /** 'cap': khoảng từ tâm nắm tới đầu vật phía ngón cái (mm). */
  reach: number;
}

/** Tư thế → góc khớp + đích ngón cái + neo kẹp. */
export function solvePose(pose: HandPose, o: PoseParams): PoseSolution {
  const s = solveJoints(pose, o);
  const index = s.fingers[0];
  const pad = fingerTip(FINGERS[0], index, FINGERS[0].radius * 0.85);
  const normal = padNormal(index);
  const point = pose === 'pinch' ? pad.addScaledVector(normal, o.width / 2) : pad.lerp(s.thumb.target, 0.5);
  return { ...s, pinch: { point, normal } };
}

function solveJoints(pose: HandPose, o: PoseParams): Omit<PoseSolution, 'pinch'> {
  const r = Math.max(1, o.grip);
  const grip = v3(-2, 78, -(PALM_HALF + r + 1));
  const tr = THUMB.radius;
  if (pose === 'grip') {
    const fingers = FINGERS.map((f) => {
      const c = wrapCurl(f.len, grip.y - f.base[1], grip.z - f.base[2], r + f.radius);
      return fp(...c);
    });
    const outside = r + 2 * FINGERS[1].radius + tr * 0.8;
    const thumb =
      o.thumb === 'along'
        ? { target: v3(grip.x - 52, grip.y + (r + tr) * 0.55, grip.z - (r + tr) * 0.8), bendToward: v3(0.3, 0, 1) }
        : o.thumb === 'cap'
          ? { target: v3(grip.x - (o.reach + tr * 0.8), grip.y, grip.z), bendToward: v3(1, 0, 0) }
          : { target: v3(grip.x + 6, grip.y + 6, grip.z - outside), bendToward: v3(0.4, -0.2, 1) };
    return { fingers, thumb, grip };
  }
  if (pose === 'pinch') {
    const index = fp(0.55, 0.6, 0.25, 0.08);
    const pad = fingerTip(FINGERS[0], index, FINGERS[0].radius * 0.85);
    // Ngón cái đối diện bụng ngón trỏ, cách đúng bề dày vật.
    const target = pad.clone().addScaledVector(padNormal(index), o.width + tr * 0.85);
    return { fingers: [index, ...TUCK.map((t) => fp(t.curl[0] - 0.35, t.curl[1] - 0.3, t.curl[2]))], thumb: { target, bendToward: v3(1, 0.2, 0.3) }, grip };
  }
  if (pose === 'point' || pose === 'press') {
    const index = pose === 'point' ? fp(0.05, 0.08, 0.04) : fp(0.45, 0.4, 0.15);
    const fingers = [index, ...TUCK];
    // Ngón cái gập đè lên đốt giữa ngón giữa.
    const mid = fingerTip(FINGERS[1], { curl: [1.5, 0, 0], spread: 0 }).lerp(v3(...FINGERS[1].base), 0.35);
    return { fingers, thumb: { target: mid.add(v3(-6, 4, -14)), bendToward: v3(1, 0, 0.5) }, grip };
  }
  const k = pose === 'relaxed' ? 1 : 0;
  return {
    fingers: [fp(0.12 + k * 0.3, 0.12 + k * 0.4, 0.06 + k * 0.2, 0.14), fp(0.1 + k * 0.35, 0.1 + k * 0.45, 0.05 + k * 0.2, 0.03), fp(0.12 + k * 0.4, 0.12 + k * 0.5, 0.06 + k * 0.2, -0.07), fp(0.15 + k * 0.45, 0.15 + k * 0.5, 0.08 + k * 0.2, -0.16)],
    thumb: { target: v3(-74 + k * 16, 86 - k * 10, -24 - k * 16), bendToward: v3(0.5, 0, -1) },
    grip,
  };
}

/** Tâm đầu chuỗi khớp ngón cái theo tỉ lệ gập `k` (khung gốc ngón, duỗi theo +y, gập về −z). */
function thumbReach(k: number): THREE.Vector3 {
  const f = [0.15 * k, 0.55 * k, 0.75 * k];
  const v = new THREE.Vector3();
  let a = 0;
  for (let i = 0; i < 3; i++) {
    a += f[i];
    const L = i === 2 ? THUMB.len[i] - THUMB.radius * 0.85 : THUMB.len[i];
    v.y += Math.cos(a) * L;
    v.z -= Math.sin(a) * L;
  }
  return v;
}

/**
 * Ngón cái hướng tới `target`: tìm độ gập k để tầm với = khoảng cách (chia đôi), rồi quay gốc ngón cho đầu ngón trùng đích,
 * bụng ngón quay về `bendToward`. Trả về quaternion gốc + 3 góc gập.
 */
export function aimThumb(t: ThumbPose): { q: THREE.Quaternion; curl: [number, number, number] } {
  const d = t.target.clone().sub(new THREE.Vector3(...THUMB.base));
  const dist = d.length();
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const m = (lo + hi) / 2;
    if (thumbReach(m).length() > dist) lo = m;
    else hi = m;
  }
  const k = (lo + hi) / 2;
  const reach = thumbReach(k).normalize();
  const dn = d.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(reach, dn);
  // Xoay quanh trục gốc→đích để mặt gập (−z cục bộ) hướng về bendToward.
  const bend = new THREE.Vector3(0, 0, -1).applyQuaternion(q).projectOnPlane(dn).normalize();
  const want = t.bendToward.clone().projectOnPlane(dn).normalize();
  const ang = Math.atan2(new THREE.Vector3().crossVectors(bend, want).dot(dn), bend.dot(want));
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(dn, ang));
  return { q, curl: [0.15 * k, 0.55 * k, 0.75 * k] };
}
