import { offsetInward } from '../glassware/curves';
import { radiusAt } from '../glassware/profile';
import type { P2 } from '../types';
import { mm } from '../units';

export interface LiquidShape {
  /** Profile kín cho Lathe (từ tâm đáy → thành → mặt khum → tâm mặt thoáng). */
  points: P2[];
  /** Bán kính mặt thoáng tại thành. */
  surfaceRadius: number;
}

/** Lòng chất lỏng = mặt trong dụng cụ co thêm `gap` (tránh z-fighting với kính). */
export function liquidInner(inner: P2[], gap = mm(0.15)): P2[] {
  return offsetInward(inner, gap);
}

/**
 * Profile khối chất lỏng tới mực `level` (độ cao tâm mặt thoáng).
 * Mặt khum lõm (nước): z(d) = h_m·e^(−d/l_c), l_c ≈ 2,7 mm. `meniscus` âm = mặt lồi (thuỷ ngân).
 */
export function liquidShape(inner: P2[], level: number, meniscus = mm(2.5), lc = mm(2.7)): LiquidShape | null {
  const bottom = inner[0].y;
  const top = inner[inner.length - 1].y;
  if (level <= bottom + mm(0.3)) return null;
  const rTop = radiusAt(inner, Math.min(level, top));
  const hm = Math.sign(meniscus) * Math.min(Math.abs(meniscus), rTop * 0.45);
  const yWall = Math.min(top - mm(0.5), level + Math.max(0, hm));
  const yCenter = Math.min(yWall - Math.max(0, hm), top - mm(0.5)) + Math.max(0, -hm);
  const pts: P2[] = [];
  for (const p of inner) {
    if (p.y >= yWall) break;
    pts.push(p);
  }
  const R = radiusAt(inner, yWall);
  pts.push({ r: R, y: yWall });
  const N = 18;
  for (let k = 1; k <= N; k++) {
    const d = R * (k / N) ** 1.6;
    const shape = Math.exp(-d / lc);
    const y = yCenter + hm * shape;
    pts.push({ r: Math.max(0, R - d), y });
  }
  pts[pts.length - 1] = { r: 0, y: pts[pts.length - 1].y };
  return { points: pts, surfaceRadius: R };
}
