/** Số ngẫu nhiên có hạt giống (mulberry32) + phân phối Poisson – để đĩa thạch tái lập được. */
export type Rng = () => number;

export function rng(seed: number): Rng {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mẫu Poisson(λ): Knuth khi λ nhỏ, xấp xỉ chuẩn khi λ lớn. */
export function poisson(r: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 40) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss(r)));
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  while ((p *= r()) > L) k++;
  return k;
}

export function gauss(r: Rng): number {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}
