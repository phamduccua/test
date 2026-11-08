import { getSpecies, solubilityOf } from './data/index'
import type { Equation, Indicator, Mixture } from './model/types'
import { molarMassOf } from './util/formula'

export const EPS = 1e-12

export function emptyMixture(): Mixture {
  return { volumeL: 0, solutes: {}, solids: {}, gases: {}, temperatureC: 25 }
}

export function makeSolution(id: string, concM: number, volumeMl: number, indicator?: Indicator): Mixture {
  const s = getSpecies(id)
  const m = emptyMixture()
  m.volumeL = volumeMl / 1000
  if (concM > 0) m.solutes[s.id] = concM * m.volumeL
  if (indicator) m.indicator = indicator
  return m
}

export function makeWater(volumeMl: number, indicator?: Indicator): Mixture {
  const m = emptyMixture()
  m.volumeL = volumeMl / 1000
  if (indicator) m.indicator = indicator
  return m
}

/** Chất rắn khô; hydrat ("CuSO4.5H2O") tính khối lượng mol đủ nước rồi lưu dạng khan. */
export function makeSolid(id: string, grams: number): Mixture {
  const s = getSpecies(id)
  const m = emptyMixture()
  m.solids[s.id] = grams / molarMassOf(id)
  return m
}

/** Khí sục vào (ví dụ CO2 vào nước vôi trong): chất tan không kèm thể tích. */
export function makeGas(id: string, mol: number): Mixture {
  const s = getSpecies(id)
  const m = emptyMixture()
  m.solutes[s.id] = mol
  return m
}

export function cloneMixture(m: Mixture): Mixture {
  return {
    volumeL: m.volumeL,
    solutes: { ...m.solutes },
    solids: { ...m.solids },
    gases: { ...m.gases },
    temperatureC: m.temperatureC,
    indicator: m.indicator,
    kinetic: m.kinetic ? structuredClone(m.kinetic) : undefined,
  }
}

const addTo = (into: Record<string, number>, from: Record<string, number>) => {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v
}

/** Gộp hai hỗn hợp: cộng thể tích, cộng mol, nhiệt độ trung bình theo thể tích. */
export function merge(a: Mixture, b: Mixture): Mixture {
  const m = cloneMixture(a)
  const va = a.volumeL
  const vb = b.volumeL
  m.volumeL = va + vb
  addTo(m.solutes, b.solutes)
  addTo(m.solids, b.solids)
  addTo(m.gases, b.gases)
  m.temperatureC = va + vb > 0 ? (a.temperatureC * va + b.temperatureC * vb) / (va + vb) : Math.max(a.temperatureC, b.temperatureC)
  m.indicator = a.indicator ?? b.indicator
  if (b.kinetic) m.kinetic = { ...(m.kinetic ?? {}), ...structuredClone(b.kinetic) }
  return m
}

/** Số mol chất (cả tan và rắn). */
export const moles = (m: Mixture, id: string) => (m.solutes[id] ?? 0) + (m.solids[id] ?? 0)

/** Nồng độ mol/L của chất tan (thể tích 0 → coi như rất đặc). */
export function concentration(m: Mixture, id: string): number {
  const n = m.solutes[id] ?? 0
  if (n <= 0) return 0
  return m.volumeL > 0 ? n / m.volumeL : Infinity
}

export function isConcentrated(m: Mixture, acidId: string): boolean {
  const s = getSpecies(acidId)
  return s.concentratedAboveM !== undefined && concentration(m, acidId) >= s.concentratedAboveM
}

/** Chất có tan trong nước không (theo bảng tính tan hoặc trạng thái mặc định). */
export function isSoluble(id: string): boolean {
  const s = getSpecies(id)
  if (s.ions) return solubilityOf(s.ions.cation, s.ions.anion) === 'S'
  return s.phase === 'aq'
}

/** Lượng tối đa có thể phản ứng theo một phương trình (chất hết). H2O coi như dư. */
export function maxExtent(m: Mixture, eq: Equation): number {
  let x = Infinity
  for (const t of eq.reactants) {
    if (t.species === 'H2O') continue
    x = Math.min(x, moles(m, t.species) / t.coef)
  }
  return x === Infinity ? 0 : Math.max(0, x)
}

const take = (pool: Record<string, number>, id: string, n: number): number => {
  const have = pool[id] ?? 0
  const used = Math.min(have, n)
  const left = have - used
  if (left <= EPS) delete pool[id]
  else pool[id] = left
  return n - used
}

/** Áp phương trình với độ tiến `extent` (mol theo hệ số 1). Trả hỗn hợp mới. */
export function applyEquation(m: Mixture, eq: Equation, extent: number): Mixture {
  const out = cloneMixture(m)
  for (const t of eq.reactants) {
    if (t.species === 'H2O') continue
    let need = t.coef * extent
    // Ưu tiên lấy ở pha ghi trong phương trình, phần thiếu lấy ở pha còn lại.
    const [first, second] = t.phase === 's' ? [out.solids, out.solutes] : [out.solutes, out.solids]
    need = take(first, t.species, need)
    if (need > EPS) take(second, t.species, need)
  }
  for (const t of eq.products) {
    if (t.species === 'H2O') continue
    const n = t.coef * extent
    const pool = t.phase === 'g' ? out.gases : t.phase === 's' ? out.solids : out.solutes
    pool[t.species] = (pool[t.species] ?? 0) + n
  }
  return out
}
