import { create } from 'zustand';
import type { HudPlacement, SimView, WarnTone } from './types';

export type SimStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Trạng thái chạy của mô phỏng hiện tại (toolbar, caption, cảnh báo). */
export interface SimRuntimeState {
  status: SimStatus;
  /** Giai đoạn tải khi status = 'loading': 0 = tải mô-đun, 1 = dựng cảnh (create). */
  loadStage: number;
  error: string | null;
  playing: boolean;
  speed: number;
  view: SimView;
  views: SimView[];
  caption: string;
  warning: string | null;
  /** Kiểu thẻ ctx.warn/notice: tiêu đề riêng (null = theo môn) + tông màu. */
  warningTitle: string | null;
  warningTone: WarnTone;
  /** Vị trí HUD (ctx.setHudPlacement), mặc định 'left' = dưới toolbar. */
  hudPlacement: HudPlacement;
  /** Tăng khi người dùng đổi chất lượng → useSimLoader dựng lại sim. */
  qualityRev: number;
  setPlaying(p: boolean): void;
  setSpeed(s: number): void;
}

export const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;

export const useSim = create<SimRuntimeState>((set) => ({
  status: 'idle',
  loadStage: 0,
  error: null,
  playing: true,
  speed: 1,
  view: 'macro',
  views: [],
  caption: '',
  warning: null,
  warningTitle: null,
  warningTone: 'warn',
  hudPlacement: 'left',
  qualityRev: 0,
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
}));
