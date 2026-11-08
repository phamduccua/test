import { sampleGrid, type ScalarGrid } from './grid';
import { orbitalPsi, radiusEnclosing, type OrbitalQN, type Psi } from './hydrogen';
import { BOOK_FRAME, psiInScene, type AxisFrame } from './frame';

/** Lưới ψ của một orbital theo toạ độ CẢNH (thuần, có nhớ đệm). */
export interface OrbitalGridOptions {
  /** Số nút mỗi chiều (mặc định 64 → 64³). */
  resolution?: number;
  /** Đơn vị cảnh trên mỗi a₀. */
  unitsPerA0?: number;
  frame?: AxisFrame;
  /** Xác suất bao của quả cầu xác định nửa cạnh lưới (mặc định 0,995). */
  cover?: number;
  /** Đổi dấu toàn cục (dấu ψ tuỳ ý) để lớp ngoài cùng mang pha dương – vd. 2s có vỏ ngoài dương như 1s. */
  outerPositive?: boolean;
}

export interface OrbitalField {
  qn: OrbitalQN;
  /** ψ theo toạ độ cảnh. */
  psi: Psi;
  grid: ScalarGrid;
  /** Nửa cạnh lưới (đv cảnh). */
  half: number;
}

const cache = new Map<string, OrbitalField>();
const MAX_CACHE = 14;
const frameIds = new WeakMap<AxisFrame, number>();
let nextFrameId = 0;

/** Lấy (hoặc tính) lưới ψ_nlm 3D để dựng mặt đẳng trị / mây điểm. */
export function orbitalField(qn: OrbitalQN, o: OrbitalGridOptions = {}): OrbitalField {
  const res = o.resolution ?? 64;
  const u = o.unitsPerA0 ?? 1;
  const frame = o.frame ?? BOOK_FRAME;
  const cover = o.cover ?? 0.995;
  if (!frameIds.has(frame)) frameIds.set(frame, nextFrameId++);
  const flip = o.outerPositive && (qn.n - qn.l - 1) % 2 === 1 ? -1 : 1;
  const key = `${qn.n},${qn.l},${qn.m},${qn.Z ?? 1}|${res}|${u}|${frameIds.get(frame)}|${cover}|${flip}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const base = orbitalPsi(qn);
  const psi = psiInScene(flip > 0 ? base : (x, y, z) => -base(x, y, z), frame, u);
  const half = radiusEnclosing(qn.n, qn.l, cover, qn.Z ?? 1) * u;
  const field: OrbitalField = { qn, psi, grid: sampleGrid(psi, res, half), half };
  cache.set(key, field);
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
  return field;
}
