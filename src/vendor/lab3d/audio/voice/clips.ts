/**
 * Pre-generated Vietnamese voice clips as a narrator engine, tried before Web Speech: step guidance speaks in browsers
 * without a vi-VN voice (e.g. Chrome on Windows without the speech pack). One MP3 per spoken part at
 * /api/assets/voice/<key>.mp3 (key: clipKey.ts); voice/index.json = { v: 1, clips: { <key>: <durationMs> } } is fetched
 * once per session and only listed clips are ever requested. A part without a clip of its own is said sentence by
 * sentence, a sentence without one from the text around its numbers and a clip per number (pieces.ts). No index, or an
 * empty one → status 'none' (Web Speech or silence, the caption stays). Publishing new clips + index needs no code change.
 */
import { apiAssetUrl } from '../../../../data/contentApi';
import { clipKey } from './clipKey';
import { clipsMs, playClips, prefetchClips, type ClipCue } from './clipPlayer';
import { resolvePieces } from './pieces';
import { getVoiceSettings } from './settings';
import type { EngineStatus, VoiceEngine } from './types';

const DIR = '/api/assets/voice/';
let index: Map<string, number> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Index file → key → duration (ms); anything malformed counts as empty. */
export function parseClipIndex(data: unknown): Map<string, number> {
  const d = data as { v?: unknown; clips?: unknown } | null;
  const out = new Map<string, number>();
  if (!d || d.v !== 1 || !d.clips || typeof d.clips !== 'object') return out;
  for (const [k, ms] of Object.entries(d.clips as Record<string, unknown>)) {
    if (/^[0-9a-f]{16}$/.test(k) && typeof ms === 'number' && Number.isFinite(ms) && ms > 0) out.set(k, ms);
  }
  return out;
}

function load(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  loading ??= fetch(apiAssetUrl(`${DIR}index.json`))
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((data) => {
      index = parseClipIndex(data);
      plans.clear();
      for (const l of [...listeners]) l();
    });
  return loading;
}

function status(): EngineStatus {
  void load();
  return !index ? 'loading' : index.size ? 'ready' : 'none';
}

const clipUrl = (key: string) => apiAssetUrl(`${DIR}${key}.mp3`);

/** Clips (in order) that say one part; null = it cannot be said from clips. Cached once the index is there. */
const plans = new Map<string, Promise<ClipCue[] | null>>();
function plan(part: string): Promise<ClipCue[] | null> {
  let p = plans.get(part);
  if (!p) {
    const keyOf = new Map<string, string>();
    const has = async (text: string) => {
      const k = await clipKey(text);
      keyOf.set(text, k);
      return !!index?.has(k);
    };
    p = resolvePieces(part, has).then((pieces) => pieces?.map((x) => ({ url: clipUrl(keyOf.get(x.text)!), ms: index!.get(keyOf.get(x.text)!)!, joined: x.joined })) ?? null);
    if (index) {
      if (plans.size > 500) plans.clear();
      plans.set(part, p);
    }
  }
  return p;
}
/** Settled plans, for the synchronous `durationMs`. */
const known = new Map<string, ClipCue[] | null>();
async function cues(parts: readonly string[]): Promise<ClipCue[] | null> {
  const all = await Promise.all(parts.map(async (part) => {
    const c = await plan(part);
    if (known.size > 500) known.clear();
    known.set(part, c);
    return c;
  }));
  return all.length && all.every(Boolean) ? all.flatMap((c) => c!) : null;
}

export const clipEngine: VoiceEngine = {
  id: 'clips',
  status,
  onStatus(cb) {
    listeners.add(cb);
    return () => void listeners.delete(cb);
  },
  async covers(parts) {
    if (status() !== 'ready' || !parts.length) return false;
    return !!(await cues(parts));
  },
  async speak(parts, p, setCancel) {
    // The master gain of the shared AudioContext already applies volume / mute (p.volume is that same gain).
    const c = await cues(parts);
    return c ? playClips(c, p.rate, setCancel) : 'error';
  },
  durationMs(parts) {
    const c = parts.map((x) => known.get(x));
    if (!index || !c.length || c.some((x) => !x)) return null;
    const rate = Math.min(2, Math.max(0.5, getVoiceSettings().rate || 1));
    return clipsMs(c.flatMap((x) => x!), rate);
  },
  async prefetch(parts) {
    await load();
    const c = await cues(parts);
    if (c) prefetchClips(c.map((x) => x.url));
  },
};
