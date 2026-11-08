/** Âm lượng tổng + tắt tiếng, lưu localStorage; đăng kí nghe thay đổi (nút loa trên SimToolbar, AudioContext). */
import { useSyncExternalStore } from 'react';
import { clamp01, parseSettings, SETTINGS_KEY } from './model';
import type { AudioSettings } from './types';

function load(): AudioSettings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return parseSettings(null);
  }
}

let state: AudioSettings = load();
const listeners = new Set<() => void>();

export function getAudioSettings(): AudioSettings {
  return state;
}

export function setAudioSettings(patch: Partial<AudioSettings>): void {
  const next = { ...state, ...patch, volume: clamp01(patch.volume ?? state.volume) };
  if (next.volume === state.volume && next.muted === state.muted) return;
  state = next;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  } catch {
    /* chế độ riêng tư: chỉ giữ trong phiên */
  }
  for (const l of listeners) l();
}

export function onAudioSettings(cb: () => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** Hook React: trạng thái âm lượng hiện tại. */
export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(onAudioSettings, getAudioSettings, getAudioSettings);
}
