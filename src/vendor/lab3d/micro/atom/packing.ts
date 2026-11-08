/** Xếp chặt N quả cầu (nucleon) thành một khối cầu – thuần, không import three. */
export type Vec3 = [number, number, number];

/** PRNG có hạt giống (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** N điểm phân bố đều trên mặt cầu đơn vị (xoắn Fibonacci). */
export function fibonacciSphere(n: number, phase = 0): Vec3[] {
  const out: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const t = golden * i + phase;
    out.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  return out;
}

/** Bán kính khối cầu chứa N quả cầu bán kính r (mật độ xếp ≈ 0,64 – xếp ngẫu nhiên chặt). */
export function clusterRadius(n: number, r: number): number {
  return r * Math.cbrt(n / 0.64);
}

/**
 * Vị trí N quả cầu bán kính r xếp chặt quanh gốc: khởi tạo theo các lớp Fibonacci đồng tâm
 * rồi "thả lỏng" (đẩy chồng lấn + hút nhẹ về tâm) cho khối tròn, đều, không chồng nhau.
 */
export function packSpheres(n: number, r = 1, iterations = 80): Vec3[] {
  if (n <= 0) return [];
  if (n === 1) return [[0, 0, 0]];
  const pts: Vec3[] = [];
  // Lớp vỏ: lớp ngoài cùng bán kính R − r, các lớp trong cách nhau ~1,7r, số hạt ∝ diện tích.
  const R = clusterRadius(n, r);
  const shells: number[] = [];
  for (let s = R - r; s > 0.3 * r; s -= 1.7 * r) shells.push(s);
  const area = shells.reduce((a, s) => a + s * s, 0);
  let left = n;
  shells.forEach((s, i) => {
    const k = i === shells.length - 1 ? left : Math.min(left, Math.round((n * s * s) / area));
    for (const p of fibonacciSphere(k, i * 1.3)) pts.push([p[0] * s, p[1] * s, p[2] * s]);
    left -= k;
  });
  if (left > 0) for (const p of fibonacciSphere(left, 0.7)) pts.push([p[0] * 0.3 * r, p[1] * 0.3 * r, p[2] * 0.3 * r]);

  const d2 = 2 * r;
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      for (let j = i + 1; j < n; j++) {
        const b = pts[j];
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        if (d >= d2) continue;
        const push = ((d2 - d) / d) * 0.5;
        a[0] -= dx * push; a[1] -= dy * push; a[2] -= dz * push;
        b[0] += dx * push; b[1] += dy * push; b[2] += dz * push;
      }
    }
    const pull = 0.04 * (1 - it / iterations);
    for (const p of pts) {
      p[0] *= 1 - pull; p[1] *= 1 - pull; p[2] *= 1 - pull;
    }
  }
  return pts;
}

/** Gán proton/neutron xen kẽ đều (true = proton), ổn định theo hạt giống. */
export function assignProtons(total: number, protons: number, seed = 7): boolean[] {
  const flags = Array.from({ length: total }, (_, i) => i < protons);
  const rnd = seeded(seed);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [flags[i], flags[j]] = [flags[j], flags[i]];
  }
  return flags;
}
