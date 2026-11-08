/**
 * Kiểu dữ liệu của bộ máy hóa học.
 *
 * Mô hình theo MỨC PHÂN TỬ: hỗn hợp lưu số mol từng chất (NaCl, HCl, CuSO4…), không tách ion.
 * Ion chỉ dùng để suy luận (ghép cặp trao đổi, tính tan, màu). Cách này cho phương trình phân tử
 * đúng như sách giáo khoa và vẫn tổng quát: luật dựa trên bảng tính tan, dãy hoạt động, độ mạnh axit.
 */
export type Phase = 'aq' | 's' | 'l' | 'g'
export type SpeciesClass =
  | 'acid' | 'base' | 'salt' | 'metal' | 'nonmetal' | 'halogen'
  | 'oxide_basic' | 'oxide_acidic' | 'oxide_amphoteric' | 'oxide_neutral'
  | 'water' | 'gas' | 'peroxide' | 'other'
export type Hazard = 'corrosive' | 'toxic' | 'flammable' | 'oxidizer' | 'irritant' | 'harmful' | 'environment'
export type Solubility = 'S' | 'L' | 'I' | 'D'

export interface IonSpec { cation: string; anion: string; nCat: number; nAn: number }

export interface Species {
  id: string
  formula: string
  nameVi: string
  nameEn: string
  class: SpeciesClass
  /** Trạng thái khi lấy từ lọ (dung dịch, rắn, khí). */
  phase: Phase
  molarMass: number
  ions?: IonSpec
  strength?: 'strong' | 'weak'
  /** Kim loại: ký hiệu nguyên tố. */
  element?: string
  defaultConc?: number
  /** Axit: nồng độ (M) từ đó coi là "đặc". */
  concentratedAboveM?: number
  color?: { solution?: string; solid?: string; gas?: string }
  hazards: Hazard[]
  tags?: string[]
}

export interface KineticProcess {
  /** Khóa luật động học trong chem.json → kinetics. */
  rate: string
  equation: Equation
  progress: number
  /** Số mol đã phản ứng (theo hệ số 1 của phương trình). */
  extent: number
  deltaH?: number
}

export interface Mixture {
  volumeL: number
  /** Chất tan (mol), khóa là id chất. */
  solutes: Record<string, number>
  /** Chất rắn không tan / chưa tan (mol). */
  solids: Record<string, number>
  /** Khí đã thoát ra (mol, tích lũy). */
  gases: Record<string, number>
  temperatureC: number
  indicator?: Indicator
  kinetic?: Record<string, KineticProcess>
}
export type Indicator = 'litmus' | 'phenolphthalein' | 'methyl_orange' | 'universal' | 'starch'

export interface Conditions {
  temperatureC: number
  heated: boolean
  catalyst?: string
  light?: boolean
  inFumeHood: boolean
  open: boolean
}

export type ReasonCode =
  | 'HAPPENED' | 'SAME_CLASS_ACIDS' | 'SAME_CLASS_BASES' | 'PRODUCTS_ALL_SOLUBLE' | 'NO_NEW_ION_PAIR'
  | 'METAL_BELOW_H' | 'METAL_LESS_ACTIVE' | 'WEAKER_OXIDIZER' | 'POTENTIAL_UNFAVORABLE'
  | 'NEEDS_HEAT' | 'NEEDS_CONCENTRATED' | 'NEEDS_CATALYST' | 'PASSIVATED' | 'INERT'
  | 'DILUTION_ONLY' | 'SOLIDS_NO_CONTACT'

export type Phenomenon =
  | { type: 'gas'; species: string; intensity: number; colorHex?: string; note?: string }
  | { type: 'precipitate'; species: string; colorHex: string; colorName: string }
  | { type: 'dissolve'; species: string }
  | { type: 'color_change'; fromHex: string; toHex: string; note?: string }
  | { type: 'decolorize'; species: string }
  | { type: 'metal_coating'; species: string; colorHex: string; colorName: string }
  | { type: 'temperature'; deltaC: number }
  | { type: 'fume'; colorHex: string; note?: string }
  | { type: 'none' }

export interface Term { species: string; coef: number; phase: Phase }
export interface Equation {
  reactants: Term[]
  products: Term[]
  conditions?: string[]
  /** Phản ứng thuận nghịch (⇌). */
  reversible?: boolean
  /** Dạng hiển thị: chỉ số dưới, ↑ ↓, điều kiện. */
  text: string
  /** Dạng ASCII (dò trong test): "2HCl + Na2CO3 -> 2NaCl + CO2 + H2O". */
  ascii: string
}

export interface SafetyWarning { code: string; level: 'info' | 'warning' | 'danger'; messageVi: string }

export interface ReactionResult {
  happened: boolean
  equations: Equation[]
  phenomena: Phenomenon[]
  reasonCode: ReasonCode
  explanationVi: string
  wouldHappenIf?: Partial<Conditions> & { noteVi: string }
  safety: SafetyWarning[]
  mixtureAfter: Mixture
}

export interface Appearance {
  colorHex: string
  /** 0 (trong suốt) … 1. */
  opacity: number
  turbidity: number
  pH?: number
  hasPrecipitate: boolean
  precipitateColorHex?: string
  gasBubbling: number
  /** Tên trạng thái chỉ thị (red, purple, blue, pink, colorless, orange, yellow, blue-violet). */
  indicatorState?: string
  /** Các chất quyết định màu dung dịch (đậm nhất trước). */
  colorSources: string[]
}
