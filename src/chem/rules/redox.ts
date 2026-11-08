import { composeFormula, DATA, getSpecies, isWeakElectrolyte } from '../data/index'
import { isConcentrated, moles } from '../stoich'
import { makeEquation } from '../util/equation'
import { empty, pairs, type Rule } from './types'

const halogenOf = (id: string) => (id === 'Cl2' ? 'Cl' : id === 'Br2' ? 'Br' : id === 'I2' ? 'I' : id === 'F2' ? 'F' : null)
const order = (el: string) => DATA.halogenOrder.indexOf(el)
const elementalHalogen = (el: string) => `${el}2`

/** 2 · Phản ứng oxi hóa – khử theo bảng (cần đủ chất, đủ điều kiện): KMnO4 + FeSO4 + H2SO4, FeCl3 + Cu, Cl2 + NaOH… */
export const redoxTable: Rule = {
  id: 'redoxTable',
  priority: 2,
  find({ m, present, cond, water }) {
    const out = empty()
    const has = (id: string) => (id === 'H2O' ? water : moles(m, id) > 1e-12)
    for (const e of DATA.redoxReactions) {
      const missing = e.reactants.filter((r) => !has(r))
      if (missing.length === 0) {
        const vars = { a: e.reactants[0]!, b: e.reactants[1]!, acid: e.requires?.concentrated ?? '' }
        if (e.requires?.concentrated && !isConcentrated(m, e.requires.concentrated)) {
          out.misses.push({ reason: 'NEEDS_CONCENTRATED', vars, would: { cond: {}, key: 'would.concentrated', vars: { acid: e.requires.concentrated } } })
          continue
        }
        if (e.requires?.heated && !cond.heated) {
          out.misses.push({ reason: 'NEEDS_HEAT', vars, would: { cond: { heated: true }, key: 'would.heat' } })
          continue
        }
        if (e.requires?.solid && !(m.solids[e.requires.solid]! > 0)) continue
        const conditions = [...(e.requires?.concentrated ? ['đặc'] : []), ...(e.requires?.heated ? ['t°'] : [])]
        const eq = makeEquation(
          e.reactants.map((id) => ({ id, phase: id === 'H2O' ? ('l' as const) : (m.solids[id] ?? 0) > 0 ? ('s' as const) : getSpecies(id).phase === 'g' ? ('g' as const) : ('aq' as const) })),
          e.products.map(([id, phase]) => ({ id, phase })),
          { coefs: e.coefs, productCoefs: e.productCoefs, conditions },
        )
        if (!eq) throw new Error(`Cannot balance ${e.id}`)
        out.candidates.push({ key: `redox:${e.id}`, rule: 'redoxTable', priority: 2, kind: 'react', equation: eq })
      } else if (e.needsAcid && missing.length === 1 && missing[0] === e.needsAcid) {
        out.misses.push({
          reason: 'POTENTIAL_UNFAVORABLE',
          vars: { a: e.reactants[0]!, b: e.reactants[1]!, noteKey: 'note.acidMedium', acid: e.needsAcid },
          would: { cond: {}, key: 'would.acid', vars: { acid: e.needsAcid } },
        })
      }
    }
    // Dung dịch Cl2 gặp nước có chất chỉ thị: ghi cân bằng Cl2 + H2O ⇌ HCl + HClO (tẩy màu), không đổi lượng chất.
    if (water && has('Cl2') && m.indicator && m.indicator !== 'starch') {
      const eq = makeEquation([{ id: 'Cl2', phase: 'aq' }, { id: 'H2O', phase: 'l' }], [{ id: 'HCl', phase: 'aq' }, { id: 'HClO', phase: 'aq' }], { reversible: true })
      if (eq) out.candidates.push({ key: 'info:chlorineWater', rule: 'redoxTable', priority: 2, kind: 'info', equation: eq })
    }
    return out
  },
}

/** 6 · Halogen mạnh đẩy halogen yếu ra khỏi muối/axit: F2 > Cl2 > Br2 > I2. */
export const halogen: Rule = {
  id: 'halogen',
  priority: 6,
  find({ present }) {
    const out = empty()
    for (const [X, S] of pairs(present)) {
      const hx = halogenOf(X.id)
      if (!hx || !S.s.ions || S.pool !== 'aq') continue
      const hy = DATA.anions[S.s.ions.anion]?.halogen
      if (!hy) continue
      const vars = { halogen: X.id, other: elementalHalogen(hy), a: X.id, b: S.id }
      if (hx === hy) {
        out.misses.push({ reason: 'NO_NEW_ION_PAIR', vars })
        continue
      }
      if (order(hx) > order(hy)) {
        out.misses.push({ reason: 'WEAKER_OXIDIZER', vars })
        continue
      }
      const anion = Object.entries(DATA.anions).find(([, a]) => a.halogen === hx)![0]
      const salt = getSpecies(S.s.class === 'acid' ? `H${hx}` : composeName(S.s.ions.cation, anion))
      const eq = makeEquation([{ id: X.id, phase: 'aq' }, { id: S.id, phase: 'aq' }], [{ id: salt.id, phase: 'aq' }, { id: elementalHalogen(hy), phase: 'aq' }])
      if (eq) out.candidates.push({ key: `halogen:${X.id}:${S.id}`, rule: 'halogen', priority: 6, kind: 'react', equation: eq })
    }
    return out
  },
}


const composeName = (cation: string, anion: string) => composeFormula(cation, anion).formula

/** 8 · Nhiệt phân khi đun (ngưỡng nhiệt độ, xúc tác); NH3 tan bay ra khi đun. */
export const decomposition: Rule = {
  id: 'decomposition',
  priority: 8,
  find({ m, cond }) {
    const out = empty()
    if (!cond.heated) return out
    const T = m.temperatureC
    for (const d of DATA.decompositions) {
      if (!((m.solids[d.reactant] ?? 0) > 1e-12)) continue
      const hasCat = d.catalyst ? (m.solids[d.catalyst] ?? 0) > 0 || cond.catalyst === d.catalyst : false
      const threshold = d.catalyst && !hasCat ? d.uncatalyzedC ?? d.thresholdC : d.thresholdC
      const vars = { a: d.reactant, b: '', catalyst: d.catalyst ?? '', t: String(threshold) }
      if (T < threshold) {
        if (d.catalyst && !hasCat && T >= d.thresholdC)
          out.misses.push({ reason: 'NEEDS_CATALYST', vars, would: { cond: { catalyst: d.catalyst }, key: 'would.catalyst', vars: { catalyst: d.catalyst } } })
        else out.misses.push({ reason: 'NEEDS_HEAT', vars, would: { cond: { heated: true, temperatureC: threshold }, key: 'would.heatStrong', vars: { t: String(threshold) } } })
        continue
      }
      const conditions = ['t°', ...(d.catalyst && hasCat ? [d.catalyst] : [])]
      const eq = makeEquation([{ id: d.reactant, phase: 's' }], d.products.map(([id, phase]) => ({ id, phase })), { coefs: d.coefs, productCoefs: d.productCoefs, conditions })
      if (!eq) throw new Error(`Cannot balance decomposition ${d.id}`)
      out.candidates.push({ key: `decomp:${d.id}`, rule: 'decomposition', priority: 8, kind: 'react', equation: eq })
    }
    if ((m.solutes.NH3 ?? 0) > 1e-12) out.candidates.push({ key: 'expel:NH3', rule: 'decomposition', priority: 8, kind: 'expel', species: 'NH3' })
    return out
  },
}

/** 9 · H2O2 phân hủy: có MnO2 thì nhanh (xảy ra ngay khi trộn); không xúc tác thì rất chậm (chỉ chạy trong step). */
export const peroxide: Rule = {
  id: 'peroxide',
  priority: 9,
  find({ m }) {
    const out = empty()
    if ((m.solutes.H2O2 ?? 0) > 1e-12 && (m.solids[DATA.kinetics.peroxide.catalyst] ?? 0) > 0) {
      const eq = makeEquation([{ id: 'H2O2', phase: 'aq' }], [{ id: 'H2O', phase: 'l' }, { id: 'O2', phase: 'g' }], { conditions: [DATA.kinetics.peroxide.catalyst] })
      if (eq) out.candidates.push({ key: 'peroxide', rule: 'peroxide', priority: 9, kind: 'kinetic', rate: 'peroxide', equation: eq, deltaH: DATA.thermo.reaction.H2O2! * 2 })
    }
    return out
  },
}

export { isWeakElectrolyte }
