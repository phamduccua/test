/** Kiểu hiển thị phân tử (thuần): bán kính & màu nguyên tử theo từng kiểu. */
import { element } from '../elements';
import { labText } from '../../text';

/** 'ballStick' = que – cầu CPK; 'kit' = bộ lắp ráp nhựa (Hình 12.8); 'spaceFill' = đặc (bán kính van der Waals). */
export type MolStyle = 'ballStick' | 'kit' | 'spaceFill';

export const MOL_STYLE_LABELS: Record<MolStyle, string> = {
  kit: labText('t_9b11ae6dcee0'),
  ballStick: labText('t_edca93df422f'),
  spaceFill: labText('t_bf6bdff3fbe3'),
};

/** Màu quả cầu nhựa trong bộ lắp ráp của SGK: C đen, H trắng, O đỏ, N xanh, Cl xanh lá. */
const KIT_COLORS: Record<string, number> = { C: 0x1c1c1f, H: 0xf3f3f1, O: 0xd9141c, N: 0x2a49c8, Cl: 0x25b14b, S: 0xf0cf1c, F: 0x8fd14f };
const KIT_RADII: Record<string, number> = { H: 0.3, C: 0.42, N: 0.41, O: 0.4 };

/** Màu que nối của bộ lắp ráp (xám nhạt). */
export const KIT_STICK_COLOR = 0xd3d9df;

/** Màu tô theo loại liên kết: đơn xám, đôi cam, ba tím. */
export const BOND_ORDER_COLORS = { 1: 0xb8c0c8, 2: 0xff8a1f, 3: 0xa055f0 } as const;

export function atomRadius(el: string, style: MolStyle): number {
  const e = element(el);
  if (style === 'spaceFill') return e.vdw;
  if (style === 'kit') return KIT_RADII[el] ?? 0.3 + 0.06 * e.vdw;
  return 0.16 + 0.12 * e.vdw;
}

export function atomColor(el: string, style: MolStyle): number {
  if (style === 'kit') return KIT_COLORS[el] ?? element(el).color;
  return element(el).color;
}
