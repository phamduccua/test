/**
 * Narrator of one step bar: says "Bước n. <tên bước>. <giải thích>" when the shown step changes, once per text (a
 * re-render with the same step says nothing). A new step interrupts the old one. Pausing the experiment cancels the
 * speech and says the step again on resume; before the first user gesture the step is kept and said at that gesture;
 * switching "Đọc hướng dẫn" on says the current step. Shared by the lab3d procedure bar and the upstream LabProcedure.
 */
import { useSim } from '../../sim/simStore';
import { audioAllowed, onAudioAllowed } from '../context';
import { speak, speaking, speechSettled, stopSpeech } from './narrator';
import { setVoicePresent } from './presence';
import { registerVoiceCatalog } from './probe';
import { getVoiceSettings, onVoiceSettings } from './settings';
import { onEngineStatus, prefetchSpeech } from './engines';
import { nextStepParts, stepParts, stepWord, type StepSpeech } from './text';
import type { SpeakEnd } from './types';

export interface StepVoice {
  /** Announces the shown step; resolves when that narration ends / is skipped / cancelled. */
  say(step: StepSpeech): Promise<SpeakEnd>;
  /** This bar's narration is still playing. */
  speaking(): boolean;
  /** Resolves once this bar's narration is over (at once when silent), capped – see `speechSettled`. */
  settled(maxMs?: number): Promise<void>;
  /** Cancels the narration (the demo was stopped, the student moved on). */
  stop(): void;
  dispose(): void;
}

export interface StepVoiceOptions {
  /** Every step of this bar: the next step's speech is fetched ahead; DEV probe `__voice.catalog()`. */
  catalog?: () => StepSpeech[];
}

export function createStepVoice(o: StepVoiceOptions = {}): StepVoice {
  const owner = {};
  let last = '';
  let parts: string[] = [];
  let current: Promise<SpeakEnd> = Promise.resolve('skip');
  /** The shown step still has to be said (no gesture yet, paused, voice was off). */
  let owed = false;
  let disposed = false;
  const paused = () => !useSim.getState().playing;

  const play = (): Promise<SpeakEnd> => {
    owed = false;
    const mine = parts;
    current = speak(mine, { owner }).then((e) => {
      if (e === 'skip' && mine === parts && !disposed) owed = true;
      return e;
    });
    return current;
  };
  const replay = () => {
    if (owed && parts.length && !paused() && !disposed) void play();
  };

  let offGesture = () => {};
  /** Before the first gesture: say the shown step at that gesture (the waiting callback is one-shot). */
  const awaitGesture = () => {
    if (audioAllowed()) return;
    offGesture();
    offGesture = onAudioAllowed(replay);
  };
  const offSim = useSim.subscribe((s, prev) => {
    if (s.playing === prev.playing) return;
    if (!s.playing) {
      if (speaking(owner)) owed = true;
      stopSpeech(owner);
    } else replay();
  });
  // Voices are listed late (Chrome): say the shown step once a vi-VN voice is there.
  const offStatus = onEngineStatus(replay);
  let wasOn = getVoiceSettings().on;
  const offSettings = onVoiceSettings(() => {
    const on = getVoiceSettings().on;
    if (on && !wasOn) replay();
    wasOn = on;
  });
  setVoicePresent(owner, true);
  const onStart = () => replay();
  if (typeof window !== 'undefined') window.addEventListener('sim-start', onStart);
  if (import.meta.env.DEV) registerVoiceCatalog(owner, o.catalog ?? null);

  return {
    say(step) {
      const next = stepParts(step, stepWord());
      const key = next.join(' ');
      if (key === last) return current;
      last = key;
      parts = next;
      if (getVoiceSettings().on) {
        prefetchSpeech(next);
        // The look-ahead reads the whole bar (captions can be getters on sim state), so it waits until the sim has
        // finished building: the first step is said while the bar is still being created.
        window.setTimeout(() => {
          if (disposed) return;
          try {
            prefetchSpeech(nextStepParts(step, o.catalog?.() ?? null, stepWord()));
          } catch {
            /* best effort: a step that cannot be read yet is simply not prefetched */
          }
        }, 0);
      }
      if (!next.length || paused()) {
        stopSpeech(owner);
        owed = next.length > 0;
        return (current = Promise.resolve('skip'));
      }
      awaitGesture();
      return play();
    },
    speaking: () => speaking(owner),
    settled: (maxMs) => (speaking(owner) ? speechSettled(maxMs) : Promise.resolve()),
    stop() {
      owed = false;
      stopSpeech(owner);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      owed = false;
      stopSpeech(owner);
      offGesture();
      offSim();
      offSettings();
      offStatus();
      setVoicePresent(owner, false);
      if (typeof window !== 'undefined') window.removeEventListener('sim-start', onStart);
      registerVoiceCatalog(owner, null);
    },
  };
}
