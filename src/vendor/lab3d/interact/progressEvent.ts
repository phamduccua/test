/** Sự kiện tiến độ thí nghiệm của trang (thanh tiến độ bài học, cảnh giới…) – module không phụ thuộc gì, đọc được mà không nạp bộ 3D. */
export const LAB_PROGRESS_EVENT = 'smartlab:lab-progress';

export interface LabProgressDetail {
  /** Số bước đã xong (0…total). */
  index: number;
  total: number;
  finished: boolean;
}

export function emitLabProgress(index: number, total: number, finished: boolean) {
  window.dispatchEvent(new CustomEvent<LabProgressDetail>(LAB_PROGRESS_EVENT, { detail: { index, total, finished } }));
}
