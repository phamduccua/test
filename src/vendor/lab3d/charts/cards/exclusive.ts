/**
 * Nhóm thẻ "chỉ mở một" của `createResultCard({ exclusive })`: khung hẹp (< `below` px) không đủ chỗ cho hai thẻ mở cùng lúc
 * (vd. bảng kết quả dưới trái + đồ thị dưới phải) → thẻ mở sau cùng giữ, các thẻ khác cùng nhóm thu gọn (không ghi vào phiên).
 */
interface Member {
  /** Thứ tự mở gần nhất (lớn hơn = mở sau). */
  at: number;
  open(): boolean;
  fold(): void;
}

const groups = new WeakMap<HTMLElement, Map<string, Set<Member>>>();
let seq = 0;

export function joinExclusive(root: HTMLElement, name: string, m: Omit<Member, 'at'>) {
  const byName = groups.get(root) ?? new Map<string, Set<Member>>();
  groups.set(root, byName);
  const set = byName.get(name) ?? new Set<Member>();
  byName.set(name, set);
  const me: Member = { ...m, at: ++seq };
  set.add(me);
  return {
    /** Thẻ vừa mở (bấm tiêu đề hoặc sim gọi setCollapsed(false)). */
    opened: () => void (me.at = ++seq),
    /** Gọi khi đặt chỗ: khung hẹp + thẻ này mở → thu gọn các thẻ cùng nhóm đã mở trước nó. */
    enforce(width: number, below = 1000) {
      if (width >= below || !me.open()) return;
      for (const x of set) if (x !== me && x.open() && x.at < me.at) x.fold();
    },
    leave: () => void set.delete(me),
  };
}
