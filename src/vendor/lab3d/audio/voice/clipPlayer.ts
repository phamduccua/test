/**
 * Plays pre-generated voice clips on the kit's shared AudioContext (audio/context.ts), so they follow the lab sound
 * policy: unlocked at the first user gesture, routed through the master gain (global volume / mute), paused with the
 * tab. Clip bytes can be fetched ahead (also before the first gesture); they are decoded on first use. Both caches are
 * small (oldest dropped first). A context that will not run, a failed download or a decode error → 'error', so the
 * narrator falls back to the next engine.
 */
import { audioCore } from '../context';
import type { SpeakEnd } from './types';

/** Pause between two parts (or sentences) of one announcement (ms, at rate 1 not scaled). */
export const PART_GAP_MS = 120;
/**
 * Pieces of one sentence (pieces.ts) follow each other without that pause: the silence a clip keeps at its edges
 * (≈ 50 ms before, ≈ 120 ms after) is cut down to these (s).
 */
const JOIN_HEAD_S = 0.03;
const JOIN_TAIL_S = 0.09;

/** One clip of an announcement: its URL, its length (ms, from the index), glued to the clip before it. */
export interface ClipCue {
  url: string;
  ms: number;
  joined: boolean;
}

/** Where a clip is cut (s): head trimmed when glued to the clip before, tail when the next one is glued to it. */
const cutsOf = (cues: readonly ClipCue[], i: number) => ({ head: cues[i].joined ? JOIN_HEAD_S : 0, tail: cues[i + 1]?.joined ? JOIN_TAIL_S : 0 });

/** Spoken length (ms) of the cues at `rate`, pauses and cuts included. */
export function clipsMs(cues: readonly ClipCue[], rate: number): number {
  return Math.round(cues.reduce((sum, c, i) => {
    const { head, tail } = cutsOf(cues, i);
    return sum + Math.max(0, c.ms - (head + tail) * 1000) / rate + (i && !c.joined ? PART_GAP_MS : 0);
  }, 0));
}
/** How long a suspended context may take to resume before the clip engine gives up. */
const RESUME_MS = 800;

type Core = NonNullable<ReturnType<typeof audioCore>>;

function cache<T>(max: number) {
  const m = new Map<string, T>();
  return {
    get(k: string): T | undefined {
      const v = m.get(k);
      if (v !== undefined) {
        m.delete(k);
        m.set(k, v);
      }
      return v;
    },
    set(k: string, v: T): void {
      m.set(k, v);
      while (m.size > max) m.delete(m.keys().next().value as string);
    },
    delete: (k: string) => void m.delete(k),
  };
}

const bytes = cache<Promise<ArrayBuffer | null>>(64);
const buffers = cache<Promise<AudioBuffer | null>>(24);

function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  let p = bytes.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null)
      .then((b) => {
        if (!b) bytes.delete(url); // network hiccup: try again next time
        return b;
      });
    bytes.set(url, p);
  }
  return p;
}

function decoded(c: Core, url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url);
  if (!p) {
    // decodeAudioData detaches its input: decode a copy so the byte cache stays usable.
    p = fetchBytes(url)
      .then((b) => (b ? c.ctx.decodeAudioData(b.slice(0)) : null))
      .catch(() => null)
      .then((a) => {
        if (!a) buffers.delete(url);
        return a;
      });
    buffers.set(url, p);
  }
  return p;
}

/** Warms the byte cache for these clips (no AudioContext needed). */
export function prefetchClips(urls: readonly string[]): void {
  for (const u of urls) void fetchBytes(u);
}

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

async function running(c: Core): Promise<boolean> {
  if (c.ctx.state !== 'running') await Promise.race([c.ctx.resume().catch(() => {}), wait(RESUME_MS)]);
  return c.ctx.state === 'running';
}

function playBuffer(c: Core, buf: AudioBuffer, rate: number, delayS: number, cut: { head: number; tail: number }, setStop: (s: () => void) => void): Promise<SpeakEnd> {
  // Never cut more than a short clip has: at least half of it is played.
  const head = Math.min(cut.head, buf.duration / 4);
  const length = Math.max(buf.duration / 2, buf.duration - head - cut.tail);
  return new Promise<SpeakEnd>((resolve) => {
    const src = c.ctx.createBufferSource();
    const gain = c.ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.connect(gain).connect(c.master);
    let done = false;
    const finish = (e: SpeakEnd) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      src.onended = null;
      resolve(e);
    };
    const silence = () => {
      const t = c.ctx.currentTime;
      gain.gain.setTargetAtTime(0, t, 0.015);
      try {
        src.stop(t + 0.08);
      } catch {
        /* never started */
      }
      window.setTimeout(() => gain.disconnect(), 200);
    };
    // No 'ended' in time (context stalled): give up so the narrator never hangs.
    const timer = window.setTimeout(() => {
      silence();
      finish('error');
    }, ((delayS + length / rate) * 1000) + 3000);
    src.onended = () => {
      gain.disconnect();
      finish('end');
    };
    setStop(() => {
      silence();
      finish('cancel');
    });
    src.start(c.ctx.currentTime + delayS, head, length);
  });
}

/** Plays the clips one after another; resolves on the real end of the last one, on cancel, or 'error'. */
export async function playClips(cues: readonly ClipCue[], rate: number, setCancel: (stop: () => void) => void): Promise<SpeakEnd> {
  const c = audioCore();
  if (!c || !cues.length) return 'error';
  let cancelled = false;
  let stopPart = () => {};
  setCancel(() => {
    cancelled = true;
    stopPart();
  });
  const r = Math.min(2, Math.max(0.5, rate || 1));
  const all = cues.map((x) => decoded(c, x.url));
  if (!(await running(c))) return cancelled ? 'cancel' : 'error';
  for (let i = 0; i < all.length; i++) {
    const buf = await all[i];
    if (cancelled) return 'cancel';
    if (!buf) return 'error';
    const gap = i && !cues[i].joined ? PART_GAP_MS / 1000 : 0;
    const end = await playBuffer(c, buf, r, gap, cutsOf(cues, i), (s) => (stopPart = s));
    if (cancelled) return 'cancel';
    if (end !== 'end') return end;
  }
  return 'end';
}
