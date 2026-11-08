/** Types of the step procedure (`createProcedure`, kit/lab3d/interact/procedure.ts). */
import type { HintPoint } from './hint';

export interface ProcedureStep {
  id: string;
  /** Tên ngắn (bảng bước). */
  title: string;
  /** Thuyết minh + hướng dẫn thao tác ("Kéo đinh sắt thả vào miệng ống 1"). */
  caption: string;
  /** Vật/điểm mũi tên gợi ý chỉ vào (null = không chỉ). */
  hint?: () => HintPoint;
  /** Khi trở thành bước hiện tại. */
  enter?(): void;
  /** "Tự động" (demo): chạy CÙNG các action của thao tác tay, xong gọi `done()` (hoặc để sự kiện thật gọi `complete`). */
  auto?(done: () => void): void;
  /** Hoàn tác bước này (đưa cảnh về trước bước). */
  undo?(): void;
  /**
   * Bỏ qua bước (biến thể quy trình theo tham số – vd. kiểu tiêu bản, không nhỏ dầu): tới lượt mà trả true thì quy trình tự sang bước
   * sau (không toast, không đếm trên bảng bước); hoàn tác cũng nhảy qua. Đọc lại mỗi lần vào bước.
   */
  skip?(): boolean;
}

export interface ProcedureOptions {
  steps: ProcedureStep[];
  /** Nút trong lil-gui (thư mục "Quy trình"), mặc định true. */
  gui?: boolean;
  /** Bảng bước HTML trên khung (mặc định true). */
  panel?: boolean;
  /** Đặt ctx.caption theo bước (mặc định true; false khi sim tự thuyết minh liên tục – tên bước vẫn hiện trên bảng). */
  captions?: boolean;
  /** Nghỉ giữa các bước khi demo (s, mặc định 0,8). */
  demoPause?: number;
  /** Chỉ hiện mũi tên gợi ý khi trả true (vd. `() => stage.mode === 'macro'` – vi mô không có dụng cụ để chỉ). */
  hintWhen?(): boolean;
  /** Tâm ngang (px khung) của bảng bước – vd. giữa phần khung trống bên phải bảng trái; null/bỏ qua = giữa khung. */
  panelLeft?(): number | null;
  onStep?(step: ProcedureStep | null, index: number): void;
  /** "Làm lại từ đầu": đưa cảnh về trạng thái ban đầu (bắt buộc nên có; không thì hoàn tác lần lượt từng bước). */
  onRestart?(): void;
  onFinish?(): void;
  /** Thuyết minh khi xong hết. */
  finishCaption?: string;
}

export interface Procedure {
  readonly current: ProcedureStep | null;
  readonly index: number;
  readonly finished: boolean;
  readonly demoing: boolean;
  /** Bước `id` vừa được làm (từ drag/drop/pour/knob…): đúng bước hiện tại → chuyển bước; trả true nếu đã nhận. */
  complete(id: string): boolean;
  is(id: string): boolean;
  isDone(id: string): boolean;
  /** Thao tác sai: toast đỏ + đếm. */
  wrong(message: string): void;
  undo(): void;
  restart(): void;
  demo(): void;
  stop(): void;
  /** Vẽ lại tên bước trên bảng bước (tên động theo tiến độ trong bước, vd. "Gắp mảnh lá (3/5)") – không đổi caption, không gọi onStep. */
  retitle(): void;
}
