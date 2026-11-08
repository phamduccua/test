import * as THREE from 'three';
import { UNIT_MM } from '../units';
import { bottomAt, cavityExcess, hullDepth, innerR, surfaceSamples, topAt, type ClearanceProxy } from './clearance';

/** Gắn / bỏ proxy va chạm cho vật (toạ độ cục bộ của `obj`). Kit tự gắn cho mọi vật chứa dựng bằng createVessel. */
export function setClearance(obj: THREE.Object3D, proxy: ClearanceProxy | null): void {
  if (proxy) obj.userData.clearance = proxy;
  else delete obj.userData.clearance;
}
export const clearanceOf = (obj: THREE.Object3D): ClearanceProxy | null => (obj.userData?.clearance as ClearanceProxy | undefined) ?? null;

/** Vật mang proxy trong `obj` (chính nó hoặc con cháu ≤ `depth` cấp). */
export function findClearance(obj: THREE.Object3D, depth = 3): THREE.Object3D | null {
  if (clearanceOf(obj)) return obj;
  if (depth <= 0) return null;
  for (const c of obj.children) {
    const f = findClearance(c, depth - 1);
    if (f) return f;
  }
  return null;
}

/** Một vật có proxy trong cảnh, đã tính khung thế giới. */
export interface ClearanceItem {
  obj: THREE.Object3D;
  px: ClearanceProxy;
  world: THREE.Matrix4;
  inv: THREE.Matrix4;
  /** mm trên một đơn vị cục bộ. */
  mm: number;
  center: THREE.Vector3;
  radius: number;
  /** Tâm miệng (thế giới). */
  mouth: THREE.Vector3;
}

const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent));
const samplesCache = new WeakMap<ClearanceProxy, Float32Array>();
export const samplesOf = (px: ClearanceProxy): Float32Array => {
  let s = samplesCache.get(px);
  if (!s) samplesCache.set(px, (s = surfaceSamples(px)));
  return s;
};

export function clearanceItem(obj: THREE.Object3D): ClearanceItem | null {
  const px = clearanceOf(obj);
  if (!px) return null;
  const world = obj.matrixWorld.clone();
  const s = world.getMaxScaleOnAxis();
  const h = (px.top - px.y0) / 2;
  return {
    obj, px, world, inv: world.clone().invert(), mm: s * UNIT_MM,
    center: new THREE.Vector3(0, px.y0 + h, 0).applyMatrix4(world),
    radius: Math.hypot(px.maxR, h) * s,
    mouth: new THREE.Vector3(0, px.top, 0).applyMatrix4(world),
  };
}

/** Mọi vật có proxy đang hiện trong `root` (đã cập nhật matrixWorld). */
export function collectClearance(root: THREE.Object3D): ClearanceItem[] {
  root.updateMatrixWorld();
  const out: ClearanceItem[] = [];
  root.traverse((o) => {
    if (clearanceOf(o) && shown(o)) out.push(clearanceItem(o)!);
  });
  return out;
}

/** Vật chứa có tâm miệng gần điểm `p` (thế giới) nhất – trong bán kính miệng + 6 mm theo phương ngang, ±25 % chiều cao theo phương đứng. */
export function itemAtMouth(items: ClearanceItem[], p: THREE.Vector3, skip?: THREE.Object3D | null): ClearanceItem | null {
  let best: ClearanceItem | null = null;
  let bd = Infinity;
  for (const it of items) {
    if (it.obj === skip) continue;
    const dxz = Math.hypot(it.mouth.x - p.x, it.mouth.z - p.z);
    const dy = Math.abs(it.mouth.y - p.y);
    if (dxz > it.px.maxR * (it.mm / UNIT_MM) + 0.06 || dy > it.radius * 0.5 + 0.03) continue;
    const d = dxz + dy;
    if (d < bd) [bd, best] = [d, it];
  }
  return best;
}

const M = new THREE.Matrix4();
const v = new THREE.Vector3();
/** Duyệt điểm mẫu của A trong khung cục bộ của B: f(ρ, y) mỗi điểm. */
function eachIn(a: ClearanceItem, b: ClearanceItem, f: (rho: number, y: number) => void) {
  M.multiplyMatrices(b.inv, a.world);
  const s = samplesOf(a.px);
  for (let i = 0; i < s.length; i += 3) {
    v.set(s[i], s[i + 1], s[i + 2]).applyMatrix4(M);
    f(Math.hypot(v.x, v.z), v.y);
  }
}

/** A lọt vào khối bao (thành + lòng + miệng đậy) của B sâu nhất bao nhiêu mm. */
export function hullPenetration(a: ClearanceItem, b: ClearanceItem): number {
  let d = 0;
  eachIn(a, b, (r, y) => void (d = Math.max(d, hullDepth(b.px, r, y))));
  return d * b.mm;
}

/**
 * Độ xuyên THÂN (mm) giữa hai vật không phải cặp rót: vật cắm trong lòng vật kia (ống trong cốc cách thuỷ) là hợp lệ; chỉ tính phần
 * lấn qua THÀNH – lấy nhỏ hơn giữa "phần trong khối bao" và "phần ra ngoài lòng" (đường cắt ngắn nhất để tách hai vật).
 */
export function bodyPenetration(a: ClearanceItem, b: ClearanceItem): number {
  const one = (p: ClearanceItem, q: ClearanceItem) => {
    let hull = 0;
    let out = 0;
    eachIn(p, q, (r, y) => {
      const h = hullDepth(q.px, r, y);
      hull = Math.max(hull, h);
      out = Math.max(out, cavityExcess(q.px, r, y));
    });
    return Math.min(hull, out) * q.mm;
  };
  return Math.max(one(a, b), one(b, a));
}

/** Cặp rót: vật rót phải ở NGOÀI hẳn khối bao vật nhận (miệng nhận coi như đậy) và ngược lại. */
export const pourPenetration = (a: ClearanceItem, b: ClearanceItem): number => Math.max(hullPenetration(a, b), hullPenetration(b, a));

export const near = (a: ClearanceItem, b: ClearanceItem): boolean => a.center.distanceTo(b.center) < a.radius + b.radius;

/**
 * Đáy trong (thế giới, + `margin`) của vật chứa mà điểm `p` (thế giới) nằm trong cột miệng của nó – từ đáy ngoài tới trên miệng 30 mm;
 * null nếu không có; bỏ qua proxy thuộc `skip` (chính ống hút). Dùng chặn đầu ống hút / pipet nhúng không xuyên đáy lọ.
 */
export function floorBelow(root: THREE.Object3D, p: THREE.Vector3, margin = 0.03, skip?: THREE.Object3D): number | null {
  let best: number | null = null;
  const own = (o: THREE.Object3D | null): boolean => !!o && (o === skip || own(o.parent));
  for (const it of collectClearance(root)) {
    if (skip && own(it.obj)) continue;
    const u = it.mm / UNIT_MM;
    const c = new THREE.Vector3(0, it.px.floor, 0).applyMatrix4(it.world);
    if (Math.hypot(p.x - c.x, p.z - c.z) > innerR(it.px, it.px.top) * u || p.y > it.mouth.y + 0.3 || p.y < c.y - (it.px.floor - it.px.y0) * u - 0.3) continue;
    best = Math.max(best ?? -Infinity, c.y + margin);
  }
  return best;
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
/**
 * Vật `a` (ở khung thế giới `world`, mặc định `a.world`) phải nhấc thẳng lên bao nhiêu (thế giới) để mọi điểm của nó nằm trên khối bao của `b`
 * (miệng đậy); −∞ nếu không điểm nào ở trên / trong cột của `b`. `strict` false (vật chứa lân cận): điểm trong cột miệng được thò vào lòng,
 * chỉ tính thành / vành. `b` úp ngược (nắp đĩa petri) tính theo mặt dưới; `b` nằm nghiêng (> 25°) bỏ qua.
 */
export function liftOver(a: ClearanceItem, b: ClearanceItem, strict = true, world = a.world): number {
  const upY = tmpV.copy(UP).transformDirection(b.world).y;
  if (Math.abs(upY) < 0.9) return -Infinity;
  const flip = upY < 0;
  tmpM.multiplyMatrices(b.inv, world);
  const s = samplesOf(a.px);
  const rim = strict ? 0 : innerR(b.px, b.px.top);
  let need = -Infinity;
  for (let i = 0; i < s.length; i += 3) {
    tmpV.set(s[i], s[i + 1], s[i + 2]).applyMatrix4(tmpM);
    const r = Math.hypot(tmpV.x, tmpV.z);
    if (r > b.px.maxR || r < rim) continue;
    need = Math.max(need, flip ? tmpV.y - bottomAt(b.px, r) : topAt(b.px, r) - tmpV.y);
  }
  return need * (b.mm / UNIT_MM);
}

/** Điểm `p` (thế giới) nằm trong cột lòng của `it` (từ đáy trong tới miệng + 2 mm) – vd. miệng ống nghiệm đứng trong cốc cách thuỷ. */
export function inCavity(it: ClearanceItem, p: THREE.Vector3): boolean {
  const q = p.clone().applyMatrix4(it.inv);
  return q.y >= it.px.floor && q.y <= it.px.top + 0.02 / (it.mm / UNIT_MM) && Math.hypot(q.x, q.z) <= innerR(it.px, Math.min(q.y, it.px.top));
}
