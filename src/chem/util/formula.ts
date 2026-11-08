import { ATOMIC_MASSES } from '../data/atomicMasses'
import type { Term } from '../model/types'

export type Counts = Record<string, number>

function add(into: Counts, from: Counts, k = 1): Counts {
  for (const [el, n] of Object.entries(from)) into[el] = (into[el] ?? 0) + n * k
  return into
}

/** "Fe2(SO4)3" → {Fe:2,S:3,O:12}; hỗ trợ ngoặc lồng và hydrat "CuSO4.5H2O". */
export function parseFormula(formula: string): Counts {
  const parts = formula.split(/[.·*]/)
  const total: Counts = {}
  for (const raw of parts) {
    const m = /^(\d+)(.*)$/.exec(raw)
    const k = m ? Number(m[1]) : 1
    add(total, parseGroup(m ? m[2]! : raw), k)
  }
  return total
}

function parseGroup(s: string): Counts {
  let i = 0
  const read = (): Counts => {
    const out: Counts = {}
    while (i < s.length) {
      const c = s[i]!
      if (c === '(' || c === '[') {
        i++
        const inner = read()
        const n = num()
        add(out, inner, n)
      } else if (c === ')' || c === ']') {
        i++
        return out
      } else if (/[A-Z]/.test(c)) {
        let el = c
        i++
        while (i < s.length && /[a-z]/.test(s[i]!)) el += s[i++]
        if (!(el in ATOMIC_MASSES)) throw new Error(`Unknown element ${el} in ${s}`)
        out[el] = (out[el] ?? 0) + num()
      } else throw new Error(`Bad formula char "${c}" in ${s}`)
    }
    return out
  }
  const num = (): number => {
    let d = ''
    while (i < s.length && /\d/.test(s[i]!)) d += s[i++]
    return d ? Number(d) : 1
  }
  return read()
}

/** "SO4^2-" → {formula:'SO4', charge:-2}; "Fe3+" → {formula:'Fe', charge:3}; "Cl-", "H+", "NH4+". */
export function parseIon(ion: string): { formula: string; charge: number } {
  const caret = /^(.+)\^(\d*)([+-])$/.exec(ion)
  if (caret) return { formula: caret[1]!, charge: (caret[3] === '+' ? 1 : -1) * Number(caret[2] || 1) }
  const m = /^([A-Za-z0-9()]*?[A-Za-z)])(\d*)([+-])$/.exec(ion)
  if (!m) throw new Error(`Bad ion ${ion}`)
  // "Fe3+" → kim loại một nguyên tố + điện tích; "NH4+" → nhóm đa nguyên tử điện tích 1.
  const single = /^[A-Z][a-z]?$/.test(m[1]!)
  if (single && m[2]) return { formula: m[1]!, charge: (m[3] === '+' ? 1 : -1) * Number(m[2]) }
  return { formula: m[1]! + m[2]!, charge: m[3] === '+' ? 1 : -1 }
}

export function molarMassOf(formula: string): number {
  let m = 0
  for (const [el, n] of Object.entries(parseFormula(formula))) m += ATOMIC_MASSES[el]! * n
  return Math.round(m * 1000) / 1000
}

const SUB: Record<string, string> = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' }
const SUP: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' }

/** "H2SO4" → "H₂SO₄"; "CuSO4.5H2O" → "CuSO₄·5H₂O". Số đứng đầu (hệ số hydrat) giữ nguyên. */
export function toDisplay(formula: string): string {
  return formula
    .split('.')
    .map((part) => part.replace(/([A-Za-z)\]])(\d+)/g, (_, a: string, d: string) => a + [...d].map((x) => SUB[x]).join('')))
    .join('·')
}

/** "SO4^2-" → "SO₄²⁻". */
export function ionToDisplay(ion: string): string {
  const { formula, charge } = parseIon(ion)
  const n = Math.abs(charge)
  return toDisplay(formula) + (n > 1 ? [...String(n)].map((x) => SUP[x]).join('') : '') + (charge > 0 ? '⁺' : '⁻')
}

/** Tổng số nguyên tử mỗi nguyên tố của một vế phương trình. */
export function elementCounts(terms: Term[], formulaOf: (id: string) => string): Counts {
  const out: Counts = {}
  for (const t of terms) add(out, parseFormula(formulaOf(t.species)), t.coef)
  return out
}
