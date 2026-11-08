import * as THREE from 'three';
import type { CrystalView } from './builder';

export interface CrystalAssemblyOptions {
  /** true = tự lắp theo lịch; false = chỉ bay khi gọi launch(i). */
  auto?: boolean;
  /** Giây giữa hai ion liên tiếp. */
  stagger?: number;
  /** Nghỉ thêm giữa hai tầng. */
  layerPause?: number;
  flight?: number;
  /** Điểm xuất phát của ion i (toạ độ group của tinh thể), vd. khay theo loài ion. */
  start?(i: number): THREE.Vector3;
  /** Báo khi bắt đầu một tầng mới (k từ 0). */
  onLayer?(k: number, layers: number): void;
  onDone?(): void;
}

export interface CrystalAssembly {
  readonly layers: number;
  readonly placed: number;
  readonly done: boolean;
  /** Cho ion i bắt đầu bay ngay. */
  launch(i: number): void;
  update(dt: number): void;
  reset(): void;
  finish(): void;
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

/** Hoạt cảnh lắp tinh thể: ion bay theo cung từ khay vào nút lưới, từng tầng từ dưới lên; que nối mọc khi đủ hai đầu. */
export function createCrystalAssembly(view: CrystalView, o: CrystalAssemblyOptions = {}): CrystalAssembly {
  const n = view.sites.length;
  const stagger = o.stagger ?? 0.12;
  const flight = o.flight ?? 0.9;
  const ys = [...new Set(view.sites.map((s) => Math.round(s.pos[1] * 100)))].sort((a, b) => a - b);
  const layerOf = view.sites.map((s) => ys.indexOf(Math.round(s.pos[1] * 100)));
  const span = view.targets.reduce((m, p) => Math.max(m, p.length()), 0.5);
  const start = o.start ?? ((i: number) => view.targets[i].clone().multiplyScalar(2.2).setY(-span * 1.6));
  const starts = view.sites.map((_, i) => start(i));
  const plan: number[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0 && layerOf[i] !== layerOf[i - 1]) acc += o.layerPause ?? 0.7;
    plan.push(acc);
    acc += stagger;
  }
  const sched = new Array<number>(n).fill(Infinity);
  const mid = new THREE.Vector3();
  let t = 0;
  let lastLayer = -1;
  let finished = false;

  const apply = () => {
    let placed = 0;
    for (let i = 0; i < n; i++) {
      const u = ease((t - sched[i]) / flight);
      if (u >= 1) placed++;
      mid.lerpVectors(starts[i], view.targets[i], u);
      mid.y += Math.sin(Math.PI * Math.min(1, u)) * span * 0.5;
      view.pos[i].copy(mid);
      view.appear[i] = Math.min(1, Math.max(0, (t - sched[i]) / 0.25));
    }
    view.pairs.forEach(([a, b], j) => {
      const ready = Math.max(sched[a], sched[b]) + flight;
      view.stickAppear[j] = Math.min(1, Math.max(0, (t - ready) / 0.35));
    });
    view.commit();
    return placed;
  };

  let placedCount = 0;
  const asm: CrystalAssembly = {
    layers: ys.length,
    get placed() {
      return placedCount;
    },
    get done() {
      return finished;
    },
    launch(i) {
      if (sched[i] === Infinity) sched[i] = t;
    },
    update(dt) {
      t += dt;
      for (let i = 0; i < n; i++) {
        if (sched[i] <= t && layerOf[i] > lastLayer) {
          lastLayer = layerOf[i];
          o.onLayer?.(lastLayer, ys.length);
        }
      }
      placedCount = apply();
      if (!finished && placedCount === n && view.stickAppear.every((v) => v >= 1)) {
        finished = true;
        o.onDone?.();
      }
    },
    reset() {
      t = 0;
      lastLayer = -1;
      finished = false;
      for (let i = 0; i < n; i++) sched[i] = o.auto === false ? Infinity : plan[i];
      placedCount = apply();
    },
    finish() {
      for (let i = 0; i < n; i++) sched[i] = Math.min(sched[i], -100);
      placedCount = apply();
      if (!finished) {
        finished = true;
        o.onDone?.();
      }
    },
  };
  asm.reset();
  return asm;
}
