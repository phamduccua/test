import type * as THREE from 'three';

/** 'ambient' = nền loop nhiều lớp; 'sfx' = âm sự kiện/âm liên tục của vật; 'ui' = phản hồi thao tác chung. */
export type SoundType = 'ambient' | 'sfx' | 'ui';

/** Một mục trong lab3d/audio/manifest.json. */
export interface SoundEntry {
  /** `<nhóm>/<tên>` – nhóm: `ui` (chung), `lab` (Hoá), `geo` (Địa). */
  id: string;
  /** Đường dẫn trong `lab3d/audio`, không đuôi (thêm `.webm` | `.mp3`). */
  file: string;
  type: SoundType;
  /** Tệp đã cắt thành vòng lặp liền mạch. */
  loop: boolean;
  /** Âm lượng mặc định (0…1) khi phát. */
  gain: number;
  duration: number;
  channels: number;
  desc: string;
  source: string;
  license: string;
  author: string;
  title: string;
  url: string;
}

export interface SoundManifest {
  version: number;
  formats: string[];
  sounds: SoundEntry[];
}

/** Vị trí phát trong cảnh: điểm cố định hoặc vật (đọc vị trí thế giới mỗi frame). */
export type SoundAt = THREE.Vector3 | THREE.Object3D;

export interface SpatialOptions {
  /** Định vị 3D (PannerNode HRTF theo camera của sim). */
  at?: SoundAt;
  /** Khoảng cách (đơn vị cảnh) bắt đầu nhỏ dần – mặc định theo `SimAudio.setSpatialScale` (1). */
  refDistance?: number;
}

export interface SfxOptions extends SpatialOptions {
  /** Nhân với gain mặc định của âm (mặc định 1). */
  volume?: number;
  /** Tốc độ phát (đổi cao độ), mặc định 1. */
  rate?: number;
  /** Lệch cao độ ngẫu nhiên ± (tỉ lệ, vd. 0.06 = ±6 %) – tránh lặp đơn điệu. */
  pitchJitter?: number;
  /** Trễ (s) trước khi phát. */
  delay?: number;
}

export interface LoopOptions extends SpatialOptions {
  /** Mức ban đầu 0…1 (mặc định 1) – xem `SoundLoop.set`. */
  level?: number;
  /** Nhân với gain mặc định (mặc định 1). */
  volume?: number;
  rate?: number;
  /** Thời gian (s) chuyển mức (mặc định 0.25). */
  smooth?: number;
}

/** Âm liên tục điều khiển được (sủi bọt ∝ tốc độ khí, rót ∝ lưu lượng, lửa ∝ cỡ lửa…). */
export interface SoundLoop {
  /** Mức 0…1 (0 = im, tự ngừng giải mã khi im lâu). */
  set(level: number): void;
  setRate(rate: number): void;
  readonly level: number;
  /** Tắt dần rồi giải phóng. */
  stop(fade?: number): void;
}

export interface AmbientLayer {
  /** Khoá lớp (mặc định = id âm) – dùng trong `Ambient.set`. */
  key?: string;
  id: string;
  /** Mức ban đầu 0…1 (mặc định 1). */
  level?: number;
  volume?: number;
}

/** Nền nhiều lớp, mỗi lớp loop crossfade; mức theo tham số (mưa ∝ cường độ, gió ∝ tốc độ, rừng ↓ khi phá rừng). */
export interface Ambient {
  set(key: string, level: number): void;
  level(key: string): number;
  /** Tắt dần cả nền. */
  stop(fade?: number): void;
}

export interface AudioSettings {
  /** Âm lượng tổng 0…1. */
  volume: number;
  muted: boolean;
}
