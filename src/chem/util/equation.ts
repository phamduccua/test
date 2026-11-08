import { getSpecies } from '../data/index'
import type { Equation, Phase, Term } from '../model/types'
import { balance } from './balance'
import { toDisplay } from './formula'

export interface Side { id: string; phase: Phase }

/** Dựng phương trình đã cân bằng (tự cân bằng nếu không truyền hệ số). Trả null nếu không cân bằng được. */
export function makeEquation(
  reactants: Side[],
  products: Side[],
  o: { coefs?: number[]; productCoefs?: number[]; conditions?: string[]; reversible?: boolean } = {},
): Equation | null {
  let rc = o.coefs
  let pc = o.productCoefs
  if (!rc || !pc) {
    const b = balance(
      reactants.map((r) => getSpecies(r.id).formula),
      products.map((p) => getSpecies(p.id).formula),
    )
    if (!b) return null
    rc = b.reactants
    pc = b.products
  }
  const r: Term[] = reactants.map((s, i) => ({ species: s.id, coef: rc![i]!, phase: s.phase }))
  const rank = (t: Term) => (t.phase === 'g' ? 1 : t.phase === 'l' ? 2 : 0)
  // Thứ tự hiển thị: muối/kết tủa/kim loại → khí → nước (sắp ổn định, sau khi đã gắn hệ số).
  const p: Term[] = products.map((s, i) => ({ species: s.id, coef: pc![i]!, phase: s.phase })).sort((a, b) => rank(a) - rank(b))
  return formatEquation({ reactants: r, products: p, conditions: o.conditions, reversible: o.reversible })
}

const term = (t: Term, mark: boolean, display: boolean) =>
  (t.coef > 1 ? String(t.coef) : '') +
  (display ? toDisplay(t.species) : t.species) +
  (mark && t.phase === 'g' ? (display ? '↑' : '(g)') : mark && t.phase === 's' ? (display ? '↓' : '(s)') : '')

export function formatEquation(e: Omit<Equation, 'text' | 'ascii'>): Equation {
  const cond = e.conditions?.length ? `(${e.conditions.join(', ')})` : ''
  const text = `${e.reactants.map((t) => term(t, false, true)).join(' + ')} ${e.reversible ? '⇌' : '→'}${cond} ${e.products.map((t) => term(t, true, true)).join(' + ')}`
  const ascii = `${e.reactants.map((t) => term(t, false, false)).join(' + ')} ${e.reversible ? '<=>' : '->'} ${e.products.map((t) => term(t, true, false)).join(' + ')}`
  return { ...e, text, ascii }
}
