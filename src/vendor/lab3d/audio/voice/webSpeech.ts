/**
 * Browser Web Speech (`speechSynthesis`) with the best vi-VN voice (voices.ts). Handles the known quirks:
 * - voices load asynchronously ('voiceschanged'; Chrome adds its network voices later) → status 'loading' until a vi
 *   voice appears or a short wait ends ('none' = no Vietnamese voice: stay silent, the caption remains);
 * - Chrome can stop a long utterance after ~15 s → the text is spoken as a chain of sentence chunks;
 * - a `speak()` right after `cancel()` can be dropped, a stuck `paused` state blocks the queue → cancel, short wait,
 *   resume; utterances stay referenced until they end (else `onend` may never fire); a timeout ends a silent utterance.
 */
import { estimateMs, speechChunks } from './text';
import type { EngineStatus, SpeakEnd, SpeechParams, VoiceEngine } from './types';
import { pickVoice } from './voices';

const synth = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);
/** How long to wait for a vi-VN voice before reporting 'none'. */
const LOAD_MS = 2500;
let voice: SpeechSynthesisVoice | null = null;
let status: EngineStatus = 'loading';
let started = false;
let waited = false;
const alive = new Set<SpeechSynthesisUtterance>();
const listeners = new Set<() => void>();

function refresh(): void {
  const s = synth();
  voice = s ? pickVoice(s.getVoices()) : null;
  const next: EngineStatus = voice ? 'ready' : !s || waited ? 'none' : 'loading';
  status = next;
  for (const l of [...listeners]) l();
}

/** Starts listening for voices (idempotent). */
export function initWebSpeech(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const s = synth();
  s?.addEventListener?.('voiceschanged', refresh);
  window.setTimeout(() => {
    waited = true;
    refresh();
  }, LOAD_MS);
  refresh();
}

export function speechStatus(): EngineStatus {
  initWebSpeech();
  return status;
}

/** The chosen vi-VN voice, null when the browser has none (yet). */
export function webSpeechVoice(): SpeechSynthesisVoice | null {
  initWebSpeech();
  return voice;
}

export function onSpeechStatus(cb: () => void): () => void {
  initWebSpeech();
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** All voices (DEV probe). */
export function webSpeechVoices(): { name: string; lang: string; local: boolean }[] {
  return (synth()?.getVoices() ?? []).map((v) => ({ name: v.name, lang: v.lang, local: v.localService }));
}

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function utter(s: SpeechSynthesis, v: SpeechSynthesisVoice, text: string, p: SpeechParams, setStop: (stop: () => void) => void): Promise<SpeakEnd> {
  return new Promise<SpeakEnd>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    Object.assign(u, { voice: v, lang: v.lang, rate: p.rate, pitch: p.pitch, volume: p.volume });
    let done = false;
    const finish = (e: SpeakEnd) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      alive.delete(u);
      resolve(e);
    };
    // No end event in time (engine stuck): give up on this chunk.
    const timer = window.setTimeout(() => {
      s.cancel();
      finish('error');
    }, estimateMs(text, p.rate) * 2 + 4000);
    u.onend = () => finish('end');
    u.onerror = (ev) => finish(ev.error === 'interrupted' || ev.error === 'canceled' ? 'cancel' : 'error');
    alive.add(u);
    setStop(() => finish('cancel'));
    s.speak(u);
    if (s.paused) s.resume();
  });
}

/** Speaks `text` as a chain of sentence chunks; resolves when all are spoken, one fails, or `setCancel`'s stop is called. */
export async function speakWeb(text: string, p: SpeechParams, setCancel: (stop: () => void) => void): Promise<SpeakEnd> {
  const s = synth();
  const v = webSpeechVoice();
  if (!s || !v) return 'skip';
  let cancelled = false;
  let stopChunk = () => {};
  setCancel(() => {
    cancelled = true;
    stopChunk();
    s.cancel();
  });
  if (s.speaking || s.pending || s.paused) {
    s.cancel();
    await wait(60);
  }
  for (const chunk of speechChunks(text)) {
    if (cancelled) return 'cancel';
    const e = await utter(s, v, chunk, p, (stop) => (stopChunk = stop));
    if (cancelled) return 'cancel';
    if (e !== 'end') return e;
  }
  return 'end';
}

/** The built-in engine: one utterance chain for all parts. */
export const webSpeechEngine: VoiceEngine = {
  id: 'speech',
  status: speechStatus,
  onStatus: onSpeechStatus,
  covers: () => speechStatus() === 'ready',
  speak: (parts, p, setCancel) => speakWeb(parts.join(' '), p, setCancel),
};
