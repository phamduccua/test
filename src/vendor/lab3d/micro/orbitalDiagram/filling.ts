/**
 * Mô hình điền electron vào ô orbital (thuần): nguyên lí Pauli, nguyên lí vững bền (Aufbau), quy tắc Hund.
 * Thứ tự ô = thứ tự phân lớp truyền vào, mỗi phân lớp có ORBITALS_PER[l] ô liền nhau.
 */
import { CAPACITY, energyRank, ORBITALS_PER, subName, sup, type Spin, type SubshellId } from './subshell';
import { labText } from '../../text';

export interface OrbitalSlot {
  /** Chỉ số phân lớp trong `subs`. */
  sub: number;
  /** Thứ tự ô trong phân lớp. */
  k: number;
  /** Các electron trong ô theo thứ tự vào (≤ 2). */
  spins: Spin[];
}
export type Rule = 'full' | 'pauli' | 'aufbau' | 'hund-pair' | 'hund-spin';
export interface Verdict {
  ok: boolean;
  rule?: Rule;
  /** Thông báo (tiếng Việt) – lỗi hoặc ghi chú. */
  text: string;
  /** Ô thấp hơn còn trống (khi vi phạm vững bền) – nơi electron sẽ "rơi" về. */
  lower?: number;
}
export interface Placement {
  slot: number;
  spin: Spin;
}
export interface RuleSet {
  aufbau?: boolean;
  hund?: boolean;
}

export interface FillingModel {
  readonly subs: SubshellId[];
  readonly slots: OrbitalSlot[];
  readonly history: Placement[];
  slotsOf(sub: number): number[];
  /** Kiểm tra thêm 1 electron `spin` vào ô `slot` (không đổi trạng thái). */
  check(slot: number, spin: Spin, rules?: RuleSet): Verdict;
  add(slot: number, spin: Spin): void;
  removeLast(): Placement | null;
  /** Bỏ electron sau cùng trong ô. */
  removeFrom(slot: number): Placement | null;
  clear(): void;
  /** Vị trí electron tiếp theo ở trạng thái cơ bản (vững bền + Hund). */
  next(): Placement | null;
  /** Xoá rồi điền `count` electron theo trạng thái cơ bản; trả các bước. */
  fill(count: number): Placement[];
  total(): number;
  subCount(sub: number): number;
  unpaired(sub?: number): number;
  /** Chuỗi kí hiệu theo thứ tự năng lượng: "1s²2s²2p⁴" (joiner mặc định ''). */
  notation(joiner?: string): string;
}

export function createFilling(subs: SubshellId[]): FillingModel {
  const slots: OrbitalSlot[] = [];
  const bySub: number[][] = subs.map((s, i) =>
    Array.from({ length: ORBITALS_PER[s.l] }, (_, k) => slots.push({ sub: i, k, spins: [] }) - 1),
  );
  const order = subs.map((_, i) => i).sort((a, b) => energyRank(subs[a]) - energyRank(subs[b]));
  const history: Placement[] = [];
  const count = (sub: number) => bySub[sub].reduce((a, j) => a + slots[j].spins.length, 0);
  const isFull = (sub: number) => count(sub) >= CAPACITY(subs[sub].l);

  const m: FillingModel = {
    subs,
    slots,
    history,
    slotsOf: (sub) => bySub[sub],
    check(slot, spin, rules = {}) {
      const s = slots[slot];
      const sub = subs[s.sub];
      const name = subName(sub);
      if (s.spins.length >= 2) return { ok: false, rule: 'full', text: labText('t_c510f622774f') };
      if (s.spins.length === 1 && s.spins[0] === spin)
        return {
          ok: false,
          rule: 'pauli',
          text: labText('t_25747ed18130'),
        };
      if (rules.aufbau !== false) {
        const lowerSub = order.find((i) => energyRank(subs[i]) < energyRank(sub) && !isFull(i));
        if (lowerSub !== undefined) {
          const lower = m.next();
          return {
            ok: false,
            rule: 'aufbau',
            text: `${labText('t_0038d5355f3c')}${subName(subs[lowerSub])}${labText('t_56fe7009c559')}${name}${labText('t_3c3cfd381743')}`,
            lower: lower?.slot,
          };
        }
      }
      if (rules.hund !== false) {
        const mates = bySub[s.sub].filter((j) => j !== slot);
        if (s.spins.length === 1 && mates.some((j) => slots[j].spins.length === 0))
          return {
            ok: false,
            rule: 'hund-pair',
            text: `${labText('t_898ff1dbfc90')}${name}${labText('t_4fc388ea5be8')}`,
          };
        if (s.spins.length === 0 && mates.some((j) => slots[j].spins.length === 1 && slots[j].spins[0] !== spin))
          return {
            ok: false,
            rule: 'hund-spin',
            text: `${labText('t_ef3589cb2d2c')}${name}${labText('t_813a413fce55')}`,
          };
      }
      if (s.spins.length === 0 && spin === -1)
        return { ok: true, text: labText('t_6cd42c40d7cb') };
      return { ok: true, text: '' };
    },
    add(slot, spin) {
      slots[slot].spins.push(spin);
      history.push({ slot, spin });
    },
    removeLast() {
      const p = history.pop() ?? null;
      if (p) {
        const sp = slots[p.slot].spins;
        sp.splice(sp.lastIndexOf(p.spin), 1);
      }
      return p;
    },
    removeFrom(slot) {
      const sp = slots[slot].spins;
      const spin = sp.pop();
      if (spin === undefined) return null;
      const h = history.map((x) => x.slot).lastIndexOf(slot);
      if (h >= 0) history.splice(h, 1);
      return { slot, spin };
    },
    clear() {
      slots.forEach((s) => (s.spins.length = 0));
      history.length = 0;
    },
    next() {
      for (const i of order) {
        if (isFull(i)) continue;
        const ids = bySub[i];
        const empty = ids.find((j) => slots[j].spins.length === 0);
        if (empty !== undefined) return { slot: empty, spin: 1 };
        const single = ids.find((j) => slots[j].spins.length === 1);
        if (single !== undefined) return { slot: single, spin: (-slots[single].spins[0]) as Spin };
      }
      return null;
    },
    fill(n) {
      m.clear();
      const steps: Placement[] = [];
      for (let i = 0; i < n; i++) {
        const p = m.next();
        if (!p) break;
        m.add(p.slot, p.spin);
        steps.push(p);
      }
      return steps;
    },
    total: () => slots.reduce((a, s) => a + s.spins.length, 0),
    subCount: count,
    unpaired: (sub) => slots.filter((s) => (sub === undefined || s.sub === sub) && s.spins.length === 1).length,
    notation: (joiner = '') =>
      order
        .filter((i) => count(i) > 0)
        .map((i) => `${subName(subs[i])}${sup(count(i))}`)
        .join(joiner),
  };
  return m;
}
