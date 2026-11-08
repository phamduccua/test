import { pointerHub } from './pointer';
import { createScrub, type Scrub, type ScrubOptions } from './scrub';
import type { InteractCtx } from './types';
import { labText } from '../text';

export interface ForwardScrubOptions {
  label: string;
  /** Thời gian hiện tại (null = chưa có mẫu – thanh ẩn) và tổng thời gian theo dõi (cùng đơn vị). */
  now(): number | null;
  end(): number;
  /** Tua thêm `d` (> 0) – mô hình chạy tới, chụp/lấy mẫu đúng các mốc. */
  advance(d: number): void;
  /** Lí do chưa được tua (chưa bật máy / đang làm bước khác…); null = được. */
  blocked?(): string | null;
  /** Lí do khi kéo lùi (mặc định: thời gian chỉ trôi tới). */
  backward?: string;
  /** Thao tác sai (toast + đếm lỗi của quy trình). */
  wrong(msg: string): void;
  /** Vừa tua (≤ 1 lần / 0,6 s) – vd. tiếng đồng hồ bấm giây. */
  onSeek?(): void;
  format(t: number): string;
  width?: number;
  place?: ScrubOptions['place'];
}

export interface ForwardScrub {
  scrub: Scrub;
  /** Demo: kéo thanh tới phần `to` (0…1) trong `s` giây – cùng đường tua như tay; dừng sớm khi bị chặn (mô hình dừng ở mốc). */
  glide(to: number, s: number, done?: () => void): void;
}

/**
 * Thanh tua thời gian CHỈ TỚI cho mô hình chạy dần (quần thể vi khuẩn, lên men…): kéo phải = tua nhanh, kéo lùi / chưa được tua → lí do
 * (một lần mỗi lần kéo). Dùng chung: TN-122-01 (time-lapse E. coli), TN-125-01 (đường cong sinh trưởng).
 */
export function createForwardScrub(ctx: InteractCtx, o: ForwardScrubOptions): ForwardScrub {
  const hub = pointerHub(ctx);
  let warned = false;
  let lastSeek = 0;
  const warn = (msg: string) => {
    if (warned) return;
    warned = true;
    o.wrong(msg);
  };
  const seek = (v: number) => {
    const t = o.now();
    if (t === null) return;
    const end = o.end();
    const target = v * end;
    if (Math.abs(target - t) < end * 0.002) return;
    const why = o.blocked?.();
    if (why) return warn(why);
    if (target < t) return warn(o.backward ?? labText('t_cd873168c748'));
    o.advance(target - t);
    const now = performance.now();
    if (now - lastSeek > 600) o.onSeek?.();
    lastSeek = now;
  };
  const scrub = createScrub(ctx, {
    label: o.label, min: 0, max: 1, step: 0.0005, width: o.width, place: o.place,
    value: {
      get: () => {
        const t = o.now();
        return t === null ? 0 : Math.min(1, t / o.end());
      },
      set: seek,
      commit: (v) => {
        seek(v);
        warned = false;
      },
    },
    format: (v) => o.format(v * o.end()),
  });
  ctx.track(hub.onFrame(() => scrub.setVisible(o.now() !== null)));
  return {
    scrub,
    glide(to, s, done) {
      const from = (o.now() ?? 0) / o.end();
      let over = false;
      const finish = () => {
        if (over) return;
        over = true;
        off();
        stop();
        done?.();
      };
      const free = () => !o.blocked?.();
      const stop = hub.tween(s, (k) => free() && seek(from + (to - from) * k), finish);
      const off = hub.onFrame(() => !free() && finish());
    },
  };
}
