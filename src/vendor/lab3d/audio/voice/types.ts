/** How a `speak()` call ended: spoken to the end, skipped (voice off / muted / no gesture yet / no engine), cancelled, failed. */
export type SpeakEnd = 'end' | 'skip' | 'cancel' | 'error';

/** Engine that spoke (`VoiceEngine.id`, e.g. 'speech'), or 'none'. */
export type VoiceVia = string;

export interface SpeakOptions {
  /** Cancel what is playing and drop the queue first (default true). False = wait in the queue. */
  interrupt?: boolean;
  /** Owner tag: `stopSpeech(owner)` only cancels this owner's speech. */
  owner?: object;
}

/** One spoken (or skipped) text – DEV probe log. Times in s (performance.now). */
export interface VoiceLogEntry {
  t: number;
  text: string;
  via: VoiceVia;
  end: SpeakEnd | null;
  /** Why it was skipped: 'off', 'page' (the page reads the steps itself), 'muted', 'hidden', 'gesture', 'loading' (voices not listed yet), 'novoice', 'empty'. */
  reason?: string;
  ended?: number;
}

/** Readiness of an engine: 'none' = it cannot speak in this browser (e.g. no vi-VN voice). */
export type EngineStatus = 'loading' | 'ready' | 'none';

export interface SpeechParams {
  /** 0.5…2 */
  rate: number;
  /** 0…2 (engines that cannot change pitch ignore it) */
  pitch: number;
  /** 0…1, already the master gain (volume² of the toolbar slider). */
  volume: number;
}

/**
 * A speech engine for the narrator (engines.ts tries them in order, the first that `covers` the parts speaks; an 'error'
 * falls through to the next). Web Speech is the built-in one; e.g. a pre-generated clip engine registers in front of it.
 */
export interface VoiceEngine {
  readonly id: string;
  status(): EngineStatus;
  /** Called whenever `status()` may have changed. Returns the unsubscribe function. */
  onStatus(cb: () => void): () => void;
  /** Can say exactly these parts now (e.g. every part has a clip). */
  covers(parts: readonly string[]): boolean | Promise<boolean>;
  /** Says the parts in order. Call `setCancel(stop)` before sound starts; resolve 'end' | 'cancel' | 'error' | 'skip'. */
  speak(parts: readonly string[], p: SpeechParams, setCancel: (stop: () => void) => void): Promise<SpeakEnd>;
  /** Expected length (ms) when known – the demo's safety cap; null → estimated from the text. */
  durationMs?(parts: readonly string[]): number | null;
  /** Fetch ahead what `speak(parts)` will need (e.g. the next step's clips); never throws. */
  prefetch?(parts: readonly string[]): void | Promise<void>;
}
