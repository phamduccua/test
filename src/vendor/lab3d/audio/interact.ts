/**
 * Âm phản hồi thao tác cho `kit/lab3d/interact` – không cần sửa sim/kit: theo dõi phiên kéo của hub (nhấc/đặt), toast của hub
 * (đỏ = thao tác sai/bị chặn, ✓ = xong bước) và (tuỳ chọn) quy trình (xong bài).
 */
import type { PointerHub, Procedure } from '../interact/index';
import { currentSimAudio, type SimAudio } from './simAudio';

export interface InteractSounds {
  /** Id âm (null = tắt). Mặc định: ui/pick, ui/drop, ui/wrong, ui/step-done, ui/procedure-done. */
  pick?: string | null;
  drop?: string | null;
  wrongDrop?: string | null;
  stepDone?: string | null;
  procedureDone?: string | null;
  /** Nhân âm lượng (mặc định 1). */
  volume?: number;
  /** Quy trình để phát âm "xong bài" khi `finished` chuyển sang true. */
  procedure?: Procedure;
  /** SimAudio đích (mặc định sim đang mở – `ctx.audio`). */
  audio?: SimAudio;
}

const DEFAULTS = { pick: 'ui/pick', drop: 'ui/drop', wrongDrop: 'ui/wrong', stepDone: 'ui/step-done', procedureDone: 'ui/procedure-done' };
/** Lỗi trong khoảng này quanh lúc nhấn/nhả → coi là thao tác bị từ chối (không kêu nhấc/đặt). */
const ERROR_WINDOW_MS = 250;
const patched = new WeakSet<object>();

/** Gắn âm UI vào hub; trả hàm gỡ (hub tự gỡ khi huỷ sim). */
export function soundOnInteract(hub: PointerHub, o: InteractSounds = {}): () => void {
  const ids = { ...DEFAULTS, ...o };
  const vol = o.volume ?? 1;
  const play = (id: string | null | undefined, v = 1) => {
    if (id) (o.audio ?? currentSimAudio())?.sfx(id, { volume: vol * v, pitchJitter: 0.03 });
  };
  let lastError = -1e9;
  let lastOk = -1e9;
  let off = false;

  // Bọc toast.show (một lần mỗi hub): tone 'error' = sai, 'ok' = xong bước.
  const toast = hub.toast;
  const show = toast.show;
  if (!patched.has(toast)) {
    patched.add(toast);
    toast.show = (text, tone = 'error', ms) => {
      if (!off) {
        const now = performance.now();
        if (tone === 'error') {
          if (now - lastError > 400) play(ids.wrongDrop);
          lastError = now;
        } else if (tone === 'ok') {
          if (now - lastOk > 200) play(ids.stepDone);
          lastOk = now;
        }
      }
      show.call(toast, text, tone, ms);
    };
  }

  let wasActive = hub.active;
  let pressAt = 0;
  let picked = false;
  let wasFinished = o.procedure?.finished ?? false;
  const unFrame = hub.onFrame(() => {
    if (off) return;
    const now = performance.now();
    const active = hub.active;
    if (active && !wasActive) {
      pressAt = now;
      picked = false;
    }
    // Nhấc: phiên kéo còn giữ sau một chút mà không có lỗi (từ chối có lí do → toast đỏ ngay khi nhấn).
    if (active && !picked && now - pressAt > 60 && now - lastError > ERROR_WINDOW_MS) {
      picked = true;
      play(ids.pick);
    }
    if (!active && wasActive && picked && now - lastError > ERROR_WINDOW_MS && now - lastOk > ERROR_WINDOW_MS) play(ids.drop);
    wasActive = active;
    const fin = o.procedure?.finished ?? false;
    if (fin && !wasFinished) play(ids.procedureDone);
    wasFinished = fin;
  });

  return () => {
    off = true;
    unFrame();
    if (patched.has(toast)) {
      toast.show = show;
      patched.delete(toast);
    }
  };
}
