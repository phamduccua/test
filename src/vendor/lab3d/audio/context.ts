/**
 * AudioContext DÙNG CHUNG cả app (tạo lười): nút master → đích. Chính sách autoplay: KHÔNG tạo context trước khi trang có cử chỉ
 * người dùng (`navigator.userActivation.hasBeenActive`) – Chrome cảnh báo "The AudioContext was not allowed to start" ngay khi tạo
 * và mỗi lần start() trên context chưa được phép. Việc cần âm trước đó xếp hàng qua `onAudioAllowed` (SimAudio dựng loop/nền ở cử
 * chỉ đầu). Tự tạm dừng khi tab ẩn hoặc tắt tiếng, áp âm lượng tổng từ settings.
 */
import { masterGain } from './model';
import { getAudioSettings, onAudioSettings } from './settings';

interface Core {
  ctx: AudioContext;
  master: GainNode;
  /** Đã có cử chỉ người dùng (hoặc trình duyệt cho tự phát). */
  unlocked: boolean;
}

let core: Core | null = null;
/** pointerdown: chuột/bút; touchend/pointerup/click: chạm (Chrome chỉ kích hoạt ở cuối cú chạm). */
const GESTURES = ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click'] as const;
const waiting = new Set<() => void>();
let listening = false;

type ActivationNav = Navigator & { userActivation?: { hasBeenActive: boolean } };

/** Trình duyệt cho tạo/chạy AudioContext: trang đã có cử chỉ (không có API userActivation → coi như được, kiểu cũ). */
export function audioAllowed(): boolean {
  const ua = (navigator as ActivationNav).userActivation;
  return !ua || ua.hasBeenActive || (!!core && core.unlocked);
}

function onGesture(): void {
  if (!audioAllowed()) return; // vd. pointerdown của cú chạm chưa kích hoạt – chờ touchend
  for (const g of GESTURES) window.removeEventListener(g, onGesture, true);
  listening = false;
  if (core) {
    core.unlocked = true;
    sync();
  }
  const cbs = [...waiting];
  waiting.clear();
  for (const cb of cbs) cb();
}

/** Chạy `cb` khi được phép phát âm (ngay nếu đã được; chưa thì ở cử chỉ đầu). Trả hàm huỷ. */
export function onAudioAllowed(cb: () => void): () => void {
  if (audioAllowed()) {
    cb();
    return () => {};
  }
  waiting.add(cb);
  if (!listening) {
    listening = true;
    for (const g of GESTURES) window.addEventListener(g, onGesture, true);
  }
  return () => void waiting.delete(cb);
}

function wanted(c: Core): boolean {
  return c.unlocked && !document.hidden && !getAudioSettings().muted;
}

/** Đồng bộ trạng thái chạy/tạm dừng với (đã mở khoá, tab hiện, không tắt tiếng). */
function sync(): void {
  const c = core;
  if (!c || c.ctx.state === 'closed') return;
  const g = masterGain(getAudioSettings());
  c.master.gain.setTargetAtTime(g, c.ctx.currentTime, 0.03);
  if (wanted(c)) {
    if (c.ctx.state !== 'running') void c.ctx.resume().catch(() => {});
  } else if (c.ctx.state === 'running') {
    // Đợi gain kịp về 0 rồi mới dừng (tránh tiếng tách).
    window.setTimeout(() => {
      if (core === c && !wanted(c) && c.ctx.state === 'running') void c.ctx.suspend().catch(() => {});
    }, 200);
  }
}

/** AudioContext dùng chung – null nếu trình duyệt không có Web Audio hoặc CHƯA được phép (chưa có cử chỉ người dùng). */
export function audioCore(): Core | null {
  if (core) return core;
  if (!audioAllowed()) return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor({ latencyHint: 'interactive' });
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const ua = (navigator as ActivationNav).userActivation;
  // Có userActivation: đã được phép (kiểm ở trên). Không có: chờ cử chỉ (trừ khi trình duyệt cho tự phát → 'running' ngay).
  core = { ctx, master, unlocked: !!ua || ctx.state === 'running' };
  if (!core.unlocked) {
    const unlock = () => {
      for (const g of GESTURES) window.removeEventListener(g, unlock, true);
      if (!core) return;
      core.unlocked = true;
      sync();
    };
    for (const g of GESTURES) window.addEventListener(g, unlock, true);
  }
  document.addEventListener('visibilitychange', sync);
  onAudioSettings(sync);
  sync();
  return core;
}

/** Context đã tạo (không tạo mới) – cho dev hook. */
export const peekAudioCore = (): Core | null => core;

/** Context đang phát được (đã mở khoá, đang chạy) – âm sự kiện bỏ qua khi chưa (không dồn hàng phát một loạt sau). */
export function audioRunning(): boolean {
  return !!core && core.ctx.state === 'running' && core.unlocked;
}
