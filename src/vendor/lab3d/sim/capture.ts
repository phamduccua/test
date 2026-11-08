/** Yêu cầu chụp ảnh khung 3D (nút trên khung thí nghiệm của trang): SimHost nằm trong `root` trả ảnh PNG qua `done`. */
export const SIM_CAPTURE_EVENT = 'smartlab:sim-capture';

export interface SimCaptureDetail {
  root: HTMLElement;
  done(blob: Blob | null, simId: string): void;
}

export function requestSimCapture(root: HTMLElement, done: SimCaptureDetail['done']) {
  window.dispatchEvent(new CustomEvent<SimCaptureDetail>(SIM_CAPTURE_EVENT, { detail: { root, done } }));
}
