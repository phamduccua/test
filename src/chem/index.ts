/**
 * Bộ máy hóa học (thuần TypeScript, không phụ thuộc three/DOM).
 * Trọng tài tổng quát: phán xét mọi cặp chất theo luật (tính tan, dãy hoạt động, độ mạnh axit, halogen, bảng oxi hóa – khử).
 */
import { describe } from './describe'
import { fullConditions, runEngine } from './engine'
import type { Conditions, Mixture, ReactionResult } from './model/types'
import { cloneMixture, makeSolid, merge } from './stoich'

export type * from './model/types'
export { describe, estimatePH } from './describe'
export { step, rateOf } from './kinetics'
export { makeSolution, makeSolid, makeWater, makeGas, merge, moles, concentration, isConcentrated, cloneMixture } from './stoich'
export { getSpecies, findSpecies, listSpecies, DATA as CHEM_DATA } from './data/index'
export { speciesNameVi } from './explain'
export { parseAmount } from './parse'
export { toDisplay, ionToDisplay, parseFormula, molarMassOf } from './util/formula'

/** Đổ `added` vào `target`. */
export function mix(target: Mixture, added: Mixture, cond: Partial<Conditions> = {}): ReactionResult {
  const m = merge(target, added)
  if (cond.heated && cond.temperatureC !== undefined) m.temperatureC = cond.temperatureC
  return runEngine(m, fullConditions(m, cond), { target, added })
}

/** Cho chất rắn vào hỗn hợp. */
export function addSolid(m: Mixture, id: string, grams: number, cond: Partial<Conditions> = {}): ReactionResult {
  return mix(m, makeSolid(id, grams), cond)
}

/** Đun hỗn hợp tới nhiệt độ `toC` (nhiệt phân, axit đặc nóng, đuổi NH3…). */
export function heat(m: Mixture, toC: number, cond: Partial<Conditions> = {}): ReactionResult {
  const h = cloneMixture(m)
  h.temperatureC = toC
  return runEngine(h, fullConditions(h, { ...cond, heated: true, temperatureC: toC }), { target: m, heating: true })
}

/** Lời giải thích vì sao không phản ứng (rỗng nếu có phản ứng). */
export function explainWhyNot(a: Mixture, b: Mixture, cond: Partial<Conditions> = {}): string {
  const r = mix(a, b, cond)
  return r.happened ? '' : r.explanationVi
}

export { describe as appearance }
