import { buildProfile, type VesselProfile } from '../glassware/profile';
import { createVessel, type Vessel } from '../glassware/vessel';
import type { Tracker } from '../types';
import { mm } from '../units';

/** Profile mặt kính đồng hồ: chỏm cầu nông đường kính d (mm), sâu h (mm). */
export function watchGlassProfile(d = 80, h = 9): VesselProfile {
  const R = d / 2;
  const rho = (R * R + h * h) / (2 * h); // bán kính cầu
  const pts = Array.from({ length: 17 }, (_, i) => {
    const r = (R * i) / 16;
    return { r: mm(r), y: mm(rho - Math.sqrt(rho * rho - r * r)) };
  });
  return buildProfile(pts, mm(1.2));
}

/** Mặt kính đồng hồ (đựng chất rắn để cân / chuyển). Gốc ở đáy; `surfaceY(r)` = độ cao mặt trong tại bán kính r (đv). */
export function createWatchGlass(ctx: Tracker, d = 80, h = 9): Vessel & { surfaceY(r: number): number } {
  const profile = watchGlassProfile(d, h);
  const v = createVessel(ctx, profile, { name: 'watch-glass' });
  const R = mm(d / 2);
  const H = mm(h);
  const rho = (R * R + H * H) / (2 * H);
  return { ...v, surfaceY: (r: number) => mm(1.2) + rho - Math.sqrt(Math.max(0, rho * rho - Math.min(r, R) ** 2)) };
}
