import type { ParticleConfig } from './particleModel';

/** Cấu hình sẵn (đơn vị dm). Màu theo Phần V §5.7. */
export interface ParticlePreset {
  config: ParticleConfig;
  color: string;
  /** additive cho hơi sáng; normal cho khói/khí màu. */
  additive?: boolean;
}

const base: ParticleConfig = {
  rate: 30,
  maxCount: 400,
  life: [2, 4],
  size: [0.12, 0.7],
  velocity: [0, 0.35, 0],
  spread: 0.06,
  buoyancy: 0.08,
  drag: 0.6,
  turbulence: 0.12,
  emitRadius: 0.08,
  opacity: 0.45,
};

export const PARTICLE_PRESETS = {
  /** Hơi nước bốc lên. */
  steam: { color: '#fbfcfd', config: { ...base, rate: 30, opacity: 0.6, life: [1.6, 3.2], size: [0.08, 0.75] } },
  /** Khói xám. */
  smoke: { color: '#8a8f96', config: { ...base, rate: 20, opacity: 0.5, life: [3, 5], size: [0.15, 1.2] } },
  /** Khói trắng (HCl + ẩm, NH4Cl, MgO). */
  whiteSmoke: { color: '#f0f0f0', config: { ...base, rate: 30, opacity: 0.55, size: [0.15, 1.0] } },
  /** Cl2 vàng lục – nặng, chìm và loang. */
  chlorine: {
    color: '#c8e05a',
    config: { ...base, velocity: [0, 0.05, 0], buoyancy: -0.12, opacity: 0.4, life: [4, 7], size: [0.2, 1.1] },
  },
  /** Hơi Br2 nâu đỏ – rất nặng. */
  bromine: {
    color: '#a0381e',
    config: { ...base, velocity: [0, 0.04, 0], buoyancy: -0.16, opacity: 0.45, life: [4, 7], size: [0.2, 1.0] },
  },
  /** Hơi I2 tím (thăng hoa). */
  iodine: {
    color: '#8b3fd9',
    config: { ...base, velocity: [0, 0.18, 0], buoyancy: 0.02, opacity: 0.45, life: [2.5, 4.5], size: [0.12, 0.8] },
  },
} satisfies Record<string, ParticlePreset>;

export type ParticlePresetName = keyof typeof PARTICLE_PRESETS;
