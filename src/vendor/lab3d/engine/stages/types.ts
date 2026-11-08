import type * as THREE from 'three';

/**
 * Kiểu sân khấu: môi trường mặc định Engine dựng trước mỗi mô phỏng.
 * - `lab`   – phòng thí nghiệm (RoomEnvironment, camera nhìn xuống bàn) – Hoá.
 * - `globe` – vũ trụ (env tối, Mặt Trời; nền sao/Ngân Hà do `kit/lab3d/geo/globe`; camera nhìn tâm địa cầu, far 500) – Địa.
 * - `landscape` – cảnh quan ngoài trời (env trời xanh, nền trời, camera fov 50 near 0,5 far 6000, phơi sáng 0,6 cho Sky.js).
 *   Tuỳ chọn: sim Địa đặt `meta.stage = 'landscape'`; `kit/lab3d/geo/landscape` vẫn tự đặt lại được mọi thứ.
 * Thêm kiểu mới: thêm vào union + một StagePreset trong ./presets.ts.
 */
export type StageKind = 'lab' | 'globe' | 'landscape';

/**
 * Env map phụ dùng chung có tên (ngoài env mặc định của sân khấu) – Engine tạo lười, không dispose theo sim.
 * - `lab-studio` – phòng tối + softbox (đỉnh, hai dải đứng hai bên, dải sau): phản chiếu sắc nét trên thuỷ tinh (`createLabLighting`).
 */
export type SharedEnvName = 'lab-studio';

export interface StagePreset {
  kind: StageKind;
  /** Env map PMREM dùng chung (Engine tạo lười một lần cho mỗi kiểu, không dispose theo sim). */
  createEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture;
  /** Nền mặc định (sim được phép tự đặt lại). */
  background: number | null;
  environmentIntensity: number;
  /** `renderer.toneMappingExposure` mặc định (thiếu = 1). */
  exposure?: number;
  camera: { fov: number; position: THREE.Vector3; target: THREE.Vector3; near: number; far: number };
}

/** Sim tự vẽ frame (hậu kỳ…). Engine vẫn vẽ nhãn CSS2D sau đó; `setSize` gọi khi khung đổi kích thước (px CSS). */
export interface RenderHook {
  render(dt: number): void;
  setSize?(width: number, height: number): void;
}
