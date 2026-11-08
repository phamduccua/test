import { DATA } from './data/index'
import type { Mixture } from './model/types'
import { cloneMixture } from './stoich'

/** Cộng nhiệt phản ứng: ΔH (kJ, âm = tỏa nhiệt) → ΔT của dung dịch (coi như nước, 1 g/mL). Kẹp 0…100 °C. */
export function applyHeat(m: Mixture, deltaHkJ: number): Mixture {
  if (m.volumeL <= 0 || !deltaHkJ) return m
  const out = cloneMixture(m)
  const dT = (-deltaHkJ * 1000) / (m.volumeL * 1000 * DATA.thermo.specificHeat)
  out.temperatureC = Math.max(0, Math.min(100, m.temperatureC + dT))
  return out
}

export const dissolveHeat = (id: string) => DATA.thermo.dissolve[id]
