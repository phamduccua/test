/**
 * Kịch bản trải nghiệm lịch sử nhập vai (HistoryVerse): nội dung nằm ở `content/subjects/<môn>.json → scenarios.<MÃ>`,
 * hình học và vị trí ở module sim. Mọi dữ kiện, niên đại lấy từ kịch bản đã duyệt; sim không tự sinh nội dung lịch sử.
 */

/** Độ xác thực: có chứng cứ · phục dựng suy luận · hư cấu phục vụ học tập (phải ghi rõ là minh hoạ). */
export type Trust = 'evidence' | 'inferred' | 'fiction';

/** Nhóm năng lực của rubric: tìm hiểu sử liệu 30 % · nhận thức và tư duy 45 % · vận dụng 25 %. */
export type Dim = 'source' | 'think' | 'apply';

export interface HSource {
  id: string;
  /** Loại sử liệu hiển thị trên thẻ: "Văn bản", "Hiện vật", "Bản đồ"… */
  kind: string;
  title: string;
  body: string;
  /** Nguồn / xuất xứ của dữ kiện. */
  origin: string;
  trust: Trust;
  /** Mã ảnh thật trong danh mục đã kiểm tra nguồn và quyền; không dùng ảnh sinh. */
  assetId?: string;
  referenceUrl?: string;
}

export interface HAsk {
  ask: string;
  /** Gợi mở (Socratic) – hiện trước. */
  hint: string;
  /** Giải thích dựa trên sử liệu – hiện khi người học muốn xem thêm. */
  explain: string;
}

export interface HPickTask {
  type: 'pick';
  dim: Dim;
  prompt: string;
  items: { id: string; text: string; fit: boolean }[];
}
export interface HOrderTask {
  type: 'order';
  dim: Dim;
  prompt: string;
  /** `rank` tăng dần theo thời gian; `when` chỉ hiện sau khi xếp đúng. */
  items: { id: string; text: string; when: string; rank: number }[];
}
export interface HGroupTask {
  type: 'group';
  dim: Dim;
  prompt: string;
  groups: { id: string; label: string }[];
  items: { id: string; text: string; group: string }[];
}
export interface HEvidenceTask {
  type: 'evidence';
  dim: Dim;
  prompt: string;
  /** Sử liệu phù hợp (trong sổ tay); chọn đủ `need` thẻ, không chọn thẻ không phù hợp. */
  fits: string[];
  need: number;
}
export interface HReportTask {
  type: 'report';
  dim: Dim;
  prompt: string;
  claims: { id: string; text: string; fits: string[]; need: number }[];
}
export type HTask = HPickTask | HOrderTask | HGroupTask | HEvidenceTask | HReportTask;

export interface HStation {
  id: string;
  title: string;
  /** Thuyết minh của chặng (thanh bước). */
  caption: string;
  /** Lời dẫn của nhân vật hướng dẫn (hư cấu, minh hoạ). */
  guide: string[];
  asks: HAsk[];
  /** Sử liệu đặt trong chặng (vật bấm được trong cảnh). */
  sources: string[];
  /** Số sử liệu cần tìm trước khi làm nhiệm vụ. */
  need: number;
  task?: HTask;
}

export interface HScenario {
  /** Nhân vật dẫn đường (hư cấu). */
  guide: { name: string; role: string };
  /** Bối cảnh: "Thăng Long, thế kỉ XI"… */
  place: string;
  sources: HSource[];
  stations: HStation[];
  /** Bản kê độ xác thực của cảnh 3D. */
  manifest: { what: string; trust: Trust }[];
  /** Điều học sinh hiểu được sau trải nghiệm (phòng tổng kết). */
  takeaways: string[];
  /** Nhãn 3D của công trình, vật (id → chữ). */
  labels: Record<string, string>;
}

/** Tư thế camera của một chặng. */
export interface HPose {
  pos: [number, number, number];
  target: [number, number, number];
}
