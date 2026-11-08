/** Kiểu dữ liệu cho lưới xu hướng bảng tuần hoàn (thuần, không three). */

export interface TrendDatum {
  Z: number;
  symbol: string;
  /** Chu kì (hàng). */
  period: number;
  /** Cột hiển thị (1 = cột đầu tiên, vd. nhóm IA). */
  group: number;
  /** Giá trị vẽ (bán kính pm, năng lượng ion hoá kJ/mol, độ âm điện…). */
  value: number;
  /** Nhóm màu rời rạc (vd. 'blue' / 'red' như sách, 'metal' / 'nonmetal'). */
  category?: string;
}

/** Kiểu mark: quả cầu (bán kính ∝ giá trị), cột (cao ∝ giá trị), hoặc cả hai (cầu trên đỉnh cột). */
export type TrendMode = 'spheres' | 'bars' | 'both';

/** Cách tô màu: theo nhóm rời rạc hoặc thang liên tục theo giá trị. */
export type ColorMode = 'category' | 'scale';

export interface TrendGridOptions {
  /** Đơn vị cảnh / đơn vị giá trị cho bán kính quả cầu (vd. 0.005 đv/pm). */
  sphereScale: number;
  /** Đơn vị cảnh / đơn vị giá trị cho chiều cao cột. Mặc định = 2,4 × sphereScale. */
  barScale?: number;
  /** Cạnh ô tối thiểu (đv cảnh). Ô tự nới để quả cầu lớn nhất không chạm nhau. */
  minCell?: number;
  /** Khe giữa hai quả cầu lớn nhất (đv cảnh). */
  gap?: number;
  mode?: TrendMode;
  colorMode?: ColorMode;
  /** Màu theo `category`. */
  categoryColors?: Record<string, number>;
  /** Thang màu liên tục (từ min → max giá trị). */
  scaleStops?: readonly number[];
  /** Nhãn hàng (chu kì) và cột; mặc định "Chu kì n" / số La Mã + "A". */
  rowLabel?(period: number): string;
  colLabel?(group: number): string;
  /** Định dạng giá trị hiển thị dưới ô (vd. "152"). */
  format?(v: number): string;
  /** Đơn vị ghi trên trục đồ thị phụ (vd. "r (pm)"). */
  unit?: string;
  /** Hiện nhãn kí hiệu trên mark, số dưới ô. */
  labels?: boolean;
}

/** Vị trí đích của mark (toạ độ cục bộ của lưới). */
export interface Slot {
  x: number;
  y: number;
  z: number;
}
