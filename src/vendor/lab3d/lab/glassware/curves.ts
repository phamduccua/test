import type { P2 } from '../types';

/** Làm tròn góc polyline bằng Chaikin (giữ 2 đầu mút). */
export function chaikin(pts: P2[], iterations = 3): P2[] {
  let cur = pts;
  for (let k = 0; k < iterations; k++) {
    const next: P2[] = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i];
      const b = cur[i + 1];
      next.push({ r: a.r * 0.75 + b.r * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ r: a.r * 0.25 + b.r * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(cur[cur.length - 1]);
    cur = next;
  }
  return cur;
}

/** Cung tròn tâm (cr, cy), bán kính R, góc a0 → a1 (rad), n đoạn (gồm cả 2 đầu). */
export function arc(cr: number, cy: number, R: number, a0: number, a1: number, n: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push({ r: cr + Math.cos(a) * R, y: cy + Math.sin(a) * R });
  }
  return out;
}

/** Chia nhỏ polyline để mỗi đoạn ≤ maxLen (giúp offset/meniscus mượt). */
export function densify(pts: P2[], maxLen: number): P2[] {
  const out: P2[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.r - a.r, b.y - a.y) / maxLen));
    for (let k = 1; k <= n; k++) out.push({ r: a.r + ((b.r - a.r) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

/** Bỏ điểm trùng nhau liên tiếp. */
export function dedupe(pts: P2[], eps = 1e-6): P2[] {
  return pts.filter((p, i) => i === 0 || Math.hypot(p.r - pts[i - 1].r, p.y - pts[i - 1].y) > eps);
}

/**
 * Dịch polyline (đi từ đáy lên miệng) vào trong một khoảng d theo pháp tuyến.
 * Pháp tuyến ngoài của đoạn đi lên là (t.y, −t.x). Bán kính bị kẹp ≥ 0.
 */
export function offsetInward(pts: P2[], d: number): P2[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let tr = b.r - a.r;
    let ty = b.y - a.y;
    const len = Math.hypot(tr, ty) || 1;
    tr /= len;
    ty /= len;
    const r = Math.max(0, p.r - ty * d);
    return { r: p.r === 0 ? 0 : r, y: p.y + tr * d };
  });
}
