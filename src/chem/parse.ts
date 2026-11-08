import type { Indicator, Mixture } from './model/types'
import { makeGas, makeSolid, makeSolution, makeWater } from './stoich'

/**
 * Mô tả ngắn một lượng chất (dùng cho CLI và test):
 * "HCl 1M 20ml", "Zn 1g", "CO2 0.01mol", "water 20ml"; thêm "+litmus" / "+phenolphthalein" / "+starch"… để có chất chỉ thị.
 */
export function parseAmount(spec: string): Mixture {
  const parts = spec.trim().split(/\s+/)
  const indicator = parts.find((p) => p.startsWith('+'))?.slice(1) as Indicator | undefined
  const [id, ...rest] = parts.filter((p) => !p.startsWith('+'))
  if (!id) throw new Error(`Empty spec "${spec}"`)
  const num = (re: RegExp) => {
    const hit = rest.map((r) => re.exec(r)).find(Boolean)
    return hit ? Number(hit[1]) : undefined
  }
  const M = num(/^([\d.]+)M$/)
  const ml = num(/^([\d.]+)ml$/i)
  const g = num(/^([\d.]+)g$/)
  const mol = num(/^([\d.]+)mol$/)
  if (id === 'water' || id === 'H2O') return makeWater(ml ?? 10, indicator)
  if (g !== undefined) return makeSolid(id, g)
  if (mol !== undefined) return makeGas(id, mol)
  return makeSolution(id, M ?? 1, ml ?? 10, indicator)
}
