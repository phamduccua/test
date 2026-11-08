import type { P2 } from '../types';
import { mm } from '../units';
import { arc, chaikin, densify } from './curves';
import { buildProfile, type VesselProfile } from './profile';

/** Các profile dụng cụ thuỷ tinh theo kích thước thực (mm, Phần V §5.1). Thuần, không phụ thuộc three. */
const P = (r: number, y: number): P2 => ({ r: mm(r), y: mm(y) });
const smooth = (pts: P2[], it = 3) => densify(chaikin(pts, it), mm(3));

/** Ống nghiệm Ø16×160, đáy bán cầu, miệng loe nhẹ. */
export function testTubeProfile(diameter = 16, length = 160, wall = 0.9): VesselProfile {
  const R = diameter / 2;
  const bottom = arc(0, mm(R), mm(R), -Math.PI / 2, 0, 12);
  const body = [P(R, length - 4), P(R + 0.3, length - 1.2), P(R + 0.55, length)];
  return buildProfile(densify([...bottom, ...body], mm(4)), mm(wall));
}

/** Cốc có mỏ: thân trụ, đáy phẳng bo nhỏ. Mỏ rót tạo riêng (beaker.ts) vì không tròn xoay. */
export function beakerProfile(diameter: number, height: number, wall: number): VesselProfile {
  const R = diameter / 2;
  const c = Math.min(6, R * 0.15);
  const pts = [P(0, 0), P(R - c, 0), P(R, 0), P(R, c), P(R, height - 3), P(R + 0.6, height - 0.8), P(R + 1, height)];
  return buildProfile(smooth(pts, 3), mm(wall));
}

export const BEAKER_SIZES = {
  50: { d: 42, h: 58, wall: 1 },
  100: { d: 50, h: 70, wall: 1.1 },
  150: { d: 60, h: 82, wall: 1.2 },
  250: { d: 70, h: 95, wall: 1.3 },
  500: { d: 88, h: 122, wall: 1.5 },
  1000: { d: 108, h: 145, wall: 1.8 },
} as const;
export type BeakerSize = keyof typeof BEAKER_SIZES;

/** Cỡ bình tam giác (mm): bán kính đáy, cao, bán kính cổ, dài cổ. */
export const ERLENMEYER_SIZES = {
  50: { Rb: 25.5, H: 88, rn: 10, neck: 20 },
  100: { Rb: 32, H: 105, rn: 11, neck: 22 },
  250: { Rb: 42.5, H: 142, rn: 17, neck: 28 },
  500: { Rb: 52, H: 176, rn: 17, neck: 32 },
} as const;
export type ErlenmeyerSize = keyof typeof ERLENMEYER_SIZES;

/** Bình tam giác (Erlenmeyer) 50/100/250/500 mL. */
export function erlenmeyerProfile(size: ErlenmeyerSize = 250): VesselProfile {
  const s = ERLENMEYER_SIZES[size];
  const shoulder = s.H - s.neck;
  const pts = [
    P(0, 0), P(s.Rb - 6, 0), P(s.Rb, 0.5), P(s.Rb, 5), P(s.rn + 4, shoulder - 3), P(s.rn, shoulder + 3),
    P(s.rn, s.H - 4), P(s.rn + 1.6, s.H - 2), P(s.rn + 1.6, s.H),
  ];
  return buildProfile(smooth(pts, 3), mm(1.4));
}

/** Bình cầu đáy tròn (hoặc đáy bằng nếu flatBottom). */
export function roundFlaskProfile(diameter = 85, neckD = 30, neckLen = 80, flatBottom = false): VesselProfile {
  const R = diameter / 2;
  const rn = neckD / 2;
  const aNeck = Math.acos(rn / R);
  const a0 = flatBottom ? -Math.acos((R * 0.45) / R) : -Math.PI / 2;
  const sphere = arc(0, mm(R), mm(R), a0, aNeck, 28);
  if (flatBottom) sphere.unshift(P(0, R + R * Math.sin(a0)));
  const yNeck = R + R * Math.sin(aNeck);
  const neck = [P(rn, yNeck + 6), P(rn, yNeck + neckLen - 3), P(rn + 1.4, yNeck + neckLen - 1.5), P(rn + 1.4, yNeck + neckLen)];
  return buildProfile(densify([...sphere, ...neck], mm(4)), mm(1.2));
}

/** Ống đong: thân trụ dài (đế lục giác tạo riêng). Đáy trong cao hơn để chừa chân đế. */
export function cylinderProfile(diameter = 30, height = 250, wall = 1.1): VesselProfile {
  const R = diameter / 2;
  const pts = [P(0, 0), P(R - 2, 0), P(R, 0), P(R, 3), P(R, height - 5), P(R + 1.2, height - 1), P(R + 3, height)];
  return buildProfile(smooth(pts, 3), mm(wall));
}

/** Phễu 60° với cuống – profile hở hai đầu. */
export function funnelProfile(mouthD = 70, stemLen = 75, stemD = 8): VesselProfile {
  const R = mouthD / 2;
  const rs = stemD / 2;
  const coneH = (R - rs) / Math.tan(Math.PI / 6);
  const pts = [P(rs - 0.6, 0), P(rs, 2), P(rs, stemLen), P(rs + 2, stemLen + 3), P(R - 3, stemLen + coneH - 2), P(R, stemLen + coneH + 1), P(R + 1.5, stemLen + coneH + 2)];
  return buildProfile(smooth(pts, 2), mm(1.2), true);
}

/** Đĩa petri Ø90×15 (nửa dưới). */
export function petriProfile(d = 90, h = 13): VesselProfile {
  const R = d / 2;
  return buildProfile(smooth([P(0, 0), P(R - 2, 0), P(R, 0.5), P(R, h)], 2), mm(1));
}
