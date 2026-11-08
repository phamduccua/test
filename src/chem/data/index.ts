import raw from '../../content/chem.json'
import type { Hazard, IonSpec, Phase, Solubility, Species, SpeciesClass } from '../model/types'
import { molarMassOf, parseIon } from '../util/formula'

/** Dữ liệu thô của chem.json (giáo viên sửa file JSON, không sửa mã). */
interface IonInfo { vi: string; en: string; element?: string; strongBase?: boolean; hydrolysisPKa?: number; acidVi?: string; acidEn?: string; pKa?: number; halogen?: string }
interface RawSpecies {
  id: string; class: SpeciesClass; phase: Phase; nameVi: string; nameEn: string; hazards: string[]
  ions?: string[]; strength?: 'strong' | 'weak'; element?: string; defaultConc?: number; concentratedAboveM?: number
  color?: { solution?: string | null; solid?: string | null; gas?: string | null }; tags?: string[]
}
export interface ProductSpec { id: string; phase: Phase }
export interface RedoxEntry {
  id: string; reactants: string[]; products: [string, Phase][]; coefs?: number[]; productCoefs?: number[]
  needsAcid?: string; requires?: { concentrated?: string; heated?: boolean; solid?: string }
}
export interface DecompositionEntry {
  id: string; reactant: string; products: [string, Phase][]; thresholdC: number; catalyst?: string; uncatalyzedC?: number
  coefs?: number[]; productCoefs?: number[]
}
interface IndicatorBand { below?: number; needs?: string; hex: string; name: string; clear?: boolean }
interface ChemData {
  cations: Record<string, IonInfo>; anions: Record<string, IonInfo>
  solubility: Record<string, Record<string, Solubility>>
  unstable: Record<string, ProductSpec[]>
  weakElectrolytes: string[]; slightlySolubleLimitM: number
  precipitateColors: Record<string, [string, string]>
  colored: Record<string, { hex: string; cRef: number }>
  species: RawSpecies[]
  activity: string[]; reactsWithWater: string[]; inert: string[]; passivated: string[]
  metalCations: Record<string, string[]>
  halogenOrder: string[]
  gasInfo: Record<string, { toxic: boolean; colorHex?: string; colorVi?: string; smellVi?: string; noteKey?: string }>
  indicators: Record<string, IndicatorBand[]>
  thermo: { neutralization: number; dissolve: Record<string, number>; reaction: Record<string, number>; specificHeat: number }
  kinetics: {
    metalAcid: Record<string, number>; carbonateAcid: Record<string, number>
    thiosulfate: { k: number; crossHiddenM: number }; peroxide: { halfLifeS: number; catalyzedHalfLifeS: number; catalyst: string }
    q10: number; gasIntensityRef: number
  }
  redoxReactions: RedoxEntry[]; decompositions: DecompositionEntry[]
  potentials: Record<string, number>
}

export const DATA = raw as unknown as ChemData
export const CATIONS = DATA.cations
export const ANIONS = DATA.anions

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
const isPoly = (f: string) => !/^[A-Z][a-z]?$/.test(f)
const group = (f: string, n: number) => (n === 1 ? f : isPoly(f) ? `(${f})${n}` : `${f}${n}`)

/** Ghép công thức từ cation + anion: (Fe3+, SO4^2-) → Fe2(SO4)3; (H+, CH3COO-) → CH3COOH; (Na+, CH3COO-) → CH3COONa. */
export function composeFormula(cation: string, anion: string): { formula: string; nCat: number; nAn: number } {
  const c = parseIon(cation)
  const a = parseIon(anion)
  const g = gcd(c.charge, -a.charge)
  const nCat = -a.charge / g
  const nAn = c.charge / g
  if (a.formula === 'CH3COO') {
    if (c.formula === 'H') return { formula: 'CH3COOH', nCat, nAn }
    return { formula: group('CH3COO', nAn) + group(c.formula, nCat), nCat, nAn }
  }
  return { formula: group(c.formula, nCat) + group(a.formula, nAn), nCat, nAn }
}

export function solubilityOf(cation: string, anion: string): Solubility {
  return DATA.solubility[anion]?.[cation] ?? 'S'
}

const registry = new Map<string, Species>()
const byFormula = new Map<string, IonSpec>()

for (const cation of Object.keys(CATIONS)) {
  for (const anion of Object.keys(ANIONS)) {
    const { formula, nCat, nAn } = composeFormula(cation, anion)
    if (!byFormula.has(formula)) byFormula.set(formula, { cation, anion, nCat, nAn })
  }
}

function classOf(ions: IonSpec): SpeciesClass {
  if (ions.cation === 'H+') return 'acid'
  if (ions.anion === 'OH-') return 'base'
  if (ions.anion === 'O^2-') return 'oxide_basic'
  return 'salt'
}

function composed(formula: string, ions: IonSpec): Species {
  const cat = CATIONS[ions.cation]!
  const an = ANIONS[ions.anion]!
  const cls = classOf(ions)
  const sol = solubilityOf(ions.cation, ions.anion)
  const precip = DATA.precipitateColors[formula]
  const names =
    cls === 'acid'
      ? { vi: an.acidVi ?? `axit ${an.vi}`, en: an.acidEn ?? `${an.en} acid` }
      : { vi: `${cat.vi} ${an.vi}`, en: `${cat.en} ${an.en}` }
  const strength = cls === 'acid' ? ((an.pKa ?? 0) < 0 ? 'strong' : 'weak') : cls === 'base' ? (cat.strongBase ? 'strong' : 'weak') : undefined
  return {
    id: formula,
    formula,
    nameVi: names.vi,
    nameEn: names.en,
    class: cls,
    phase: sol === 'S' ? 'aq' : 's',
    molarMass: molarMassOf(formula),
    ions,
    strength,
    color: precip ? { solid: precip[0] } : undefined,
    hazards: [],
  }
}

function toIonSpec(pair: string[]): IonSpec {
  const [cation, anion] = pair as [string, string]
  const { nCat, nAn } = composeFormula(cation, anion)
  return { cation, anion, nCat, nAn }
}

for (const s of DATA.species) {
  const color = s.color ? Object.fromEntries(Object.entries(s.color).filter(([, v]) => v)) as Species['color'] : undefined
  const ions = s.ions ? toIonSpec(s.ions) : undefined
  const precip = DATA.precipitateColors[s.id]
  registry.set(s.id, {
    id: s.id,
    formula: s.id,
    nameVi: s.nameVi,
    nameEn: s.nameEn,
    class: s.class,
    phase: s.phase,
    molarMass: molarMassOf(s.id),
    ions,
    strength: s.strength,
    element: s.element,
    defaultConc: s.defaultConc,
    concentratedAboveM: s.concentratedAboveM,
    color: color ?? (precip ? { solid: precip[0] } : undefined),
    hazards: s.hazards as Hazard[],
    tags: s.tags,
  })
}

/** Chất theo id (công thức ASCII). Chưa có trong JSON thì ghép từ cặp ion nếu được. Hydrat "CuSO4.5H2O" → chất khan. */
export function findSpecies(id: string): Species | undefined {
  const base = id.split('.')[0]!
  const hit = registry.get(base)
  if (hit) return hit
  const ions = byFormula.get(base)
  if (!ions) return undefined
  const s = composed(base, ions)
  registry.set(base, s)
  return s
}

export function getSpecies(id: string): Species {
  const s = findSpecies(id)
  if (!s) throw new Error(`Unknown species ${id}`)
  return s
}

/** Chất tạo từ cặp ion (hoặc null nếu cặp không bền – xem `unstableProducts`). */
export function speciesFromIons(cation: string, anion: string): Species {
  return getSpecies(composeFormula(cation, anion).formula)
}

export function unstableProducts(cation: string, anion: string): ProductSpec[] | null {
  return DATA.unstable[`${cation}|${anion}`] ?? null
}

export function listSpecies(): Species[] {
  return DATA.species.map((s) => getSpecies(s.id))
}

export const isWeakElectrolyte = (id: string) => DATA.weakElectrolytes.includes(id)

/** Vị trí trong dãy hoạt động (nhỏ = mạnh); H có vị trí riêng. */
export function activityIndex(element: string): number {
  const i = DATA.activity.indexOf(element)
  return i < 0 ? Infinity : i
}
export const H_INDEX = DATA.activity.indexOf('H')

/** Cation của kim loại: số oxi hóa thấp (axit thường, muối) hoặc cao (axit có tính oxi hóa). */
export function metalCation(element: string, high = false): string | undefined {
  const list = DATA.metalCations[element]
  if (!list) return undefined
  return high ? list[list.length - 1] : list[0]
}

export function precipitateColor(id: string): { hex: string; name: string } {
  const c = DATA.precipitateColors[id]
  return c ? { hex: c[0], name: c[1] } : { hex: '#f4f4f0', name: 'trắng' }
}
