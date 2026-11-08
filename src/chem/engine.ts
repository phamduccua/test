import { DATA, getSpecies, precipitateColor } from './data/index'
import { colorDistance, describe } from './describe'
import { explainHappened, explainMiss, speciesNameVi } from './explain'
import { rateOf } from './kinetics'
import type { Conditions, Equation, Mixture, Phenomenon, ReactionResult, ReasonCode } from './model/types'
import { RULES } from './rules/index'
import { presentOf, type Candidate, type Miss } from './rules/types'
import { safetyFor } from './safety'
import { applyEquation, cloneMixture, maxExtent } from './stoich'
import { chemText } from './text'
import { applyHeat, dissolveHeat } from './thermo'

/** Lý do cụ thể hơn đứng trước khi có nhiều lý do không phản ứng. */
const MISS_RANK: ReasonCode[] = [
  'PASSIVATED', 'NEEDS_CONCENTRATED', 'NEEDS_HEAT', 'NEEDS_CATALYST', 'POTENTIAL_UNFAVORABLE', 'WEAKER_OXIDIZER',
  'METAL_LESS_ACTIVE', 'METAL_BELOW_H', 'INERT', 'PRODUCTS_ALL_SOLUBLE', 'NO_NEW_ION_PAIR', 'SAME_CLASS_ACIDS', 'SAME_CLASS_BASES',
  'SOLIDS_NO_CONTACT', 'DILUTION_ONLY',
]

export function fullConditions(m: Mixture, c: Partial<Conditions> = {}): Conditions {
  return { temperatureC: c.temperatureC ?? m.temperatureC, heated: c.heated ?? false, catalyst: c.catalyst, light: c.light, inFumeHood: c.inFumeHood ?? false, open: c.open ?? true }
}

const speciesIds = (m: Mixture) => [...Object.keys(m.solutes), ...Object.keys(m.solids)]

function equationPhenomena(eq: Equation, extent: number, volumeL: number): Phenomenon[] {
  const out: Phenomenon[] = []
  for (const t of eq.products) {
    if (t.phase === 'g') {
      const mol = t.coef * extent
      out.push({ type: 'gas', species: t.species, intensity: Math.min(1, mol / Math.max(volumeL, 0.01) / 0.02), colorHex: DATA.gasInfo[t.species]?.colorHex })
    } else if (t.phase === 's') {
      const c = precipitateColor(t.species)
      out.push(getSpecies(t.species).class === 'metal'
        ? { type: 'metal_coating', species: t.species, colorHex: c.hex, colorName: c.name }
        : { type: 'precipitate', species: t.species, colorHex: c.hex, colorName: c.name })
    }
  }
  for (const t of eq.reactants) if (t.phase === 's') out.push({ type: 'dissolve', species: t.species })
  return out
}

function mergePhenomena(list: Phenomenon[]): Phenomenon[] {
  const out: Phenomenon[] = []
  for (const p of list) {
    const same = out.find((q) => q.type === p.type && 'species' in q && 'species' in p && q.species === p.species)
    if (same && same.type === 'gas' && p.type === 'gas') same.intensity = Math.min(1, same.intensity + p.intensity)
    else if (!same) out.push(p)
  }
  return out
}

export interface RunOptions { target?: Mixture; added?: Mixture; heating?: boolean }

/** Cho hỗn hợp `m0` phản ứng tới khi không còn luật nào áp được. */
export function runEngine(m0: Mixture, cond: Conditions, o: RunOptions = {}): ReactionResult {
  let m = cloneMixture(m0)
  // Màu so sánh với hỗn hợp vừa trộn (chưa phản ứng); trạng thái chỉ thị so với bình nhận ban đầu.
  const before = describe(m0)
  const beforeIndicator = describe(o.target ?? m0).indicatorState
  const T0 = m.temperatureC
  const equations: Equation[] = []
  let phenomena: Phenomenon[] = []
  const flags = new Set<string>()
  const done = new Set<string>()
  let happened = false
  let kinetic = false
  let firstMisses: Miss[] | null = null

  const solidsOnly = m.volumeL <= 0 && Object.keys(m.solutes).length === 0 && Object.keys(m.solids).length > 1
  if (!(solidsOnly && !cond.heated)) {
    for (let iter = 0; iter < 40; iter++) {
      const ctx = { m, cond, present: presentOf(m), water: m.volumeL > 0 }
      const found = RULES.map((r) => r.find(ctx))
      if (firstMisses === null) firstMisses = found.flatMap((f) => f.misses)
      const c: Candidate | undefined = found
        .flatMap((f) => f.candidates)
        .find((x) => !done.has(x.key) && !(x.kind === 'kinetic' && m.kinetic?.[x.key]))
      if (!c) break
      done.add(c.key)
      if (c.kind === 'dissolve') {
        const id = c.species!
        const mol = m.solids[id] ?? 0
        m = cloneMixture(m)
        delete m.solids[id]
        m.solutes[id] = (m.solutes[id] ?? 0) + mol
        const dH = dissolveHeat(id)
        if (dH) m = applyHeat(m, dH * mol)
        phenomena.push({ type: 'dissolve', species: id })
        done.delete(c.key)
        continue
      }
      if (c.kind === 'expel') {
        const id = c.species!
        m = cloneMixture(m)
        m.gases[id] = (m.gases[id] ?? 0) + (m.solutes[id] ?? 0)
        delete m.solutes[id]
        phenomena.push({ type: 'gas', species: id, intensity: 0.6 })
        happened = true
        continue
      }
      const eq = c.equation!
      if (!equations.some((e) => e.ascii === eq.ascii)) equations.push(eq)
      happened = true
      if (c.kind === 'info') {
        if (m.indicator === 'litmus') {
          phenomena.push({ type: 'color_change', fromHex: before.colorHex, toHex: DATA.indicators.litmus![0]!.hex })
          phenomena.push({ type: 'decolorize', species: 'litmus' })
        }
        continue
      }
      if (c.kind === 'kinetic') {
        m = cloneMixture(m)
        m.kinetic = { ...(m.kinetic ?? {}), [c.key]: { rate: c.rate!, equation: eq, progress: 0, extent: 0, deltaH: c.deltaH } }
        kinetic = true
        const r = rateOf(c.key, m)
        for (const t of eq.products)
          if (t.phase === 'g') phenomena.push({ type: 'gas', species: t.species, intensity: Math.min(1, (r * t.coef) / DATA.kinetics.gasIntensityRef), colorHex: DATA.gasInfo[t.species]?.colorHex })
        continue
      }
      const x = maxExtent(m, eq)
      if (x <= 1e-15) continue
      m = applyEquation(m, eq, x)
      phenomena.push(...equationPhenomena(eq, x, m.volumeL))
      if (c.deltaH) m = applyHeat(m, c.deltaH * x)
      for (const f of c.safety ?? []) flags.add(f)
    }
  }

  if (cond.heated && o.heating && m.temperatureC < cond.temperatureC) m.temperatureC = cond.temperatureC
  const dT = m.temperatureC - T0
  if (!o.heating && Math.abs(dT) >= 0.5) phenomena.push({ type: 'temperature', deltaC: Math.round(dT * 10) / 10 })
  const after = describe(m)
  if (beforeIndicator !== after.indicatorState && after.indicatorState && after.indicatorState !== 'bleached')
    phenomena.push({ type: 'color_change', fromHex: before.colorHex, toHex: after.colorHex })
  else if (colorDistance(before.colorHex, after.colorHex) > 45 && !phenomena.some((p) => p.type === 'color_change'))
    phenomena.push({ type: 'color_change', fromHex: before.colorHex, toHex: after.colorHex })
  for (const src of before.colorSources)
    if (!after.colorSources.includes(src) && after.opacity < before.opacity - 0.15) phenomena.push({ type: 'decolorize', species: src })
  phenomena = mergePhenomena(phenomena)

  let reasonCode: ReasonCode = 'HAPPENED'
  let explanationVi: string
  let wouldHappenIf: ReactionResult['wouldHappenIf']
  if (happened) {
    explanationVi = explainHappened(phenomena, kinetic)
  } else {
    const misses = firstMisses ?? []
    const best = misses.sort((p, q) => MISS_RANK.indexOf(p.reason) - MISS_RANK.indexOf(q.reason))[0]
    const a = o.target ? speciesIds(o.target) : []
    const b = o.added ? speciesIds(o.added) : []
    if (best) reasonCode = best.reason
    else if (solidsOnly) reasonCode = 'SOLIDS_NO_CONTACT'
    else if (a.length === 0 || b.length === 0 || a.every((x) => b.includes(x)) || speciesIds(m).length <= 1) reasonCode = 'DILUTION_ONLY'
    else reasonCode = 'INERT'
    explanationVi = explainMiss(reasonCode, best, a[0], b[0])
    if (best?.would) {
      const named = Object.fromEntries(Object.entries(best.would.vars ?? {}).map(([k, v]) => [k, k === 'acid' || k === 'catalyst' ? speciesNameVi(v) : v]))
      wouldHappenIf = { ...best.would.cond, noteVi: chemText(best.would.key, named) }
    }
    if (!phenomena.length) phenomena = [{ type: 'none' }]
  }
  const safety = safetyFor({ target: o.target, added: o.added, after: m, cond, equations, flags, heating: o.heating })
  return { happened, equations, phenomena, reasonCode, explanationVi, wouldHappenIf, safety, mixtureAfter: m }
}
