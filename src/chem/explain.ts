import { DATA, getSpecies } from './data/index'
import type { Phenomenon, ReasonCode } from './model/types'
import type { Miss } from './rules/types'
import { chemText } from './text'
import { toDisplay } from './util/formula'

/** "axit clohiđric (HCl)". */
export function speciesNameVi(id: string): string {
  if (!id) return ''
  const s = getSpecies(id)
  return `${s.nameVi} (${toDisplay(s.formula)})`
}

const metalName = (el: string) => speciesNameVi(el)

export function describePhenomenon(p: Phenomenon): string | null {
  switch (p.type) {
    case 'gas': {
      const info = DATA.gasInfo[p.species]
      const gas = toDisplay(p.species)
      if (info?.colorVi) return chemText('phen.gasColored', { gas, color: info.colorVi })
      if (info?.smellVi) return chemText('phen.gasSmell', { gas, smell: info.smellVi })
      if (info?.noteKey) return `${chemText('phen.gas', { gas })} (${chemText(info.noteKey)})`
      return chemText('phen.gas', { gas })
    }
    case 'precipitate':
      return chemText('phen.precipitate', { color: p.colorName, species: toDisplay(p.species) })
    case 'dissolve':
      return chemText('phen.dissolve', { species: toDisplay(p.species) })
    case 'color_change':
      return p.note ?? chemText('phen.colorChange')
    case 'decolorize':
      return chemText('phen.decolorize', { species: p.species === 'litmus' ? 'giấy quỳ' : toDisplay(p.species) })
    case 'metal_coating':
      return chemText('phen.coating', { species: toDisplay(p.species), color: p.colorName })
    case 'temperature':
      return chemText(p.deltaC > 0 ? 'phen.tempUp' : 'phen.tempDown', { d: Math.abs(p.deltaC).toFixed(1).replace('.', ',') })
    case 'fume':
      return chemText('phen.fume')
    case 'none':
      return null
  }
}

export function explainHappened(phenomena: Phenomenon[], kinetic: boolean): string {
  const list = phenomena.map(describePhenomenon).filter((x): x is string => !!x)
  if (kinetic) list.push(chemText('phen.kinetic'))
  if (!list.length) list.push(chemText('phen.none'))
  return chemText('phen.intro', { list: list.join('; ') })
}

/** Lời giải thích khi không có phản ứng, từ lý do của luật. */
export function explainMiss(reason: ReasonCode, miss: Miss | undefined, a?: string, b?: string): string {
  const v = miss?.vars ?? {}
  const vars: Record<string, string> = {
    a: speciesNameVi(v.a ?? a ?? ''),
    b: speciesNameVi(v.b ?? b ?? ''),
    metal: v.metal ? metalName(v.metal) : '',
    other: v.other ? speciesNameVi(v.other) : '',
    acid: v.acid ? speciesNameVi(v.acid) : '',
    halogen: v.halogen ? speciesNameVi(v.halogen) : '',
    catalyst: v.catalyst ? speciesNameVi(v.catalyst) : '',
    products: v.products ? v.products.split(', ').map((p) => p.split(' + ').map(toDisplay).join(' + ')).join(', ') : '',
    note: v.noteKey ? chemText(v.noteKey, { acid: v.acid ? speciesNameVi(v.acid) : '' }) : '',
    t: v.t ?? '',
  }
  return chemText(`reason.${reason}`, vars)
}
