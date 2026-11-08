/** Bố trí quỹ đạo electron (thuần): bán kính, hướng mặt phẳng vòng, số electron, tốc độ góc. */
import { fibonacciSphere, seeded, type Vec3 } from './packing';

export interface OrbitSpec {
  radius: number;
  /** Pháp tuyến mặt phẳng vòng (đơn vị). */
  normal: Vec3;
  /** Góc quay quanh pháp tuyến (đổi điểm xuất phát). */
  spin: number;
  electrons: number;
  /** Tốc độ góc (rad/s) ở tốc độ 1×. */
  omega: number;
  /** Pha ban đầu của electron đầu tiên. */
  phase: number;
}

export type OrbitArrangement = 'planar' | 'tilted';

export interface LayoutOptions {
  arrangement?: OrbitArrangement;
  firstRadius: number;
  gap: number;
  /** Tốc độ góc lớp trong cùng. */
  omega?: number;
  /** Độ nghiêng chung (rad) của mặt phẳng các vòng khi 'planar'. */
  tilt?: number;
  seed?: number;
  /** 'tilted': dao động ngẫu nhiên bán kính ± (tỉ lệ). */
  radiusJitter?: number;
}

/**
 * - 'planar': các lớp electron đồng tâm trong cùng một mặt phẳng (mô hình Bohr của SGK).
 * - 'tilted': mỗi vòng một hướng (kiểu "hành tinh" trên bìa sách), pháp tuyến rải đều trên bán cầu.
 */
export function layoutOrbits(shells: number[], o: LayoutOptions): OrbitSpec[] {
  const rnd = seeded(o.seed ?? 3);
  const w0 = o.omega ?? 1.6;
  if (o.arrangement === 'tilted') {
    const normals = fibonacciSphere(shells.length * 2, 0.4).filter((p) => p[1] >= -1e-6).slice(0, shells.length);
    return shells.map((e, i) => {
      const jitter = 1 + (o.radiusJitter ?? 0) * (rnd() * 2 - 1);
      const radius = (o.firstRadius + o.gap * i) * jitter;
      return {
        radius,
        normal: normals[i] ?? [0, 1, 0],
        spin: rnd() * Math.PI * 2,
        electrons: e,
        omega: (w0 * (i % 2 ? -1 : 1)) / Math.pow(radius / o.firstRadius, 1.2),
        phase: rnd() * Math.PI * 2,
      };
    });
  }
  const t = o.tilt ?? 0;
  const normal: Vec3 = [0, Math.cos(t), Math.sin(t)];
  return shells.map((e, i) => {
    const radius = o.firstRadius + o.gap * i;
    return { radius, normal, spin: 0, electrons: e, omega: w0 / Math.pow(radius / o.firstRadius, 1.5), phase: i * 0.7 };
  });
}

/** Mẫu bán kính theo mật độ xác suất 1s: P(r) ∝ r²·e^(−2r/a0) (lấy mẫu Gamma(3) bằng tổng 3 mũ). */
export function sample1sRadius(rnd: () => number, a0: number): number {
  const u = (1 - rnd()) * (1 - rnd()) * (1 - rnd());
  return (-Math.log(u) * a0) / 2;
}
