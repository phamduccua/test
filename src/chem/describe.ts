import { ANIONS, CATIONS, DATA, getSpecies, precipitateColor } from './data/index'
import type { Appearance, Mixture } from './model/types'
import { kineticGasRate } from './kinetics'

const KW = 1e-14
const WEAK_ACID_KA: Record<string, number> = { CH3COOH: 1.8e-5, HF: 6.8e-4, H3PO4: 7.1e-3, HClO: 3e-8, Cl2: 4e-4 }
const WEAK_BASE_KB: Record<string, number> = { NH3: 1.8e-5 }
const BLEACH = ['Cl2', 'HClO', 'NaClO', 'KClO']

/** pH ước lượng: axit/bazơ mạnh trước, rồi axit/bazơ yếu, rồi muối thủy phân. */
export function estimatePH(m: Mixture): number | undefined {
  const V = m.volumeL
  if (V <= 0) return undefined
  let h = 0
  for (const [id, mol] of Object.entries(m.solutes)) {
    const s = getSpecies(id)
    if (s.class === 'acid' && s.strength === 'strong' && s.ions) h += mol * s.ions.nCat
    if (s.class === 'base' && s.strength === 'strong' && s.ions) h -= mol * s.ions.nAn
  }
  const net = h / V
  if (Math.abs(net) > 1e-6) return net > 0 ? -Math.log10(net) : 14 + Math.log10(-net)
  // Không có axit/bazơ mạnh dư: chọn đóng góp lệch khỏi 7 nhiều nhất.
  let best = 7
  const consider = (ph: number) => {
    if (Math.abs(ph - 7) > Math.abs(best - 7)) best = ph
  }
  for (const [id, mol] of Object.entries(m.solutes)) {
    const C = mol / V
    if (C <= 0) continue
    if (WEAK_ACID_KA[id]) consider(-Math.log10(Math.sqrt(WEAK_ACID_KA[id]! * C)))
    if (WEAK_BASE_KB[id]) consider(14 + Math.log10(Math.sqrt(WEAK_BASE_KB[id]! * C)))
    const s = getSpecies(id)
    if (s.class !== 'salt' || !s.ions) continue
    const cat = CATIONS[s.ions.cation]
    const an = ANIONS[s.ions.anion]
    if (cat?.strongBase && an?.hydrolysisPKa !== undefined) consider(14 + Math.log10(Math.sqrt((KW / 10 ** -an.hydrolysisPKa) * C * s.ions.nAn)))
    if (!cat?.strongBase && cat?.hydrolysisPKa !== undefined && (an?.pKa ?? 0) < 0) consider(-Math.log10(Math.sqrt(10 ** -cat.hydrolysisPKa * C * s.ions.nCat)))
  }
  return best
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const WATER = '#e8f1f8'

export function colorDistance(a: string, b: string): number {
  const x = hex(a)
  const y = hex(b)
  return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!)
}

/** Ngoại hình hỗn hợp cho 3D: màu (trộn theo nồng độ chất có màu), độ đục, pH, chỉ thị, sủi bọt. */
export function describe(m: Mixture): Appearance {
  const V = m.volumeL
  const sources: { id: string; w: number; hex: string }[] = []
  if (V > 0) {
    for (const [id, mol] of Object.entries(m.solutes)) {
      const C = mol / V
      const direct = DATA.colored[id]
      if (direct) {
        sources.push({ id, w: Math.min(1, C / direct.cRef), hex: direct.hex })
        continue
      }
      const s = getSpecies(id)
      if (!s.ions) continue
      for (const [ion, n] of [[s.ions.cation, s.ions.nCat], [s.ions.anion, s.ions.nAn]] as const) {
        const c = DATA.colored[ion]
        if (c) sources.push({ id, w: Math.min(1, (C * n) / c.cRef), hex: c.hex })
      }
    }
  }
  sources.sort((a, b) => b.w - a.w)
  const W = sources.reduce((a, s) => a + s.w, 0)
  let rgb = hex(WATER)
  if (W > 0) {
    const mix = [0, 0, 0]
    for (const s of sources) hex(s.hex).forEach((v, i) => (mix[i]! += (v * s.w) / W))
    const k = Math.min(1, W)
    rgb = rgb.map((v, i) => v * (1 - k) + mix[i]! * k)
  }
  let opacity = V > 0 ? 0.12 + 0.75 * Math.min(1, W) : 0
  const pH = estimatePH(m)
  let indicatorState: string | undefined
  if (m.indicator && V > 0) {
    const bands = DATA.indicators[m.indicator] ?? []
    const bleached = m.indicator === 'litmus' && BLEACH.some((b) => (m.solutes[b] ?? 0) > 1e-9)
    if (m.indicator === 'starch') {
      if ((m.solutes.I2 ?? 0) > 1e-9) {
        rgb = hex(bands[0]!.hex)
        opacity = 0.9
        indicatorState = bands[0]!.name
      }
    } else if (bleached) {
      indicatorState = 'bleached'
    } else if (pH !== undefined) {
      const band = bands.find((b) => pH < (b.below ?? 99)) ?? bands[bands.length - 1]!
      indicatorState = band.name
      if (!band.clear) {
        rgb = rgb.map((v, i) => v * 0.25 + hex(band.hex)[i]! * 0.75)
        opacity = Math.max(opacity, 0.6)
      }
    }
  }
  // Kết tủa (chất rắn không phải kim loại mẫu) làm đục dung dịch.
  let precipMol = 0
  let precipId: string | undefined
  let precipMax = 0
  for (const [id, mol] of Object.entries(m.solids)) {
    const s = getSpecies(id)
    if (s.class === 'metal' || mol <= 0) continue
    precipMol += mol
    if (mol > precipMax) {
      precipMax = mol
      precipId = id
    }
  }
  const turbidity = V > 0 ? Math.min(1, precipMol / V / 0.01) : 0
  const gasBubbling = Math.min(1, kineticGasRate(m) / DATA.kinetics.gasIntensityRef)
  return {
    colorHex: toHex(rgb),
    opacity,
    turbidity,
    pH,
    hasPrecipitate: precipMol > 0,
    precipitateColorHex: precipId ? precipitateColor(precipId).hex : undefined,
    gasBubbling,
    indicatorState,
    colorSources: sources.filter((s) => s.w > 0.05).map((s) => s.id),
  }
}
