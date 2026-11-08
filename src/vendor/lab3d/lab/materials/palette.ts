/**
 * Bảng màu dụng cụ dùng chung (sRGB hex) – đặt theo TN-073-05: nhìn rõ trên máy chiếu lớp học.
 * Quy tắc:
 *  - Không vật nào trắng tinh trừ giấy/nhãn. Thân thiết bị ngả ngà (ấm) để tách khỏi mặt bàn xám lạnh.
 *  - Giá trị là albedo: dưới preset bench mặt hướng đèn hiện sáng hơn ~1,5 stop (#56616d trông như #b8c0c8) – chọn màu theo ẢNH CHỤP, không theo mã.
 *  - Đồ lớn (tủ, tủ ấm, tủ an toàn, tủ lạnh) tối hơn mặt bàn + một dải màu nhận diện (ACCENT) + viền/tay nắm tối (TRIM).
 *  - Mỗi dụng cụ nhỏ có ít nhất một phần màu đậm (nắp, quai, cán, núm) để nhận ra từ cuối lớp.
 */
export const LAB_PALETTE = {
  /** Thân kính hiển vi, đèn, máy nhỏ – ngà ấm. */
  instrument: '#d6cdb9',
  /** Vỏ máy (bể ổn nhiệt, máy li tâm, cân, khối gia nhiệt) – xám xanh nhạt. */
  device: '#9ea9b4',
  /** Tủ, tủ ấm, tủ an toàn sinh học, tủ lạnh, tủ ngăn kéo – xám xanh trung bình. */
  cabinet: '#56616d',
  cabinetDark: '#3a434d',
  /** Lòng tủ (nhạt hơn vỏ một chút, vẫn không trắng). */
  liner: '#b4bcc4',
  /** Sứ (cối chày, chén), men tráng. */
  ceramic: '#dcd4c4',
  /** Thùng xốp, khay xốp. */
  foam: '#d8d1bf',
  paper: '#efebe0',
  label: '#f4f1e8',
  /** Viền, tay nắm, chân đế, núm. */
  trim: '#262b33',
  /** Bảng điều khiển, màn hình tắt. */
  panel: '#353c47',
  steel: '#aab1b9',
  rubber: '#9a3b2a',
} as const;

/** Màu nhận diện (nắp, quai, dải màu) – đậm, bão hoà vừa, phân biệt được khi máy chiếu nhạt màu. */
export const LAB_ACCENT = {
  blue: '#1f5fbf',
  red: '#c8372d',
  green: '#2e8b57',
  orange: '#e07b22',
  yellow: '#e2b021',
  purple: '#6c4bb4',
  teal: '#14837a',
  pink: '#d0487f',
  brown: '#8a5a2b',
} as const;

export type LabAccent = keyof typeof LAB_ACCENT;

/** Màu nhận diện → hex (nhận cả tên trong LAB_ACCENT lẫn mã màu tuỳ ý). */
export function accentColor(c: LabAccent | string): string {
  return (LAB_ACCENT as Record<string, string>)[c] ?? c;
}
