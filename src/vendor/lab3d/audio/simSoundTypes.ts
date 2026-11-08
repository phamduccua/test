import type { InteractSounds } from './interact';
import type { SimAudio } from './simAudio';
import type { AmbientLayer, LoopOptions, SfxOptions } from './types';

/** Loop đặt tên: `{ id, ...LoopOptions }` (mức ban đầu mặc định 0). */
export type SimLoopDef = { id: string } & LoopOptions;

export interface SimSfxOptions extends SfxOptions {
  /** Khoảng tối thiểu (s) giữa hai lần phát cùng `key` (mặc định `SimSoundOptions.sfx.minGap`). */
  minGap?: number;
  /** Khoá giới hạn tần suất (mặc định = id). */
  key?: string;
}

export interface SimSoundOptions {
  /** Mã sim (DEV: `window.__snd.sim`). */
  id?: string;
  /** Nền nhiều lớp do kit quản lí (`setAmbient`), ×`pausedAmbient` khi tạm dừng. Bỏ trống = không nền. */
  ambient?: AmbientLayer[];
  /** Thời gian mở nền (s, mặc định 1,5). */
  ambientFade?: number;
  /** Loop quá trình đặt tên (`set`/`pulse`) – im khi tạm dừng. Khai báo thêm bằng `loop(key, id, opts)`. */
  loops?: Record<string, SimLoopDef>;
  /** `ctx.audio.setSpatialScale` – bàn lab (1 đơn vị = 1 dm, camera cách ~7 dm) 4–7; địa cầu bán kính 1 ≈ 2. */
  spatialScale?: number;
  /** Nạp trước âm sự kiện quan trọng (ở cử chỉ đầu nếu chưa được phép). */
  preload?: string[];
  /** Hệ số nền khi tạm dừng (mặc định 0,5). */
  pausedAmbient?: number;
  /** Mặc định cho `sfx`: `minGap` (s), `pitchJitter`, `whilePaused` (mặc định false = bỏ sfx khi tạm dừng). */
  sfx?: { minGap?: number; pitchJitter?: number; whilePaused?: boolean };
  /** Gắn `soundOnInteract(pointerHub(ctx), …)` (âm UI nhấc/đặt/sai/xong bước/xong bài) – bỏ trống/false = không gắn. */
  interact?: Omit<InteractSounds, 'audio'> | false;
  /** Không có `tick()` quá chừng này (ms) → coi là tạm dừng (chỉ khi sim có gọi `tick`). Mặc định 250. */
  pauseMs?: number;
  /** Theo nút chạy/tạm dừng của toolbar (`useSim.playing`) – mặc định true; false cho lab không có nút chạy (Toán). */
  followPlayback?: boolean;
}

/**
 * Âm của một sim trên `ctx.audio`: nền + loop quá trình đặt tên (mức mượt, ×`scale`, `pulse` tắt dần) + sfx có
 * giới hạn tần suất; tự im khi tạm dừng (nút toolbar, hoặc `update` ngừng gọi `tick`): loop → 0, nền ×`pausedAmbient`, sfx bỏ.
 */
export interface SimSound {
  /** `ctx.audio` – dùng thẳng cho âm sim tự trộn (an toàn trước cử chỉ đầu: loop/nền hẹn trước). */
  readonly audio: SimAudio;
  /** Khai báo loop quá trình `key` (mức 0). */
  loop(key: string, id: string, opts?: LoopOptions): void;
  /** Mức mong muốn 0…1 của loop `key` (thực phát = 0 khi tạm dừng, × `scale`). */
  set(key: string, level: number): void;
  setRate(key: string, rate: number): void;
  /** Nhịp: mức loop `key` bật lên `peak` rồi tắt dần theo hằng thời gian `tau` (s) – cú giã, lắc… */
  pulse(key: string, peak?: number, tau?: number): void;
  /** Mức mong muốn của loop `key`. */
  want(key: string): number;
  /** Mức nền lớp `key` (0…1, trước hệ số tạm dừng). */
  setAmbient(key: string, level: number): void;
  /** Phát sfx (bỏ khi tạm dừng – trừ `sfx.whilePaused` – hoặc chưa hết `minGap`); true = đã phát. */
  sfx(id: string, opts?: SimSfxOptions): boolean;
  /** Gọi đầu `update(dt)` của sim; trả false ở lần đầu sau khi tạm dừng (đồng bộ trạng thái mà không phát âm). */
  tick(): boolean;
  readonly paused: boolean;
  /** Đã dựng âm (trang đã có cử chỉ). */
  readonly live: boolean;
  /** Hệ số chung cho mọi loop quá trình (vd. 0,4 khi xem vi mô). */
  scale: number;
  /** DEV: thêm số liệu riêng của sim vào `window.__snd.levels()`. */
  expose(levels: () => Record<string, unknown>): void;
}
