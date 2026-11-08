import { DATA, getSpecies, solubilityOf, speciesFromIons } from '../data/index'
import { isConcentrated, isSoluble } from '../stoich'
import { makeEquation, type Side } from '../util/equation'
import { empty, pairs, type Rule } from './types'

const isAcid = (id: string) => getSpecies(id).class === 'acid'
const isBase = (id: string) => getSpecies(id).class === 'base'
const acidAnion = (id: string) => getSpecies(id).tags?.find((t) => t.startsWith('acid_anion:'))?.slice(11)

/** 0 · Chất rắn tan vào nước (NaOH, NH4Cl, CuSO4 khan…). Không tan khi dung môi là H2SO4 đặc. */
export const dissolution: Rule = {
  id: 'dissolution',
  priority: 0,
  find({ m, present, water }) {
    const out = empty()
    if (!water || (m.solutes.H2SO4 && isConcentrated(m, 'H2SO4'))) return out
    for (const p of present) {
      if (p.pool !== 's' || p.s.class === 'metal' || p.s.class.startsWith('oxide') || p.s.class === 'nonmetal') continue
      if (!isSoluble(p.id)) continue
      out.candidates.push({ key: `dissolve:${p.id}`, rule: 'dissolution', priority: 0, kind: 'dissolve', species: p.id })
    }
    return out
  },
}

/** 1 · Kim loại kiềm/kiềm thổ + nước; oxit bazơ tan + nước; oxit axit (P2O5, SO3) + nước. */
export const waterReactions: Rule = {
  id: 'water',
  priority: 1,
  find({ present, water }) {
    const out = empty()
    if (!water) return out
    for (const p of present) {
      if (p.s.class === 'metal' && DATA.reactsWithWater.includes(p.s.element!)) {
        const base = speciesFromIons(DATA.metalCations[p.s.element!]![0]!, 'OH-')
        const eq = makeEquation([{ id: p.id, phase: 's' }, { id: 'H2O', phase: 'l' }], [{ id: base.id, phase: isSoluble(base.id) ? 'aq' : 's' }, { id: 'H2', phase: 'g' }])
        if (eq) out.candidates.push({ key: `water:${p.id}`, rule: 'water', priority: 1, kind: 'react', equation: eq, deltaH: DATA.thermo.reaction[`${p.id}+H2O`], safety: ['ALKALI_METAL_WATER'] })
      }
      if (p.s.class === 'oxide_basic' && p.s.ions && ['Na+', 'K+', 'Ca2+', 'Ba2+'].includes(p.s.ions.cation)) {
        const base = speciesFromIons(p.s.ions.cation, 'OH-')
        const eq = makeEquation([{ id: p.id, phase: 's' }, { id: 'H2O', phase: 'l' }], [{ id: base.id, phase: 'aq' }])
        if (eq) out.candidates.push({ key: `water:${p.id}`, rule: 'water', priority: 1, kind: 'react', equation: eq, deltaH: DATA.thermo.reaction[`${p.id}+H2O`] })
      }
      const an = acidAnion(p.id)
      if (p.s.class === 'oxide_acidic' && an && (p.id === 'P2O5' || p.id === 'SO3')) {
        const acid = speciesFromIons('H+', an)
        const eq = makeEquation([{ id: p.id, phase: p.pool }, { id: 'H2O', phase: 'l' }], [{ id: acid.id, phase: 'aq' }])
        if (eq) out.candidates.push({ key: `water:${p.id}`, rule: 'water', priority: 1, kind: 'react', equation: eq })
      }
    }
    return out
  },
}

/** 3 · Axit + bazơ / oxit bazơ / NH3; oxit axit + bazơ. Axit + axit, bazơ + bazơ → không phản ứng. */
export const acidBase: Rule = {
  id: 'acidBase',
  priority: 3,
  find({ present }) {
    const out = empty()
    for (const [x, y] of pairs(present)) {
      if (isAcid(x.id) && isAcid(y.id) && x.id < y.id) {
        out.misses.push({ reason: 'SAME_CLASS_ACIDS', vars: { a: x.id, b: y.id } })
        continue
      }
      if (isBase(x.id) && isBase(y.id) && x.id < y.id) {
        out.misses.push({ reason: 'SAME_CLASS_BASES', vars: { a: x.id, b: y.id } })
        continue
      }
      // Axit (tan) + bazơ hoặc oxit bazơ/lưỡng tính.
      if (isAcid(x.id) && x.pool === 'aq' && x.s.ions) {
        const an = x.s.ions.anion
        let salt: string | null = null
        if (y.id === 'NH3' && y.pool === 'aq') salt = speciesFromIons('NH4+', an).id
        else if ((y.s.class === 'base' || y.s.class === 'oxide_basic' || y.s.class === 'oxide_amphoteric') && y.s.ions) salt = speciesFromIons(y.s.ions.cation, an).id
        if (!salt) continue
        // Oxit kim loại kiềm/kiềm thổ đã tác dụng với nước trước (luật nước).
        const products: Side[] = [{ id: salt, phase: isSoluble(salt) ? 'aq' : 's' }]
        if (y.id !== 'NH3') products.push({ id: 'H2O', phase: 'l' })
        const eq = makeEquation([{ id: x.id, phase: 'aq' }, { id: y.id, phase: y.pool }], products)
        if (!eq) continue
        const water = eq.products.find((t) => t.species === 'H2O')?.coef ?? eq.reactants.find((t) => t.species === x.id)!.coef
        out.candidates.push({ key: `acidBase:${x.id}:${y.id}`, rule: 'acidBase', priority: 3, kind: 'react', equation: eq, deltaH: DATA.thermo.neutralization * water })
      }
      // Oxit axit (CO2, SO2 sục vào) + bazơ tan.
      const an = acidAnion(x.id)
      if (an && x.s.class === 'oxide_acidic' && y.s.class === 'base' && y.pool === 'aq' && y.s.ions) {
        const salt = speciesFromIons(y.s.ions.cation, an).id
        const eq = makeEquation([{ id: x.id, phase: 'g' }, { id: y.id, phase: 'aq' }], [{ id: salt, phase: isSoluble(salt) ? 'aq' : 's' }, { id: 'H2O', phase: 'l' }])
        if (eq) out.candidates.push({ key: `acidOxide:${x.id}:${y.id}`, rule: 'acidBase', priority: 3, kind: 'react', equation: eq })
      }
    }
    return out
  },
}

export { isAcid, isBase, solubilityOf }
