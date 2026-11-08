import * as THREE from 'three';
import { assemblyOrder } from './analysis';
import type { MoleculeView } from './builder';

export interface AssemblyOptions {
  /** Vị trí xuất phát của từng nguyên tử (toạ độ group), vd. ngăn hộp bộ lắp ráp. Mặc định: rải quanh phân tử. */
  starts?: THREE.Vector3[];
  /** Giây giữa hai bước. */
  stepTime?: number;
  /** Thời gian bay của một nguyên tử. */
  flight?: number;
  /** Gọi khi một bước bắt đầu (k = số thứ tự bước, atom = chỉ số nguyên tử, bonds = liên kết mọc ở bước này). */
  onStep?(k: number, atom: number, bonds: number[]): void;
  onDone?(): void;
}

export interface MoleculeAssembly {
  readonly done: boolean;
  /** Số bước đã bắt đầu. */
  readonly step: number;
  readonly steps: number;
  update(dt: number): void;
  reset(): void;
  /** Nhảy tới trạng thái lắp xong. */
  finish(): void;
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Hoạt cảnh lắp ráp: lần lượt từng nguyên tử bay theo cung vào chỗ, que nối "mọc" giữa nó và các nguyên tử đã đặt. */
export function createMoleculeAssembly(mol: MoleculeView, o: AssemblyOptions = {}): MoleculeAssembly {
  const order = assemblyOrder(mol.data);
  const stepTime = o.stepTime ?? 0.9;
  const flight = o.flight ?? 0.8;
  const span = Math.max(1, ...mol.targets.map((p) => p.length())) * 1.0;
  const starts =
    o.starts ??
    mol.targets.map((_, i) => {
      const a = (i / mol.targets.length) * Math.PI * 2 + 0.5;
      return new THREE.Vector3(Math.cos(a) * span * 2.2, -span * 0.4, Math.sin(a) * span * 1.4 + span);
    });
  const stepOf = new Map(order.map((s, k) => [s.atom, k]));
  const bondStep = new Map<number, number>();
  order.forEach((s, k) => s.bonds.forEach((b) => bondStep.set(b, k)));
  const mid = new THREE.Vector3();
  let t = 0;
  let fired = 0;
  let finished = false;

  const apply = () => {
    mol.atoms.forEach((m, i) => {
      const k = stepOf.get(i) ?? 0;
      const u = ease((t - k * stepTime) / flight);
      const from = starts[i];
      const to = mol.targets[i];
      // Cung parabol: nhấc lên rồi hạ xuống đúng chỗ.
      mid.lerpVectors(from, to, u);
      mid.y += Math.sin(Math.PI * u) * span * 0.6;
      m.position.copy(mid);
      m.userData.appear = o.starts ? 1 : Math.min(1, Math.max(0, (t - k * stepTime) / (flight * 0.3)));
    });
    mol.bonds.forEach((b, i) => {
      const k = bondStep.get(i) ?? 0;
      b.grow = ease((t - k * stepTime - flight * 0.85) / 0.35);
    });
    mol.syncBonds();
    for (const b of mol.bonds) b.pivot.visible = b.grow > 0.001;
  };

  const total = (order.length - 1) * stepTime + flight + 0.4;
  const asm: MoleculeAssembly = {
    get done() {
      return finished;
    },
    get step() {
      return fired;
    },
    steps: order.length,
    update(dt) {
      if (finished) return;
      t += dt;
      while (fired < order.length && t >= fired * stepTime) {
        o.onStep?.(fired, order[fired].atom, order[fired].bonds);
        fired++;
      }
      if (t >= total) {
        t = total;
        finished = true;
        apply();
        o.onDone?.();
        return;
      }
      apply();
    },
    reset() {
      t = 0;
      fired = 0;
      finished = false;
      apply();
    },
    finish() {
      const was = finished;
      t = total;
      fired = order.length;
      finished = true;
      apply();
      if (!was) o.onDone?.();
    },
  };
  asm.reset();
  return asm;
}
