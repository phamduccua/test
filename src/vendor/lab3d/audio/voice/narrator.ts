/**
 * Spoken guidance core: one voice for the whole app, a queue, interrupt / stop, a promise per `speak()`.
 * Engines (engines.ts): pre-generated clips when the parts have them, else the browser's best vi-VN Web Speech voice;
 * none → silent (the on-screen caption stays).
 * Policy: silent while "Đọc hướng dẫn" is off, sound is muted / at 0, the tab is hidden, or before the first user gesture;
 * muting, switching off, hiding the tab or leaving the page stops what is being said.
 */
import { audioAllowed } from '../context';
import { masterGain } from '../model';
import { getAudioSettings, onAudioSettings } from '../settings';
import { getVoiceSettings, onVoiceSettings } from './settings';
import { estimateMs } from './text';
import type { SpeakEnd, SpeakOptions, VoiceLogEntry } from './types';
import { engineStatus, voiceEngines } from './engines';
import { onPageNarrator, pageNarrates } from './pageNarrator';

interface Job {
  parts: string[];
  owner?: object;
  entry: VoiceLogEntry;
  resolve(e: SpeakEnd): void;
}

let queue: Job[] = [];
let active: { job: Job; stop(): void; until: number } | null = null;
const idle = new Set<() => void>();
const log: VoiceLogEntry[] = [];
let wired = false;
const now = () => performance.now() / 1000;

/** Why nothing can be spoken right now (null = speech is possible). */
export function voiceBlocked(): string | null {
  if (!getVoiceSettings().on) return 'off';
  if (pageNarrates()) return 'page';
  const a = getAudioSettings();
  if (a.muted || a.volume <= 0) return 'muted';
  if (typeof document !== 'undefined' && document.hidden) return 'hidden';
  if (!audioAllowed()) return 'gesture';
  if (typeof document !== 'undefined' && document.querySelector('[data-sim-intro]')) return 'intro';
  const engine = engineStatus();
  return engine === 'ready' ? null : engine === 'loading' ? 'loading' : 'novoice';
}

function wire(): void {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  const check = () => {
    const b = voiceBlocked();
    if (b === 'off' || b === 'page' || b === 'muted' || b === 'hidden' || b === 'intro') stopSpeech();
  };
  onAudioSettings(check);
  onPageNarrator(check);
  onVoiceSettings(check);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pagehide', () => stopSpeech());
}

function record(e: VoiceLogEntry): void {
  log.push(e);
  if (log.length > 300) log.splice(0, log.length - 300);
}

const done = (e: VoiceLogEntry, end: SpeakEnd, reason?: string): Promise<SpeakEnd> => {
  Object.assign(e, { end, ended: now() }, reason ? { reason } : {});
  return Promise.resolve(end);
};

/**
 * Says `text` (one string or ordered parts). Resolves when it has been spoken ('end'), was skipped ('skip'), cancelled
 * by a newer `speak` / `stopSpeech` ('cancel') or failed ('error'). Never rejects.
 */
export function speak(text: string | readonly string[], o: SpeakOptions = {}): Promise<SpeakEnd> {
  wire();
  const parts = (typeof text === 'string' ? [text] : [...text]).map((s) => s.trim()).filter(Boolean);
  const entry: VoiceLogEntry = { t: now(), text: parts.join(' '), via: 'none', end: null };
  record(entry);
  if (o.interrupt !== false) stopSpeech();
  if (!parts.length) return done(entry, 'skip', 'empty');
  const blocked = voiceBlocked();
  if (blocked) return done(entry, 'skip', blocked);
  return new Promise<SpeakEnd>((resolve) => {
    queue.push({ parts, owner: o.owner, entry, resolve });
    pump();
  });
}

function pump(): void {
  if (active) return;
  const job = queue.shift();
  if (!job) {
    for (const f of [...idle]) f();
    return;
  }
  let stopEngine = () => {};
  let cancelled = false;
  const stop = () => {
    cancelled = true;
    stopEngine();
  };
  const a = { job, stop, until: performance.now() + estimateMs(job.entry.text, getVoiceSettings().rate) };
  active = a;
  const setStop = (s: () => void) => (stopEngine = s);
  void run(a, setStop, () => cancelled)
    .catch((): SpeakEnd => 'error')
    .then((end) => {
      Object.assign(job.entry, { end: cancelled ? 'cancel' : end, ended: now() });
      if (active === a) active = null;
      job.resolve(cancelled ? 'cancel' : end);
      pump();
    });
}

async function run(a: { job: Job; until: number }, setStop: (s: () => void) => void, cancelled: () => boolean): Promise<SpeakEnd> {
  const { parts, entry } = a.job;
  const v = getVoiceSettings();
  const params = { rate: v.rate, pitch: v.pitch, volume: masterGain(getAudioSettings()) };
  for (const e of voiceEngines()) {
    if (cancelled()) return 'cancel';
    if (e.status() !== 'ready' || !(await e.covers(parts))) continue;
    if (cancelled()) return 'cancel';
    entry.via = e.id;
    a.until = performance.now() + (e.durationMs?.(parts) ?? estimateMs(entry.text, v.rate));
    const end = await e.speak(parts, params, setStop);
    if (end !== 'error' || cancelled()) return end;
  }
  entry.reason = 'novoice';
  return 'skip';
}

/** Stops what is being said and drops the queue (only `owner`'s speech when given). */
export function stopSpeech(owner?: object): void {
  const drop = owner ? queue.filter((j) => j.owner === owner) : queue;
  queue = owner ? queue.filter((j) => j.owner !== owner) : [];
  for (const j of drop) {
    Object.assign(j.entry, { end: 'cancel', ended: now() });
    j.resolve('cancel');
  }
  if (active && (!owner || active.job.owner === owner)) active.stop();
  else if (!active && !queue.length) for (const f of [...idle]) f();
}

/** Something is being said or waits in the queue (`owner` = only that owner's speech). */
export function speaking(owner?: object): boolean {
  const mine = (j: Job) => !owner || j.owner === owner;
  return (!!active && mine(active.job)) || queue.some(mine);
}

/** Estimated ms until the current speech and the queue are done (0 when silent). */
export function speechRemainingMs(): number {
  const rest = queue.reduce((s, j) => s + estimateMs(j.entry.text, getVoiceSettings().rate), 0);
  return active ? Math.max(0, active.until - performance.now()) + rest : rest;
}

/**
 * Resolves once nothing is being said (at once when silent). Safety cap: `maxMs`, by default the expected remaining time
 * + 3 s (≤ 30 s), so a stuck voice never freezes a demo.
 */
export function speechSettled(maxMs?: number): Promise<void> {
  if (!active && !queue.length) return Promise.resolve();
  const wait = maxMs ?? Math.min(30000, speechRemainingMs() + 3000);
  return new Promise<void>((resolve) => {
    const t = window.setTimeout(finish, wait);
    function finish() {
      window.clearTimeout(t);
      idle.delete(finish);
      resolve();
    }
    idle.add(finish);
  });
}

/** DEV probe: what was asked to be spoken (newest last). */
export const voiceLog = (): readonly VoiceLogEntry[] => log;
export const clearVoiceLog = (): void => void log.splice(0);
