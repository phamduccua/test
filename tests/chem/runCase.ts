import { heat, merge, mix, parseAmount, type Conditions, type ReactionResult } from '../../src/chem/index'

export interface Expect {
  happened?: boolean; reason?: string; eq?: string; products?: string[]; phen?: string[]; noPhen?: string[]; indicator?: string
  colorFrom?: string; safety?: string[]; noSafety?: string[]; dT?: number; would?: boolean; kinetic?: boolean; equations?: number
  concAfter?: Record<string, number>
}
export interface Case { id: string; a: string; b?: string; then?: string; op: 'mix' | 'heat' | 'describe'; cond?: Partial<Conditions>; t?: number; expect: Expect }

export const phenKey = (p: ReactionResult['phenomena'][number]) => ('species' in p ? `${p.type}:${p.species}` : p.type)

export function runCase(c: Case): ReactionResult | null {
  const a = parseAmount(c.a)
  if (c.op === 'describe') return null
  if (c.op === 'heat') return heat(c.b ? merge(a, parseAmount(c.b)) : a, c.t ?? 300, c.cond)
  let r = mix(a, parseAmount(c.b!), c.cond)
  if (c.then) r = mix(r.mixtureAfter, parseAmount(c.then), c.cond)
  return r
}

