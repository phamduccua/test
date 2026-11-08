import { ANIONS, DATA, getSpecies, isWeakElectrolyte, solubilityOf, speciesFromIons, unstableProducts } from '../data/index'
import type { Phase, Species } from '../model/types'
import { makeEquation, type Side } from '../util/equation'
import { empty, pairs, type Present, type Rule } from './types'

const GAS_ALWAYS = ['CO2', 'SO2', 'H2S']

interface Product { sides: Side[]; precipitate: boolean; gas: boolean; weak: boolean; label: string }

/** Sản phẩm của một cặp ion mới: chất không bền tách sẵn, hoặc chất ghép từ cation + anion. */
function productOf(cation: string, anion: string, heated: boolean, volumeL: number, estimateMol: number): Product {
  const unstable = unstableProducts(cation, anion)
  if (unstable) {
    const sides: Side[] = unstable.map((u) => ({ id: u.id, phase: u.id === 'NH3' ? (heated ? 'g' : 'aq') : u.phase }))
    return {
      sides,
      precipitate: sides.some((s) => s.phase === 's'),
      gas: sides.some((s) => s.phase === 'g'),
      weak: sides.some((s) => isWeakElectrolyte(s.id)),
      label: sides.map((s) => s.id).join(' + '),
    }
  }
  const sp = speciesFromIons(cation, anion)
  const sol = solubilityOf(cation, anion)
  const slightly = sol === 'L' && (volumeL <= 0 || estimateMol / volumeL > DATA.slightlySolubleLimitM)
  const precipitate = sol === 'I' || sol === 'D' || slightly
  const gas = GAS_ALWAYS.includes(sp.id)
  const phase: Phase = precipitate ? 's' : gas ? 'g' : 'aq'
  return { sides: [{ id: sp.id, phase }], precipitate, gas, weak: isWeakElectrolyte(sp.id), label: sp.id }
}

const pKa = (s: Species) => (s.ions ? ANIONS[s.ions.anion]?.pKa ?? -10 : -10)

/**
 * 7 · Phản ứng trao đổi giữa axit–muối, bazơ–muối, muối–muối: hai chất đổi thành phần cho nhau.
 * Chỉ xảy ra khi sản phẩm có kết tủa, chất khí hoặc chất điện li yếu (axit yếu hơn, H2O, NH3, phức).
 */
export const exchange: Rule = {
  id: 'exchange',
  priority: 7,
  find({ present, cond, m }) {
    const out = empty()
    const ionic = (p: Present) => p.s.ions && ['acid', 'base', 'salt'].includes(p.s.class)
    for (const [x, y] of pairs(present.filter(ionic))) {
      if (x.id >= y.id) continue
      const kinds = [x.s.class, y.s.class].sort().join('+')
      if (kinds === 'acid+acid' || kinds === 'base+base' || kinds === 'acid+base') continue
      // Axit đứng trước để phân biệt vai trò; với muối–muối, bazơ–muối thứ tự không quan trọng.
      const [A, B] = y.s.class === 'acid' || (y.s.class === 'base' && x.s.class === 'salt') ? [y, x] : [x, y]
      const solidB = B.pool === 's'
      if (A.pool === 's' || (solidB && A.s.class !== 'acid')) continue
      const ia = A.s.ions!
      const ib = B.s.ions!
      const vars = { a: A.id, b: B.id }
      if (ia.cation === ib.cation || ia.anion === ib.anion) {
        out.misses.push({ reason: 'NO_NEW_ION_PAIR', vars })
        continue
      }
      const est = Math.min(A.mol, B.mol)
      const p1 = productOf(ia.cation, ib.anion, cond.heated, m.volumeL, est)
      const p2 = productOf(ib.cation, ia.anion, cond.heated, m.volumeL, est)
      // Axit + muối: axit mới yếu hơn mới là động lực (CH3COONa + HCl → CH3COOH); HCl + CH3COONa có, CH3COOH + NaCl không.
      let weak = p1.weak || p2.weak
      if (A.s.class === 'acid' && p1.weak && !p1.gas && !p1.precipitate && p1.sides.length === 1) {
        const newAcid = getSpecies(p1.sides[0]!.id)
        weak = pKa(newAcid) > pKa(A.s) + 0.5 || p2.weak
      }
      const driving = p1.precipitate || p2.precipitate || p1.gas || p2.gas || weak
      if (!driving) {
        out.misses.push({ reason: 'PRODUCTS_ALL_SOLUBLE', vars: { ...vars, products: [p1.label, p2.label].join(', ') } })
        continue
      }
      // Axit + muối rắn không tan: chỉ có khi tạo khí (đá vôi + HCl); BaSO4, AgCl không tan trong axit.
      if (solidB && !(p1.gas || p2.gas)) continue
      const products = [...p1.sides, ...p2.sides].filter((s, i, arr) => arr.findIndex((t) => t.id === s.id) === i)
      const eq = makeEquation([{ id: A.id, phase: 'aq' }, { id: B.id, phase: B.pool }], products, { conditions: cond.heated && products.some((s) => s.id === 'NH3') ? ['t°'] : undefined })
      if (!eq) continue
      const carbonateSolid = solidB && A.s.class === 'acid' && /CO3/.test(ib.anion)
      const thio = ib.anion === 'S2O3^2-' && A.s.class === 'acid'
      const kinetic = carbonateSolid || thio
      out.candidates.push({
        key: `exchange:${A.id}:${B.id}`,
        rule: 'exchange',
        priority: 7,
        kind: kinetic ? 'kinetic' : 'react',
        rate: carbonateSolid ? 'carbonateAcid' : thio ? 'thiosulfate' : undefined,
        equation: eq,
        deltaH: A.s.class === 'acid' && products.some((s) => s.id === 'H2O') && !carbonateSolid ? undefined : DATA.thermo.reaction[`${B.id}+${A.id}`],
      })
    }
    return out
  },
}
