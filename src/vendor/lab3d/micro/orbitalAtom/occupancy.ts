/**
 * Ô orbital ↔ AO thật (thuần, không three): ô thứ k của phân lớp p là px, py, pz (như sách), kích thước hiển thị theo lớp n.
 */
import type { OrbitalQN } from '../orbital/hydrogen';
import { L_INDEX, type SubshellId } from '../orbitalDiagram/subshell';

/** m thực của ô thứ k: p → px (m = 1), py (m = −1), pz (m = 0); s → 0; d theo thứ tự xy, yz, z², xz, x²−y². */
const M_ORDER: Record<string, number[]> = { s: [0], p: [1, -1, 0], d: [-2, -1, 0, 1, 2], f: [-3, -2, -1, 0, 1, 2, 3] };

export function slotQN(s: SubshellId, k: number): OrbitalQN {
  return { n: s.n, l: L_INDEX[s.l], m: M_ORDER[s.l][k] ?? 0 };
}

const P_AXES = ['x', 'y', 'z'];
/** "1s", "2px", "3pz"… */
export function slotAOName(s: SubshellId, k: number): string {
  if (s.l === 's') return `${s.n}s`;
  if (s.l === 'p') return `${s.n}p${P_AXES[k]}`;
  return `${s.n}${s.l}${k + 1}`;
}

/** Bán kính hiển thị (đv cảnh, bội số `r1`) của mặt bao 90 % các AO lớp n – nén lại để lớp trong vẫn thấy. */
export const shellRadius = (n: number, r1: number) => r1 * [1, 2.05, 2.85, 3.45][Math.min(4, n) - 1];

/** Màu riêng cho px, py, pz (để phân biệt ba AO p trong không gian); s dùng màu phân lớp. */
export const P_AXIS_COLORS = [0xffc94a, 0x86e07a, 0xc29bff] as const;
export const slotColor = (s: SubshellId, k: number, fallback: number) => (s.l === 'p' ? P_AXIS_COLORS[k] ?? fallback : fallback);

/** Độ hiện của AO theo số electron (0 → ẩn/ma, 1 → vừa, 2 → đậm). */
export function aoOpacity(electrons: number, focus: 'on' | 'off' | 'none', ghost: boolean, l: SubshellId['l'] = 'p'): number {
  // AO s bao quanh các AO p cùng lớp → hiện nhạt hơn để thấy hình p bên trong.
  const k = l === 's' && focus !== 'on' ? 0.5 : 1;
  const base = (electrons === 0 ? (ghost ? 0.06 : 0) : electrons === 1 ? 0.3 : 0.46) * k;
  if (focus === 'on') return Math.max(base, 0.2) + 0.16;
  if (focus === 'off') return base * 0.22;
  return base;
}
