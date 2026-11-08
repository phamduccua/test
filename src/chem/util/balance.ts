import { parseFormula } from './formula'

/** Phân số hữu tỉ với tử/mẫu là bigint (đủ an toàn cho ma trận nhỏ). */
type Frac = [bigint, bigint]
const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b) [a, b] = [b, a % b]
  return a
}
const norm = ([n, d]: Frac): Frac => {
  if (d < 0n) [n, d] = [-n, -d]
  const g = gcd(n, d) || 1n
  return [n / g, d / g]
}
const sub = (a: Frac, b: Frac): Frac => norm([a[0] * b[1] - b[0] * a[1], a[1] * b[1]])
const mul = (a: Frac, b: Frac): Frac => norm([a[0] * b[0], a[1] * b[1]])
const div = (a: Frac, b: Frac): Frac => norm([a[0] * b[1], a[1] * b[0]])

/**
 * Cân bằng phương trình bằng không gian nghiệm của ma trận nguyên tố.
 * Trả hệ số nguyên dương nhỏ nhất, hoặc null nếu không có nghiệm duy nhất (bậc tự do ≠ 1).
 */
export function balance(reactants: string[], products: string[]): { reactants: number[]; products: number[] } | null {
  const formulas = [...reactants, ...products]
  const counts = formulas.map((f) => parseFormula(f))
  const elements = [...new Set(counts.flatMap((c) => Object.keys(c)))]
  const n = formulas.length
  const rows: Frac[][] = elements.map((el) =>
    counts.map((c, j) => [BigInt((c[el] ?? 0) * (j < reactants.length ? 1 : -1)), 1n] as Frac),
  )
  // Khử Gauss-Jordan.
  const pivots: number[] = []
  let r = 0
  for (let c = 0; c < n && r < rows.length; c++) {
    let p = r
    while (p < rows.length && rows[p]![c]![0] === 0n) p++
    if (p === rows.length) continue
    ;[rows[r], rows[p]] = [rows[p]!, rows[r]!]
    const pv = rows[r]![c]!
    rows[r] = rows[r]!.map((x) => div(x, pv))
    for (let i = 0; i < rows.length; i++) {
      if (i === r || rows[i]![c]![0] === 0n) continue
      const f = rows[i]![c]!
      rows[i] = rows[i]!.map((x, j) => sub(x, mul(f, rows[r]![j]!)))
    }
    pivots.push(c)
    r++
  }
  const free = [...Array(n).keys()].filter((c) => !pivots.includes(c))
  if (free.length !== 1) return null
  const fc = free[0]!
  const sol: Frac[] = Array.from({ length: n }, () => [0n, 1n] as Frac)
  sol[fc] = [1n, 1n]
  pivots.forEach((c, i) => {
    sol[c] = norm([-rows[i]![fc]![0], rows[i]![fc]![1]])
  })
  const lcm = sol.reduce((acc, [, d]) => (acc * d) / gcd(acc, d), 1n)
  let ints = sol.map(([nu, d]) => (nu * lcm) / d)
  if (ints.every((x) => x <= 0n)) ints = ints.map((x) => -x)
  if (ints.some((x) => x <= 0n)) return null
  const g = ints.reduce((a, b) => gcd(a, b))
  const out = ints.map((x) => Number(x / g))
  return { reactants: out.slice(0, reactants.length), products: out.slice(reactants.length) }
}
