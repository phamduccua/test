import type { VesselProfile } from '../glassware/profile';
import type { P2 } from '../types';
import { mm } from '../units';

/**
 * Proxy va chạm THÔ của một vật chứa tròn xoay (trục y cục bộ): bán kính ngoài `ro` / trong `ri` tại `n` trạm cách đều từ đáy
 * ngoài `y0` tới mép miệng `top`; lòng (mở ở miệng) từ đáy trong `floor` lên. Dữ liệu thuần (JSON) – gắn vào `userData.clearance`
 * (xem clearancePairs.ts) để kit đo độ xuyên giữa hai vật và tự tính tư thế rót.
 */
export interface ClearanceProxy {
  y0: number;
  top: number;
  floor: number;
  ro: number[];
  /** Dưới `floor` giữ bán kính trong ở đáy (đáy kiểm riêng bằng `floor`). */
  ri: number[];
  maxR: number;
}

/** Bán kính lớn nhất của polyline (r, y) tại độ cao y (0 nếu ngoài khoảng). */
function maxRAt(poly: P2[], y: number): number {
  let r = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    if (y < lo - 1e-9 || y > hi + 1e-9) continue;
    r = Math.max(r, hi - lo < 1e-9 ? Math.max(a.r, b.r) : a.r + ((b.r - a.r) * (y - a.y)) / (b.y - a.y));
  }
  return r;
}

function build(y0: number, top: number, floor: number, outer: (y: number) => number, inner: (y: number) => number): ClearanceProxy {
  const n = Math.max(8, Math.min(97, Math.ceil((top - y0) / mm(2)) + 1));
  const ro: number[] = [];
  const ri: number[] = [];
  for (let i = 0; i < n; i++) {
    const y = y0 + ((top - y0) * i) / (n - 1);
    ro.push(outer(y));
    ri.push(inner(Math.max(y, floor)));
  }
  return { y0, top, floor, ro, ri, maxR: Math.max(...ro) };
}

/** Proxy từ profile của kit (createVessel / createBeaker / createTestTube…); `dy` = dời theo y (thân kính đặt cao hơn gốc nhóm). */
export function proxyFromProfile(p: VesselProfile, dy = 0): ClearanceProxy {
  const px = build(0, p.height, p.innerBottom, (y) => maxRAt(p.outer, y), (y) => maxRAt(p.inner, y));
  return dy ? shiftProxy(px, dy) : px;
}

/** Proxy nón cụt / trụ có thành (vật chứa tự dựng: chai, lọ, chậu…) – đơn vị cảnh, gốc ở đáy ngoài. */
export function frustumProxy(o: { rBottom: number; rTop?: number; height: number; wall?: number; bottom?: number; y0?: number }): ClearanceProxy {
  const rt = o.rTop ?? o.rBottom;
  const wall = o.wall ?? mm(1.2);
  const y0 = o.y0 ?? 0;
  const r = (y: number) => o.rBottom + ((rt - o.rBottom) * (y - y0)) / o.height;
  return build(y0, y0 + o.height, y0 + (o.bottom ?? wall), r, (y) => Math.max(0, r(y) - wall));
}

export function shiftProxy(px: ClearanceProxy, dy: number): ClearanceProxy {
  return { ...px, y0: px.y0 + dy, top: px.top + dy, floor: px.floor + dy };
}

function at(px: ClearanceProxy, arr: number[], y: number): number {
  const t = ((y - px.y0) / (px.top - px.y0)) * (arr.length - 1);
  if (t <= 0) return arr[0];
  if (t >= arr.length - 1) return arr[arr.length - 1];
  const i = Math.floor(t);
  return arr[i] + (arr[i + 1] - arr[i]) * (t - i);
}
export const outerR = (px: ClearanceProxy, y: number): number => at(px, px.ro, y);
export const innerR = (px: ClearanceProxy, y: number): number => at(px, px.ri, y);

/** Độ cao mặt trên khối bao tại bán kính ρ (miệng coi như đậy); −∞ nếu ρ vượt bán kính lớn nhất. */
export function topAt(px: ClearanceProxy, rho: number): number {
  const n = px.ro.length;
  const dy = (px.top - px.y0) / (n - 1);
  for (let i = n - 1; i >= 0; i--) {
    if (px.ro[i] < rho) continue;
    if (i === n - 1) return px.top;
    return px.y0 + (i + (px.ro[i] - rho) / (px.ro[i] - px.ro[i + 1])) * dy;
  }
  return -Infinity;
}

/** Độ cao mặt dưới khối bao tại bán kính ρ (+∞ nếu ρ vượt bán kính lớn nhất). */
export function bottomAt(px: ClearanceProxy, rho: number): number {
  const n = px.ro.length;
  const dy = (px.top - px.y0) / (n - 1);
  for (let i = 0; i < n; i++) {
    if (px.ro[i] < rho) continue;
    if (i === 0) return px.y0;
    return px.y0 + (i - (px.ro[i] - rho) / (px.ro[i] - px.ro[i - 1])) * dy;
  }
  return Infinity;
}

/** Độ sâu (đơn vị cục bộ) của điểm (ρ, y) trong KHỐI BAO đặc (thành + lòng, miệng đậy); 0 = ở ngoài. */
export function hullDepth(px: ClearanceProxy, rho: number, y: number): number {
  if (y <= px.y0 || y >= px.top) return 0;
  const side = outerR(px, y) - rho;
  if (side <= 0) return 0;
  return Math.max(0, Math.min(side, topAt(px, rho) - y, y - bottomAt(px, rho)));
}

/** Điểm của vật CẮM VÀO lòng: dưới mặt miệng mà lấn qua thành trong / đáy trong bao nhiêu (đơn vị cục bộ); trên miệng = 0. */
export function cavityExcess(px: ClearanceProxy, rho: number, y: number): number {
  if (y >= px.top) return 0;
  return Math.max(0, rho - innerR(px, y), px.floor - y);
}

/** Điểm mẫu trên mặt ngoài + mép trong miệng + đáy (toạ độ cục bộ, xyz liên tiếp), bước ~`step`. */
export function surfaceSamples(px: ClearanceProxy, step = mm(3)): Float32Array {
  const pts: number[] = [];
  const ring = (r: number, y: number) => {
    const n = r < 1e-6 ? 1 : Math.max(10, Math.min(32, Math.ceil((2 * Math.PI * r) / step)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      pts.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  };
  const H = px.top - px.y0;
  const levels = Math.max(6, Math.min(56, Math.ceil(H / step)));
  for (let i = 0; i <= levels; i++) ring(outerR(px, px.y0 + (H * i) / levels), px.y0 + (H * i) / levels);
  ring(innerR(px, px.top), px.top);
  ring(outerR(px, px.y0) * 0.5, px.y0);
  ring(0, px.y0);
  return new Float32Array(pts);
}
