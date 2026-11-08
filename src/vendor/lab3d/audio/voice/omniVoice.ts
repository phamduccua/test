/**
 * Giọng đọc tiếng Việt từ T2S OmniVoice (PTIT AI Tools, https://aitools.ptit.edu.vn/omnivoice/docs) – engine đầu tiên của narrator
 * (engines.ts), trước clip dựng sẵn và Web Speech. Mỗi câu/đoạn gọi POST `/v1/stream-voice-clone-presets` (JSON
 * `{ text, speaker_id, speed, language: 'vi', … }`) → trả thẳng WAV 24 kHz; không cần khoá API, server cho phép CORS.
 * Âm thanh lưu thành blob URL trong bộ nhớ (cache theo câu + tốc độ) rồi phát bằng clipPlayer trên AudioContext chung (theo âm lượng /
 * tắt tiếng / tạm dừng của lab). Gọi lỗi hoặc quá `TIMEOUT_MS` → 'error' để narrator lùi về engine sau; lỗi liên tiếp `MAX_FAILS`
 * lần thì engine báo 'none' tới hết phiên (không chờ mạng ở mỗi bước).
 * Cấu hình qua biến môi trường Vite: `VITE_OMNIVOICE_URL` (mặc định URL dưới), `VITE_OMNIVOICE_SPEAKER` (mặc định `speaker_01` –
 * Linh, nữ miền Bắc; danh sách: GET `/v1/presets`), `VITE_OMNIVOICE=off` để tắt.
 */
import { PART_GAP_MS, playClips } from './clipPlayer';
import { getVoiceSettings } from './settings';
import type { EngineStatus, VoiceEngine } from './types';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const OMNIVOICE_URL = (env.VITE_OMNIVOICE_URL || 'https://aitools.ptit.edu.vn/omnivoice').replace(/\/+$/, '');
export const OMNIVOICE_SPEAKER = env.VITE_OMNIVOICE_SPEAKER || 'speaker_01';
const DISABLED = env.VITE_OMNIVOICE === 'off';
/** Bước khử nhiễu của mô hình (16 = nhanh, 24 cân bằng chất lượng/tốc độ theo tài liệu API). */
const NUM_STEP = 16;
const TIMEOUT_MS = 8000;
const MAX_FAILS = 3;
const MAX_CACHE = 120;

export interface OmniClip {
  url: string;
  ms: number;
}

let fails = 0;
const listeners = new Set<() => void>();
const emit = () => [...listeners].forEach((l) => l());
const cache = new Map<string, Promise<OmniClip | null>>();
const known = new Map<string, OmniClip>();

const clampSpeed = (r: number) => Math.round(Math.min(2, Math.max(0.5, r || 1)) * 20) / 20;
const keyOf = (text: string, speed: number) => `${speed}|${text}`;

/** Độ dài (ms) của WAV PCM: byteRate ở byte 28, dữ liệu sau khối 'data' (luồng chunked có thể ghi kích thước 0/0xFFFFFFFF → dùng cỡ file). */
export function wavMs(buf: ArrayBuffer): number {
  const v = new DataView(buf);
  if (buf.byteLength < 44 || v.getUint32(0, false) !== 0x52494646) return 0;
  const byteRate = v.getUint32(28, true) || 48000;
  let off = 12;
  let data = buf.byteLength - 44;
  while (off + 8 <= buf.byteLength) {
    const id = v.getUint32(off, false);
    const size = v.getUint32(off + 4, true);
    if (id === 0x64617461) {
      data = size > 0 && size < 0xffffffff && off + 8 + size <= buf.byteLength ? size : buf.byteLength - off - 8;
      break;
    }
    off += 8 + size + (size % 2);
  }
  return Math.round((data / byteRate) * 1000);
}

function store(k: string, p: Promise<OmniClip | null>) {
  cache.set(k, p);
  while (cache.size > MAX_CACHE) {
    const old = cache.keys().next().value as string;
    void cache.get(old)?.then((c) => c && URL.revokeObjectURL(c.url));
    cache.delete(old);
    known.delete(old);
  }
}

/** Âm thanh của một câu (đã cache). null = API lỗi / quá giờ. */
export function omniClip(text: string, speed = 1): Promise<OmniClip | null> {
  const t = text.replace(/\s+/g, ' ').trim();
  const s = clampSpeed(speed);
  const k = keyOf(t, s);
  const hit = cache.get(k);
  if (hit) return hit;
  if (DISABLED || !t || typeof fetch === 'undefined') return Promise.resolve(null);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const p = fetch(`${OMNIVOICE_URL}/v1/stream-voice-clone-presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: t, speaker_id: OMNIVOICE_SPEAKER, num_step: NUM_STEP, speed: s, language: 'vi', sampling_rate: 24000 }),
    signal: ctrl.signal,
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`omnivoice ${r.status}`);
      const buf = await r.arrayBuffer();
      const ms = wavMs(buf);
      if (!ms) throw new Error('omnivoice: not wav');
      const clip = { url: URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })), ms };
      known.set(k, clip);
      if (fails) {
        fails = 0;
        emit();
      }
      return clip;
    })
    .catch(() => {
      cache.delete(k);
      if (++fails === MAX_FAILS) emit();
      return null;
    })
    .finally(() => clearTimeout(timer));
  store(k, p);
  return p;
}

const status = (): EngineStatus => (DISABLED || typeof fetch === 'undefined' || fails >= MAX_FAILS ? 'none' : 'ready');

export const omniVoiceEngine: VoiceEngine = {
  id: 'omnivoice',
  status,
  onStatus(cb) {
    listeners.add(cb);
    return () => void listeners.delete(cb);
  },
  covers: (parts) => status() === 'ready' && parts.some((x) => x.trim()),
  async speak(parts, p, setCancel) {
    // Tốc độ đọc do OmniVoice tạo (giữ cao độ tự nhiên) – phát lại ở tốc độ 1; âm lượng/tắt tiếng do master gain của AudioContext chung.
    const clips = await Promise.all(parts.filter((x) => x.trim()).map((x) => omniClip(x, p.rate)));
    if (!clips.length || clips.some((c) => !c)) return 'error';
    return playClips(clips.map((c) => ({ url: c!.url, ms: c!.ms, joined: false })), 1, setCancel);
  },
  durationMs(parts) {
    const s = clampSpeed(getVoiceSettings().rate);
    const list = parts.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const clips = list.map((x) => known.get(keyOf(x, s)));
    if (!clips.length || clips.some((c) => !c)) return null;
    return Math.round(clips.reduce((a, c) => a + c!.ms, 0) + (list.length - 1) * PART_GAP_MS);
  },
  prefetch(parts) {
    // Tạo trước lời bước kế tiếp ở tốc độ đang chọn – tới bước là âm thanh đã sẵn.
    for (const x of parts) void omniClip(x, getVoiceSettings().rate);
  },
};
