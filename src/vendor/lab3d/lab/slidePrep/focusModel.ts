import { labText } from '../../text';
/**
 * Lấy nét kính hiển vi (thuần, µm – không three). z = độ cao bàn kính so với vị trí nét của lớp trên cùng của tiêu bản
 * (+ = gần vật kính hơn). Nâng bàn kính lên z thì mặt phẳng nét lùi xuống sâu z trong mẫu: lớp ở độ sâu L nét khi z = −L.
 * Ốc to dời nhiều (1 vòng ≈ 2 mm), ốc nhỏ dời ít (1 vòng ≈ 0,1 mm); nâng quá khoảng làm việc → vật kính chạm lamen (vỡ).
 * Rút từ TN-062-01 (vảy hành) để mọi sim làm tiêu bản dùng chung.
 */
export type FocusKnob = 'coarse' | 'fine';

export interface FocusSpec {
  /** Độ sâu trường ảnh (µm) theo vật kính (≈ λn/NA²). */
  dof: Record<number, number>;
  /** Khoảng làm việc (µm) theo vật kính: nâng bàn kính quá mức này → chạm lamen. */
  wd: Record<number, number>;
  /** µm bàn kính dời mỗi vòng ốc (mặc định ốc to 2000, ốc nhỏ 100). */
  turn?: Partial<Record<FocusKnob, number>>;
  /** Vật kính "đồng tiêu" gần đúng: đổi vật kính lệch nét chừng này µm (mặc định 3). */
  parfocal?: number;
  /** Bàn kính lúc mới đặt tiêu bản (µm, mặc định −390: còn thấp, ảnh chưa hiện). */
  start?: number;
  /** Độ sâu các lớp tế bào có thể nét (µm, ≤ 0) – mẫu dày/gấp có nhiều lớp. Mặc định [0]. */
  layers?(): readonly number[];
}

export interface FocusHooks {
  /** Vật kính đang dùng (10, 40, 100…). */
  obj(): number;
  /** Cảnh báo (vặn ốc to ở vật kính lớn, lamen đã vỡ). */
  warn(text: string): void;
  /** Vật kính chạm lamen. */
  crash(): void;
}

export interface FocusModel {
  readonly z: number;
  readonly broken: boolean;
  /** Phần mỗi ốc đã dời (µm) – để vòng ốc quay đúng góc. */
  readonly pos: Record<FocusKnob, number>;
  readonly turn: Record<FocusKnob, number>;
  reset(z?: number): void;
  /** Vặn ốc `k` dời bàn kính dz µm (+ = nâng lại gần vật kính). */
  move(k: FocusKnob, dz: number): void;
  /** Đổi vật kính (lệch nét đồng tiêu). */
  objective(from: number, to: number): void;
  /** Độ lệch nét (µm) của lớp gần nét nhất. */
  off(): number;
  sharp(): boolean;
  /** Độ nhoè ảnh (px) theo độ lệch nét. */
  blur(maxPx?: number): number;
  /** Lời nhắc ngắn khi ảnh chưa nét. */
  hint(): string;
}

const BROKEN = labText('t_70dca889dd71');
const COARSE_HI = labText('t_dabd23e2d605');

export function createFocusModel(spec: FocusSpec, h: FocusHooks): FocusModel {
  const turn: Record<FocusKnob, number> = { coarse: spec.turn?.coarse ?? 2000, fine: spec.turn?.fine ?? 100 };
  const start = spec.start ?? -390;
  const layers = spec.layers ?? (() => [0]);
  const pos: Record<FocusKnob, number> = { coarse: start, fine: 0 };
  let z = start;
  let broken = false;
  let warned = -1e9;
  const dofOf = () => spec.dof[h.obj()] ?? 1;
  const off = () => Math.min(...layers().map((L) => Math.abs(z + L)));
  const m: FocusModel = {
    get z() {
      return z;
    },
    get broken() {
      return broken;
    },
    pos,
    turn,
    reset(to = start) {
      z = to;
      broken = false;
      pos.coarse = to;
      pos.fine = 0;
    },
    move(k, dz) {
      if (broken) return h.warn(BROKEN);
      const now = Date.now();
      if (k === 'coarse' && h.obj() >= 40 && dz !== 0 && now - warned > 2500) {
        warned = now;
        h.warn(COARSE_HI);
      }
      pos[k] += dz;
      z += dz;
      const wd = spec.wd[h.obj()] ?? 1e9;
      if (z >= wd) {
        z = wd;
        broken = true;
        h.crash();
      }
    },
    objective(from, to) {
      if (!broken && from !== to) z += (to > from ? 1 : -1) * (spec.parfocal ?? 3);
    },
    off,
    sharp: () => !broken && off() <= dofOf() / 2,
    blur: (max = 14) => (broken ? max : Math.min(max, Math.max(0, off() / dofOf() - 0.5) * 2.5)),
    hint() {
      const d = off();
      if (broken) return BROKEN;
      if (h.obj() >= 40) return `${labText('t_a05b92804be5')}${Math.round(d)}${labText('t_443e9cd4e1de')}${dofOf().toLocaleString('vi-VN')} µm).`;
      if (d > 60) return `${labText('t_1a2c48e3e3e8')}${z < 0 ? labText('t_54a906337615') : labText('t_580ec0d26922')}${labText('t_da012d7e38d3')}${Math.round(d)}${labText('t_cc3b6f6e3143')}`;
      return `${labText('t_a05b92804be5')}${Math.round(d)}${labText('t_9f90de0b0c38')}`;
    },
  };
  return m;
}
