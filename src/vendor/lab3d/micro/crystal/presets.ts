import { IONIC_RADII } from '../elements';
import type { CrystalPreset } from './lattice';

/** Tinh thể sodium chloride (kiểu muối mỏ, a = 5,64 Å). Màu theo SGK Hình 11.1: Na⁺ vàng cam nhỏ, Cl⁻ xanh lục lớn. */
export const NACL: CrystalPreset = {
  id: 'NaCl',
  name: 'sodium chloride',
  a: 5.64,
  nearest: 2.82,
  species: {
    Na: { label: 'Na⁺', name: 'ion sodium', charge: 1, radius: IONIC_RADII['Na+'], color: 0xf6b40e, cpk: 0xab5cf2 },
    Cl: { label: 'Cl⁻', name: 'ion chloride', charge: -1, radius: IONIC_RADII['Cl-'], color: 0x2f9e3a, cpk: 0x1ff01f },
  },
  basis: [
    { species: 'Cl', frac: [0, 0, 0] },
    { species: 'Cl', frac: [0.5, 0.5, 0] },
    { species: 'Cl', frac: [0.5, 0, 0.5] },
    { species: 'Cl', frac: [0, 0.5, 0.5] },
    { species: 'Na', frac: [0.5, 0, 0] },
    { species: 'Na', frac: [0, 0.5, 0] },
    { species: 'Na', frac: [0, 0, 0.5] },
    { species: 'Na', frac: [0.5, 0.5, 0.5] },
  ],
};

/** Số nút mỗi cạnh → extent (ô mạng) cho mạng NaCl. */
export const nodesToExtent = (nodes: number) => (nodes - 1) / 2;
