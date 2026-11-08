import { DATA, getSpecies } from './data/index'
import type { Conditions, Equation, Mixture, SafetyWarning } from './model/types'
import { isConcentrated } from './stoich'
import { chemText } from './text'
import { toDisplay } from './util/formula'

const warn = (code: string, level: SafetyWarning['level'], vars: Record<string, string | number> = {}): SafetyWarning => ({
  code,
  level,
  messageVi: chemText(`safety.${code}`, vars),
})

const concAcids = (m: Mixture) => Object.keys(m.solutes).filter((id) => getSpecies(id).class === 'acid' && isConcentrated(m, id))

/** Cảnh báo an toàn cho một lần trộn/đun. `target` là bình nhận, `added` là chất đổ vào. */
export function safetyFor(o: {
  target?: Mixture
  added?: Mixture
  after: Mixture
  cond: Conditions
  equations: Equation[]
  flags: Set<string>
  heating?: boolean
}): SafetyWarning[] {
  const out: SafetyWarning[] = []
  const { target, added, after, cond } = o
  if (target && added && (target.solutes.H2SO4 ?? 0) > 0 && isConcentrated(target, 'H2SO4') && added.volumeL > 0 && concAcids(added).length === 0)
    out.push(warn('WATER_INTO_CONC_ACID', 'danger'))
  const toxic = new Set<string>()
  for (const e of o.equations) for (const t of e.products) if (t.phase === 'g' && DATA.gasInfo[t.species]?.toxic) toxic.add(t.species)
  if (toxic.size && !cond.inFumeHood) out.push(warn('TOXIC_GAS_OUTSIDE_HOOD', 'danger', { gas: [...toxic].map(toDisplay).join(', ') }))
  if (o.flags.has('ALKALI_METAL_WATER')) out.push(warn('ALKALI_METAL_WATER', 'danger'))
  const oxid = Object.keys(after.solids).some((id) => getSpecies(id).tags?.includes('oxidizer'))
  if (oxid && ((after.solids.S ?? 0) > 0 || (after.solids.C ?? 0) > 0)) out.push(warn('OXIDIZER_WITH_FLAMMABLE', 'warning'))
  if (o.heating && !cond.open) out.push(warn('HEATING_CLOSED_VESSEL', 'danger'))
  const acids = [target, added].filter((x): x is Mixture => !!x).flatMap(concAcids)
  if (acids.length) out.push(warn('CONC_ACID_HANDLING', 'warning'))
  if (after.volumeL > 0 && after.temperatureC > 60) out.push(warn('HOT_LIQUID', 'info', { t: 60 }))
  return out
}
