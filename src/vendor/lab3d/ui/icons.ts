/**
 * Bộ icon đơn sắc nét mảnh (lưới 24 px, nét 1,8) cho lớp phủ mô phỏng – thay emoji / kí tự ▶ ⏩ ↺.
 * Cùng dữ liệu cho React (`<Icon>`) và DOM thuần (`iconSvg`). `fill` = icon đặc (play/pause/stop), còn lại vẽ nét.
 */
export const ICONS = {
  play: { fill: true, d: ['M8 5.6v12.8a.8.8 0 0 0 1.2.7l10-6.4a.8.8 0 0 0 0-1.4l-10-6.4a.8.8 0 0 0-1.2.7z'] },
  pause: { fill: true, d: ['M7 5h3.4v14H7z', 'M13.6 5H17v14h-3.4z'] },
  stop: { fill: true, d: ['M7 7h10v10H7z'] },
  forward: { fill: true, d: ['M4 6.4v11.2a.7.7 0 0 0 1.1.6L12 12.6a.7.7 0 0 0 0-1.2L5.1 5.8a.7.7 0 0 0-1.1.6z', 'M12 6.4v11.2a.7.7 0 0 0 1.1.6l6.9-5.6a.7.7 0 0 0 0-1.2l-6.9-5.6a.7.7 0 0 0-1.1.6z'] },
  reset: { d: ['M4.6 12a7.4 7.4 0 1 0 2.2-5.2', 'M4.6 4.4v4.2h4.2'] },
  undo: { d: ['M9 14.5 4.5 10 9 5.5', 'M4.5 10H14a5.25 5.25 0 0 1 0 10.5h-2.5'] },
  info: { d: ['M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2z', 'M12 11v5.4', 'M12 7.7v.1'] },
  sliders: { d: ['M4 7h9.5', 'M18.5 7H20', 'M4 17h3.5', 'M12.5 17H20', 'M16 9.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z', 'M10 19.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z'] },
  gauge: { d: ['M5.5 19.5v-6', 'M12 19.5v-15', 'M18.5 19.5v-10'] },
  alert: { d: ['M10.6 4.6 3 18a1.6 1.6 0 0 0 1.4 2.4h15.2A1.6 1.6 0 0 0 21 18L13.4 4.6a1.6 1.6 0 0 0-2.8 0z', 'M12 9.6v4.4', 'M12 17.2v.1'] },
  check: { d: ['M5 12.5 9.5 17 19 7.5'] },
  close: { d: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'] },
  chevronDown: { d: ['M6.5 9.5 12 15l5.5-5.5'] },
  chevronUp: { d: ['M6.5 14.5 12 9l5.5 5.5'] },
  tag: { d: ['M3.6 12.4V4.6a1 1 0 0 1 1-1h7.8l8 8-8.8 8.8z', 'M8.2 8.2v.1'] },
  // bàn tư liệu báo cáo (geo/report): loại thẻ minh chứng, ô của khung báo cáo, xuất PDF
  book: { d: ['M12 6.6C10.2 5.3 7.8 4.6 5 4.6v13c2.8 0 5.2.7 7 2', 'M12 6.6c1.8-1.3 4.2-2 7-2v13c-2.8 0-5.2.7-7 2', 'M12 6.6v13'] },
  eye: { d: ['M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12z', 'M12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z'] },
  globe: { d: ['M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2z', 'M3.4 12h17.2', 'M12 3.4c2.3 2.4 3.4 5.3 3.4 8.6s-1.1 6.2-3.4 8.6c-2.3-2.4-3.4-5.3-3.4-8.6S9.7 5.8 12 3.4z'] },
  flask: { d: ['M9.5 3.5h5', 'M10.3 3.5v5.3L5 18.2a1.5 1.5 0 0 0 1.3 2.3h11.4a1.5 1.5 0 0 0 1.3-2.3l-5.3-9.4V3.5', 'M7.4 14.5h9.2'] },
  pencil: { d: ['M4.5 19.5l1-4.2L15.8 5a1.8 1.8 0 0 1 2.5 0l.7.7a1.8 1.8 0 0 1 0 2.5L8.7 18.5z', 'M13.8 7l3.2 3.2'] },
  wave: { d: ['M3 9.5c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0', 'M3 14.5c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0'] },
  plus: { d: ['M12 5.5v13', 'M5.5 12h13'] },
  download: { d: ['M12 4v11', 'M7.5 10.5 12 15l4.5-4.5', 'M5 19.5h14'] },
  doc: { d: ['M6.5 3.5H14l4 4v12.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z', 'M14 3.5v4h4', 'M9 12h6', 'M9 15.5h6'] },
  board: { d: ['M4.5 4.5h6v6h-6z', 'M13.5 4.5h6v6h-6z', 'M4.5 13.5h6v6h-6z', 'M13.5 13.5h6v6h-6z'] },
  pin: { d: ['M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z', 'M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z'] },
  flag: { d: ['M5.5 21V4', 'M5.5 4.5h11l-2 4 2 4h-11'] },
  search: { d: ['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z', 'M15.3 15.3 20 20'] },
  bulb: { d: ['M9 17.5h6', 'M10 20.5h4', 'M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.6.5.9 1.2.9 2v1.5h5V16c0-.8.3-1.5.9-2A5.8 5.8 0 0 0 12 3.5z'] },
  megaphone: { d: ['M4 10v4a1 1 0 0 0 1 1h2l8 4.5v-15L7 9H5a1 1 0 0 0-1 1z', 'M18.5 9.5a3.5 3.5 0 0 1 0 5', 'M7.5 15l1.2 4.5'] },
  leaf: { d: ['M5 19c0-8 5-13.5 14-14 0 9-5.5 14-14 14z', 'M5 19c3-4 6-6.5 9-8'] },
  people: { d: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M2.8 20c.6-3.4 3-5.5 6.2-5.5s5.6 2.1 6.2 5.5', 'M16 4.3a3.4 3.4 0 0 1 0 6.4', 'M17.6 14.8c2 .7 3.3 2.5 3.6 5.2'] },
  shield: { d: ['M12 3.5l7 2.8v5.2c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6.3z'] },
  image: { d: ['M4.5 5h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M3.5 16l5-5 4 4 2.5-2.5 5 5', 'M15.5 9.2v.1'] },
  chevronLeft: { d: ['M14.5 6.5 9 12l5.5 5.5'] },
  chevronRight: { d: ['M9.5 6.5 15 12l-5.5 5.5'] },
  voice: { d: ['M5 4.5h10.5A1.5 1.5 0 0 1 17 6v7a1.5 1.5 0 0 1-1.5 1.5H10l-3.6 3.2v-3.2H5A1.5 1.5 0 0 1 3.5 13V6A1.5 1.5 0 0 1 5 4.5z', 'M7 8.2h6.5', 'M7 11h4', 'M19.6 7.2a5 5 0 0 1 0 6.6'] },
  voiceOff: { d: ['M5 4.5h10.5A1.5 1.5 0 0 1 17 6v7a1.5 1.5 0 0 1-1.5 1.5H10l-3.6 3.2v-3.2H5A1.5 1.5 0 0 1 3.5 13V6A1.5 1.5 0 0 1 5 4.5z', 'M7 8.2h6.5', 'M7 11h4', 'M3.5 3.5l17 17'] },
} as const satisfies Record<string, { fill?: boolean; d: readonly string[] }>;

export type IconName = keyof typeof ICONS;

const isFill = (name: IconName) => 'fill' in ICONS[name];

/** Thuộc tính chung của thẻ <svg> (React và chuỗi HTML). */
export function iconAttrs(name: IconName) {
  const fill = isFill(name);
  return { fill: fill ? 'currentColor' : 'none', stroke: fill ? 'none' : 'currentColor' };
}

/** Chuỗi `<svg>` để chèn innerHTML (DOM thuần: bảng bước, chip của sim…). */
export function iconSvg(name: IconName, size = 16): string {
  const a = iconAttrs(name);
  const paths = ICONS[name].d.map((d) => `<path d="${d}"/>`).join('');
  return `<svg class="ui-icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="${a.fill}" stroke="${a.stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
