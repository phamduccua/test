import type { P2 } from '../types';
import { arc, dedupe, offsetInward } from './curves';

/** Profile tròn xoay của một dụng cụ thuỷ tinh (đơn vị cảnh, gốc ở đáy ngoài, trục y). */
export interface VesselProfile {
  /** Mặt ngoài, đi từ đáy lên miệng. */
  outer: P2[];
  /** Mặt trong (lòng dụng cụ), đi từ đáy trong lên miệng; y tăng đơn điệu. */
  inner: P2[];
  /** Profile kín cho LatheGeometry (ngoài → bo miệng → trong). */
  closed: P2[];
  wall: number;
  /** Độ cao miệng. */
  height: number;
  /** Độ cao đáy trong (nơi chất lỏng bắt đầu). */
  innerBottom: number;
  /** Bán kính ngoài lớn nhất (để đặt dụng cụ, va chạm thô). */
  maxRadius: number;
}

/**
 * Dựng profile kín từ đường bao ngoài: dịch vào trong `wall`, bo miệng nửa vòng tròn.
 * `openBottom` (phễu, ống hở): bo cả đầu dưới thay vì khép ở trục.
 */
export function buildProfile(outerIn: P2[], wall: number, openBottom = false): VesselProfile {
  const outer = dedupe(outerIn);
  const inner = offsetInward(outer, wall);
  const top = outer[outer.length - 1];
  const topIn = inner[inner.length - 1];
  const lipC = { r: (top.r + topIn.r) / 2, y: (top.y + topIn.y) / 2 };
  const lipR = Math.hypot(top.r - topIn.r, top.y - topIn.y) / 2;
  const a0 = Math.atan2(top.y - lipC.y, top.r - lipC.r);
  const lip = arc(lipC.r, lipC.y, lipR, a0, a0 + Math.PI, 8).slice(1, -1);
  const closed: P2[] = [...outer, ...lip, ...[...inner].reverse()];
  if (openBottom) {
    const b = outer[0];
    const bIn = inner[0];
    const c = { r: (b.r + bIn.r) / 2, y: (b.y + bIn.y) / 2 };
    const R = Math.hypot(b.r - bIn.r, b.y - bIn.y) / 2;
    const s = Math.atan2(bIn.y - c.y, bIn.r - c.r);
    closed.push(...arc(c.r, c.y, R, s, s + Math.PI, 6).slice(1));
  }
  return {
    outer,
    inner,
    closed,
    wall,
    height: top.y,
    innerBottom: inner[0].y,
    maxRadius: Math.max(...outer.map((p) => p.r)),
  };
}

/** Bán kính lòng dụng cụ tại độ cao y (nội suy tuyến tính trên polyline trong). */
export function radiusAt(inner: P2[], y: number): number {
  if (y <= inner[0].y) return inner[0].r;
  for (let i = 1; i < inner.length; i++) {
    const a = inner[i - 1];
    const b = inner[i];
    if (y <= b.y) {
      const t = b.y - a.y > 1e-9 ? (y - a.y) / (b.y - a.y) : 1;
      return a.r + (b.r - a.r) * t;
    }
  }
  return inner[inner.length - 1].r;
}

/** Thể tích lòng từ đáy trong tới độ cao y (đơn vị³), tích phân πr² dy. */
export function volumeBelow(inner: P2[], y: number, steps = 240): number {
  const y0 = inner[0].y;
  if (y <= y0) return 0;
  const dy = (y - y0) / steps;
  let v = 0;
  for (let i = 0; i < steps; i++) {
    const r = radiusAt(inner, y0 + (i + 0.5) * dy);
    v += Math.PI * r * r * dy;
  }
  return v;
}

/** Độ cao mực chất lỏng ứng với thể tích v (đơn vị³) – tìm nhị phân. */
export function levelForVolume(inner: P2[], v: number): number {
  let lo = inner[0].y;
  let hi = inner[inner.length - 1].y;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (volumeBelow(inner, mid, 120) < v) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
