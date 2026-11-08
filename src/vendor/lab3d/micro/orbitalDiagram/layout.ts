/** Bố cục ô orbital (thuần): hàng ngang kiểu sách, thang mức năng lượng. Toạ độ tâm phân lớp theo đơn vị cảnh. */
import { energyRank, L_INDEX, ORBITALS_PER, subName, type SubshellId } from './subshell';

export interface SubCenter {
  x: number;
  y: number;
  z: number;
}

/** Bề rộng một phân lớp (các ô liền nhau). */
export const subWidth = (s: SubshellId, box: number) => ORBITALS_PER[s.l] * box;

/** Vị trí ô thứ k của phân lớp quanh tâm (x lệch). */
export const slotOffset = (s: SubshellId, k: number, box: number) => (k - (ORBITALS_PER[s.l] - 1) / 2) * box;

/**
 * Mức năng lượng minh hoạ (tương đối, không theo thang thực): cùng phân lớp ngang nhau, 4s thấp hơn 3d.
 * Khoảng cách giữa các lớp lớn hơn khoảng cách s–p trong một lớp.
 */
export const LADDER_ENERGY: Record<string, number> = {
  '1s': 0, '2s': 1.7, '2p': 2.35, '3s': 3.45, '3p': 4.05, '4s': 4.95, '3d': 5.45, '4p': 6.2, '5s': 7.05, '4d': 7.5, '5p': 8.2,
};
export const ladderEnergy = (s: SubshellId) => LADDER_ENERGY[subName(s)] ?? energyRank(s) * 0.9;

/** Hàng ngang như sách (↑↓ ↑↓ ↑ ↑ ↑): phân lớp nối tiếp, cách nhau `gap`, căn giữa quanh x = 0. */
export function placeRow(subs: SubshellId[], o: { box: number; gap?: number; y?: number }): SubCenter[] {
  const gap = o.gap ?? o.box * 0.45;
  const total = subs.reduce((a, s) => a + subWidth(s, o.box), 0) + gap * Math.max(0, subs.length - 1);
  let x = -total / 2;
  return subs.map((s) => {
    const w = subWidth(s, o.box);
    const c = { x: x + w / 2, y: o.y ?? 0, z: 0 };
    x += w + gap;
    return c;
  });
}

/**
 * Thang năng lượng: trục dọc = năng lượng, cột theo loại phân lớp (s | p | d). `yScale` = đv cảnh / 1 bậc minh hoạ,
 * `columns` = toạ độ x của cột s, p, d, f. Đáy (1s) ở y = 0.
 */
export function placeLadder(
  subs: SubshellId[],
  o: { box: number; yScale?: number; columns?: number[] },
): SubCenter[] {
  const cols = o.columns ?? [0, o.box * 3.2, o.box * 7.4, o.box * 12.6];
  const k = o.yScale ?? o.box * 1.25;
  return subs.map((s) => ({ x: cols[L_INDEX[s.l]], y: ladderEnergy(s) * k, z: 0 }));
}

/** Khung bao các tâm (để đặt camera). */
export function boundsOf(subs: SubshellId[], centers: SubCenter[], box: number) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  centers.forEach((c, i) => {
    const w = subWidth(subs[i], box) / 2;
    x0 = Math.min(x0, c.x - w);
    x1 = Math.max(x1, c.x + w);
    y0 = Math.min(y0, c.y - box / 2);
    y1 = Math.max(y1, c.y + box / 2);
  });
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}
