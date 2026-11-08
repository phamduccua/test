/**
 * Speech engines of the narrator, tried in order: the first that is ready and `covers` the parts speaks, an 'error'
 * falls through to the next. Built in: OmniVoice TTS (omniVoice.ts), pre-generated clips (clips.ts, when the parts have
 * clips), then the browser's Web Speech voice. `addVoiceEngine(e)` adds another one.
 */
import { clipEngine } from './clips';
import { omniVoiceEngine } from './omniVoice';
import type { EngineStatus, VoiceEngine } from './types';
import { webSpeechEngine } from './webSpeech';

const engines: VoiceEngine[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const offs = new Map<VoiceEngine, () => void>();

/** Registers an engine ('first' = tried before Web Speech). Returns the unregister function. */
export function addVoiceEngine(e: VoiceEngine, at: 'first' | 'last' = 'first'): () => void {
  if (offs.has(e)) return () => removeVoiceEngine(e);
  if (at === 'first') engines.unshift(e);
  else engines.push(e);
  offs.set(e, e.onStatus(emit));
  emit();
  return () => removeVoiceEngine(e);
}

function removeVoiceEngine(e: VoiceEngine): void {
  const i = engines.indexOf(e);
  if (i < 0 || e === webSpeechEngine) return;
  engines.splice(i, 1);
  offs.get(e)?.();
  offs.delete(e);
  emit();
}

export const voiceEngines = (): readonly VoiceEngine[] => engines;

/** 'ready' if any engine is, else 'loading' if any still loads, else 'none'. */
export function engineStatus(): EngineStatus {
  const all = engines.map((e) => e.status());
  return all.includes('ready') ? 'ready' : all.includes('loading') ? 'loading' : 'none';
}

export function onEngineStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** Lets every engine fetch ahead what these parts need (the next step). */
export function prefetchSpeech(parts: readonly string[]): void {
  if (!parts.length) return;
  for (const e of engines) void Promise.resolve(e.prefetch?.(parts)).catch(() => {});
}

addVoiceEngine(webSpeechEngine, 'last');
addVoiceEngine(clipEngine, 'first');
// OmniVoice (PTIT) đọc trước tiên; lỗi mạng/API → clip dựng sẵn → Web Speech.
addVoiceEngine(omniVoiceEngine, 'first');
