/** "Đọc hướng dẫn" settings (on by default), remembered in localStorage; `rate` / `pitch` apply to every engine. */
import { useSyncExternalStore } from 'react';

export interface VoiceSettings {
  on: boolean;
  /** Speaking rate 0.5…2 (1 = normal). */
  rate: number;
  /** Web Speech pitch 0…2 (1 = normal). */
  pitch: number;
}

const KEY = 'lab3d.voice';
const DEFAULTS: VoiceSettings = { on: true, rate: 1, pitch: 1 };
const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function parseVoiceSettings(raw: string | null): VoiceSettings {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<VoiceSettings>) : {};
    return {
      on: typeof v.on === 'boolean' ? v.on : DEFAULTS.on,
      rate: clamp(v.rate, 0.5, 2, DEFAULTS.rate),
      pitch: clamp(v.pitch, 0, 2, DEFAULTS.pitch),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function load(): VoiceSettings {
  try {
    return parseVoiceSettings(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULTS };
  }
}

let state = load();
const listeners = new Set<() => void>();

export const getVoiceSettings = (): VoiceSettings => state;

export function setVoiceSettings(patch: Partial<VoiceSettings>): void {
  const next = parseVoiceSettings(JSON.stringify({ ...state, ...patch }));
  if (next.on === state.on && next.rate === state.rate && next.pitch === state.pitch) return;
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: keep for this page only */
  }
  for (const l of [...listeners]) l();
}

export function onVoiceSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

export function useVoiceSettings(): VoiceSettings {
  return useSyncExternalStore(onVoiceSettings, getVoiceSettings, getVoiceSettings);
}
