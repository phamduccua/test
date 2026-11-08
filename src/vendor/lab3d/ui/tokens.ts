import { getWebFontFamily } from '../../typography';

/**
 * Token giao diện cho nơi không đọc được CSS var (canvas 2D, vật liệu three): cùng giá trị với tokens.css.
 * Màu PTIT: #DE221A (đỏ logo – logo-ptit-1.svg), #BC2626 (đỏ chủ đạo ptit.edu.vn). Chỉ dùng cho UI, không cho chất/hiện tượng.
 */
export const UI = {
  red: '#de221a',
  redStrong: '#bc2626',
  accent: '#de221a',
  accentText: '#bc2626',
  white: '#ffffff',
  text: '#1d1d1f',
  text2: '#5f5f64',
  text3: '#8e8e93',
  line: 'rgba(60, 60, 67, 0.14)',
  grid: 'rgba(60, 60, 67, 0.1)',
  surface: 'rgba(255, 255, 255, 0.9)',
  ok: '#176b2c',
  okBright: '#34c759',
  warn: '#864e00',
  danger: '#bc2626',
  /** Cùng màu dạng số cho three (Color/MeshBasicMaterial). */
  hex: { accent: 0xde221a, ok: 0x34c759, bad: 0xff3b30, white: 0xffffff },
} as const;

/** Cùng vai trò cho canvas nằm trong bảng tối `.ui-dark` (thẻ kết quả, thẻ mặt cắt…) – giá trị như `.ui-dark` trong tokens.css. */
export const UI_DARK = {
  text: '#f5f5f7',
  text2: '#c7c7cc',
  text3: '#8e8e93',
  line: 'rgba(255, 255, 255, 0.14)',
  grid: 'rgba(255, 255, 255, 0.08)',
  accentText: '#ff6961',
  ok: '#30d158',
  warn: '#ff9f0a',
  danger: '#ff6961',
} as const;

/** Font canvas theo `--font-sans` của dự án (Roboto): `uiFont(12, 500)` → "500 12px Roboto, Arial, sans-serif". */
export function uiFont(px: number, weight: 400 | 500 | 700 = 400): string {
  return `${weight} ${px}px ${getWebFontFamily() || 'Roboto, Arial, sans-serif'}`;
}
