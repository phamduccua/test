import { getSpecies } from '../data/index'
import type { Conditions, Equation, Mixture, Phenomenon, ReasonCode, Species } from '../model/types'

export interface Present { id: string; s: Species; mol: number; pool: 'aq' | 's' }

export interface Candidate {
  key: string
  rule: string
  priority: number
  /** 'react' (thường), 'kinetic' (xảy ra dần – step), 'info' (ghi phương trình, không đổi mol),
   *  'dissolve' (rắn tan vào nước), 'expel' (khí tan bay ra khi đun). */
  kind: 'react' | 'kinetic' | 'info' | 'dissolve' | 'expel'
  equation?: Equation
  species?: string
  rate?: string
  /** kJ cho mỗi đơn vị độ tiến phản ứng. */
  deltaH?: number
  phenomena?: Phenomenon[]
  safety?: string[]
}

export interface Miss {
  reason: ReasonCode
  vars: Record<string, string>
  would?: { cond: Partial<Conditions>; key: string; vars?: Record<string, string> }
}

export interface RuleCtx {
  m: Mixture
  cond: Conditions
  present: Present[]
  water: boolean
}

export interface RuleOut { candidates: Candidate[]; misses: Miss[] }
export interface Rule { id: string; priority: number; find(ctx: RuleCtx): RuleOut }

export function presentOf(m: Mixture): Present[] {
  const out: Present[] = []
  for (const [id, mol] of Object.entries(m.solutes)) if (mol > 1e-12) out.push({ id, s: getSpecies(id), mol, pool: 'aq' })
  for (const [id, mol] of Object.entries(m.solids)) if (mol > 1e-12) out.push({ id, s: getSpecies(id), mol, pool: 's' })
  return out
}

/** Tên tiếng Việt (in đậm công thức) để ghép vào lời giải thích. */
export const nameOf = (id: string) => {
  const s = getSpecies(id)
  return `${s.nameVi} (${s.formula})`
}

export function pairs<T>(list: T[]): [T, T][] {
  const out: [T, T][] = []
  for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) if (i !== j) out.push([list[i]!, list[j]!])
  return out
}

export const empty = (): RuleOut => ({ candidates: [], misses: [] })
