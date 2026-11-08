import { assetBase } from '../assets';
/** Nạp lười manifest + bộ đệm âm (cache theo id, gộp yêu cầu trùng). */
import { audioCore } from './context';
import { pickFormat } from './model';
import type { SoundEntry, SoundManifest } from './types';
import { labText } from '../text';

// Tính khi gọi (không chốt lúc nạp module): gói lab3d đặt gốc tài nguyên bằng configure() sau khi các module đã nạp.
const base = () => `${assetBase()}audio/`;
let manifest: Promise<Map<string, SoundEntry>> | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const warned = new Set<string>();
let format: 'webm' | 'mp3' | null = null;

function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.info(`[audio] ${msg}`);
}

/** Manifest âm (map id → mục). Bản build một môn chỉ chứa âm của môn đó + `ui/`. */
export function loadManifest(): Promise<Map<string, SoundEntry>> {
  manifest ??= fetch(`${base()}manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<SoundManifest>) : { version: 0, formats: [], sounds: [] }))
    .then((m) => new Map(m.sounds.map((s) => [s.id, s])))
    .catch(() => new Map<string, SoundEntry>());
  return manifest;
}

export async function soundEntry(id: string): Promise<SoundEntry | null> {
  const e = (await loadManifest()).get(id) ?? null;
  if (!e) warnOnce(id, `${labText('t_1d7ef2722cdb')}${id}" trong manifest`);
  return e;
}

function fileFormat(): 'webm' | 'mp3' {
  format ??= pickFormat((m) => document.createElement('audio').canPlayType(m));
  return format;
}

async function fetchDecode(ctx: BaseAudioContext, e: SoundEntry, ext: 'webm' | 'mp3'): Promise<AudioBuffer> {
  const r = await fetch(`${base()}${e.file}.${ext}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return ctx.decodeAudioData(await r.arrayBuffer());
}

/** Bộ đệm đã giải mã của âm `id` (null nếu không có / lỗi – đã ghi log một lần). */
export function loadSound(id: string): Promise<AudioBuffer | null> {
  let p = buffers.get(id);
  if (p) return p;
  // Chưa được phép tạo AudioContext (chưa có cử chỉ) → không giải mã được; không ghi cache để lần sau nạp lại.
  const c = audioCore();
  if (!c) return Promise.resolve(null);
  p = (async () => {
    const e = await soundEntry(id);
    if (!e) return null;
    const ext = fileFormat();
    try {
      return await fetchDecode(c.ctx, e, ext);
    } catch {
      // WebM được báo hỗ trợ nhưng decodeAudioData từ chối (Safari cũ) → thử MP3.
      if (ext === 'webm') {
        try {
          format = 'mp3';
          return await fetchDecode(c.ctx, e, 'mp3');
        } catch {
          /* rơi xuống log */
        }
      }
      warnOnce(id, `${labText('t_346031785804')}${id}"`);
      return null;
    }
  })();
  buffers.set(id, p);
  return p;
}

/** Nạp trước một loạt âm (song song). */
export async function preloadSounds(ids: string[]): Promise<void> {
  await Promise.all(ids.map(loadSound));
}

/** Số bộ đệm đã nạp (dev hook). */
export const loadedCount = () => buffers.size;
