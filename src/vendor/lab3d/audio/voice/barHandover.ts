/**
 * Handover of a React step bar's narration across a remount (`useStepNarration`). Labs that key their scene on a mode
 * (machining method, sample…) unmount the bar and mount a new one in the same commit, often in the middle of "Tự động"
 * while the old bar is still saying its step. The new bar's first render shows the step that is being said
 * (`speakingBar`), the old bar's voice is handed over when it unmounts (`handOverBar`) and taken by the new bar's mount
 * effect (`adoptBar`), so the narration is never cut. A voice nobody takes before the next tick is disposed (left page).
 */
import type { StepVoice } from './stepVoice';

export interface BarStep {
  index: number;
  total: number;
  label: string;
}

interface Bar {
  voice: StepVoice;
  shown(): BarStep;
  automatic(): boolean;
}

const bars = new Map<object, Bar>();
let pending: { voice: StepVoice; timer: number } | null = null;

/** Registers a mounted bar (newest last); returns the unregister function. */
export function trackBar(owner: object, voice: StepVoice, shown: () => BarStep, automatic: () => boolean): () => void {
  bars.delete(owner);
  bars.set(owner, { voice, shown, automatic });
  return () => {
    if (bars.get(owner)?.voice === voice) bars.delete(owner);
  };
}

/** Another bar in "Tự động" that is saying its step right now (the bar a remount replaces): the step it shows. */
export function speakingBar(self: object): { voice: StepVoice; shown: BarStep } | null {
  for (const [owner, b] of [...bars].reverse()) {
    if (owner !== self && b.automatic() && b.voice.speaking()) return { voice: b.voice, shown: { ...b.shown() } };
  }
  return null;
}

/** An unmounting bar's voice that is still speaking: kept for the bar mounted in the same commit, else disposed. */
export function handOverBar(voice: StepVoice): void {
  if (pending) pending.voice.dispose();
  const timer = window.setTimeout(() => {
    if (pending?.voice !== voice) return;
    pending = null;
    voice.dispose();
  }, 0);
  pending = { voice, timer };
}

/** The voice handed over by a bar that just unmounted (null when there is none). */
export function adoptBar(): StepVoice | null {
  if (!pending) return null;
  const { voice, timer } = pending;
  window.clearTimeout(timer);
  pending = null;
  return voice;
}
