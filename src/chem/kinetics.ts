import { DATA, getSpecies } from './data/index'
import type { Conditions, Mixture, Phenomenon } from './model/types'
import { applyEquation, cloneMixture, maxExtent } from './stoich'
import { applyHeat } from './thermo'
import { makeEquation } from './util/equation'

const K = DATA.kinetics
const q10 = (T: number) => K.q10 ** ((T - 25) / 10)

/** [H+] hiệu dụng của các axit tan (axit yếu: √(Ka·C)). */
function protons(m: Mixture): number {
  if (m.volumeL <= 0) return 0
  let h = 0
  for (const [id, mol] of Object.entries(m.solutes)) {
    const s = getSpecies(id)
    if (s.class !== 'acid' || !s.ions) continue
    const C = mol / m.volumeL
    h += s.strength === 'strong' ? C * s.ions.nCat : Math.sqrt(1.8e-5 * C)
  }
  return h
}

/** Tốc độ (đơn vị độ tiến/giây) của một quá trình động học trong hỗn hợp. */
export function rateOf(key: string, m: Mixture): number {
  const p = m.kinetic?.[key]
  if (!p) return 0
  const T = m.temperatureC
  const eq = p.equation
  if (p.rate === 'metalAcid' || p.rate === 'carbonateAcid') {
    const solid = eq.reactants.find((t) => t.phase === 's')!
    const grams = (m.solids[solid.species] ?? 0) * getSpecies(solid.species).molarMass
    const table = p.rate === 'metalAcid' ? K.metalAcid : K.carbonateAcid
    const k = table[solid.species] ?? 1e-5
    return (k * protons(m) * Math.cbrt(grams * grams) * q10(T)) / solid.coef
  }
  if (p.rate === 'thiosulfate') {
    const V = m.volumeL
    if (V <= 0) return 0
    const thio = eq.reactants.find((t) => getSpecies(t.species).ions?.anion === 'S2O3^2-')!
    const S2O3 = (m.solutes[thio.species] ?? 0) / V
    return (K.thiosulfate.k * S2O3 * protons(m) * V * q10(T)) / thio.coef
  }
  if (p.rate === 'peroxide') {
    const catalyzed = (m.solids[K.peroxide.catalyst] ?? 0) > 0
    const half = catalyzed ? K.peroxide.catalyzedHalfLifeS : K.peroxide.halfLifeS
    const coef = eq.reactants[0]!.coef
    return ((Math.LN2 / half) * (m.solutes.H2O2 ?? 0) * q10(T)) / coef
  }
  return 0
}

/** Tổng tốc độ sinh khí (mol/s) của các quá trình đang chạy – để vẽ bọt. */
export function kineticGasRate(m: Mixture): number {
  let g = 0
  for (const [key, p] of Object.entries(m.kinetic ?? {})) {
    const gas = p.equation.products.filter((t) => t.phase === 'g').reduce((a, t) => a + t.coef, 0)
    g += rateOf(key, m) * gas
  }
  return g
}

/** Tiến các quá trình động học thêm dt giây. */
export function step(m0: Mixture, dt: number, _cond: Partial<Conditions> = {}): { mixture: Mixture; events: Phenomenon[]; progress: Record<string, number> } {
  let m = cloneMixture(m0)
  // H2O2 luôn tự phân hủy rất chậm, kể cả khi không có xúc tác.
  if ((m.solutes.H2O2 ?? 0) > 1e-12 && !m.kinetic?.peroxide) {
    const p = selfPeroxide()
    m.kinetic = { ...(m.kinetic ?? {}), peroxide: p }
  }
  const n = Math.max(1, Math.ceil(dt / 0.5))
  const h = dt / n
  const gasMol: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    for (const key of Object.keys(m.kinetic ?? {})) {
      const p = m.kinetic![key]!
      const left = maxExtent(m, p.equation)
      const x = Math.min(rateOf(key, m) * h, left)
      if (x <= 0) continue
      m = applyEquation(m, p.equation, x)
      const proc = m.kinetic![key]!
      proc.extent += x
      for (const t of p.equation.products) if (t.phase === 'g') gasMol[t.species] = (gasMol[t.species] ?? 0) + t.coef * x
      if (p.deltaH) m = applyHeat(m, p.deltaH * x)
    }
  }
  const progress: Record<string, number> = {}
  for (const [key, p] of Object.entries(m.kinetic ?? {})) {
    const left = maxExtent(m, p.equation)
    p.progress = p.extent + left > 0 ? p.extent / (p.extent + left) : 1
    progress[key] = p.progress
    if (left <= 1e-12) delete m.kinetic![key]
  }
  if (m.kinetic && Object.keys(m.kinetic).length === 0) delete m.kinetic
  const events: Phenomenon[] = Object.entries(gasMol).map(([species, mol]) => ({
    type: 'gas',
    species,
    intensity: Math.min(1, mol / dt / K.gasIntensityRef),
    colorHex: DATA.gasInfo[species]?.colorHex,
  }))
  return { mixture: m, events, progress }
}

function selfPeroxide() {
  const equation = makeEquation([{ id: 'H2O2', phase: 'aq' }], [{ id: 'H2O', phase: 'l' }, { id: 'O2', phase: 'g' }])!
  return { rate: 'peroxide', equation, progress: 0, extent: 0, deltaH: DATA.thermo.reaction.H2O2! * 2 }
}
