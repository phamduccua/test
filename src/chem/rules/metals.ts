import { activityIndex, DATA, H_INDEX, metalCation, speciesFromIons } from '../data/index'
import { isConcentrated, isSoluble } from '../stoich'
import { makeEquation } from '../util/equation'
import { empty, type Rule } from './types'

const OXIDIZING_ACIDS = ['HNO3', 'H2SO4']

/** 4 · Kim loại + axit: axit thường (đẩy H2, xảy ra dần), axit có tính oxi hóa (HNO3, H2SO4 đặc), thụ động hóa. */
export const metalAcid: Rule = {
  id: 'metalAcid',
  priority: 4,
  find({ present, cond, m }) {
    const out = empty()
    const metals = present.filter((p) => p.s.class === 'metal' && p.pool === 's')
    const acids = present.filter((p) => p.s.class === 'acid' && p.pool === 'aq' && p.s.ions)
    for (const M of metals) {
      const el = M.s.element!
      for (const A of acids) {
        const vars = { metal: M.id, acid: A.id, a: M.id, b: A.id }
        if (DATA.inert.includes(el)) {
          out.misses.push({ reason: 'INERT', vars })
          continue
        }
        if (DATA.reactsWithWater.includes(el)) continue // luật nước xử lý trước
        const conc = A.s.concentratedAboveM !== undefined && isConcentrated(m, A.id)
        const oxidizing = A.id === 'HNO3' || (A.id === 'H2SO4' && conc)
        if (oxidizing && OXIDIZING_ACIDS.includes(A.id)) {
          if (conc && DATA.passivated.includes(el) && !cond.heated) {
            out.misses.push({ reason: 'PASSIVATED', vars, would: { cond: { heated: true }, key: 'would.heat' } })
            continue
          }
          if (A.id === 'H2SO4' && activityIndex(el) > H_INDEX && !cond.heated) {
            out.misses.push({ reason: 'NEEDS_HEAT', vars, would: { cond: { heated: true }, key: 'would.heat' } })
            continue
          }
          const cat = metalCation(el, true)
          if (!cat) continue
          const salt = speciesFromIons(cat, A.s.ions!.anion).id
          const gas = A.id === 'H2SO4' ? 'SO2' : conc ? 'NO2' : 'NO'
          const conditions = [...(conc ? ['đặc'] : A.id === 'HNO3' ? ['loãng'] : []), ...(cond.heated ? ['t°'] : [])]
          const eq = makeEquation([{ id: M.id, phase: 's' }, { id: A.id, phase: 'aq' }], [{ id: salt, phase: 'aq' }, { id: gas, phase: 'g' }, { id: 'H2O', phase: 'l' }], { conditions })
          if (eq) out.candidates.push({ key: `oxAcid:${M.id}:${A.id}`, rule: 'metalAcid', priority: 4, kind: 'react', equation: eq })
          continue
        }
        if (activityIndex(el) > H_INDEX) {
          out.misses.push({
            reason: 'METAL_BELOW_H',
            vars,
            would: A.id === 'H2SO4' ? { cond: { heated: true }, key: 'would.concentrated', vars: { acid: 'H2SO4' } } : undefined,
          })
          continue
        }
        const cat = metalCation(el)
        if (!cat) continue
        const salt = speciesFromIons(cat, A.s.ions!.anion).id
        const eq = makeEquation([{ id: M.id, phase: 's' }, { id: A.id, phase: 'aq' }], [{ id: salt, phase: isSoluble(salt) ? 'aq' : 's' }, { id: 'H2', phase: 'g' }])
        if (eq) out.candidates.push({ key: `metalAcid:${M.id}:${A.id}`, rule: 'metalAcid', priority: 4, kind: 'kinetic', rate: 'metalAcid', equation: eq, deltaH: DATA.thermo.reaction[`${M.id}+${A.id}`] })
      }
    }
    return out
  },
}

/** 5 · Kim loại mạnh đẩy kim loại yếu ra khỏi dung dịch muối (trừ K, Na, Ca, Ba tác dụng với nước trước). */
export const metalSalt: Rule = {
  id: 'metalSalt',
  priority: 5,
  find({ present }) {
    const out = empty()
    const metals = present.filter((p) => p.s.class === 'metal' && p.pool === 's')
    const salts = present.filter((p) => p.s.class === 'salt' && p.pool === 'aq' && p.s.ions)
    for (const M of metals) {
      const el = M.s.element!
      if (DATA.reactsWithWater.includes(el)) continue
      for (const S of salts) {
        const other = Object.entries(DATA.metalCations).find(([, list]) => list.includes(S.s.ions!.cation))?.[0]
        if (!other) continue
        const vars = { metal: M.id, other, a: M.id, b: S.id }
        if (other === el) {
          out.misses.push({ reason: 'NO_NEW_ION_PAIR', vars })
          continue
        }
        if (activityIndex(el) >= activityIndex(other)) {
          out.misses.push({ reason: DATA.inert.includes(el) ? 'INERT' : 'METAL_LESS_ACTIVE', vars })
          continue
        }
        const cat = metalCation(el)
        if (!cat) continue
        const salt = speciesFromIons(cat, S.s.ions!.anion).id
        const eq = makeEquation([{ id: M.id, phase: 's' }, { id: S.id, phase: 'aq' }], [{ id: salt, phase: isSoluble(salt) ? 'aq' : 's' }, { id: other, phase: 's' }])
        if (eq) out.candidates.push({ key: `metalSalt:${M.id}:${S.id}`, rule: 'metalSalt', priority: 5, kind: 'react', equation: eq, deltaH: DATA.thermo.reaction[`${M.id}+${S.id}`] })
      }
    }
    return out
  },
}
