/**
 * Who uses spoken guidance right now, and who holds an automatic demo while a step is still being narrated.
 * - Presence: a step narrator (lab3d procedure bar, upstream LabProcedure) joins while mounted; the toolbar shows
 *   "Đọc hướng dẫn" only then, so experiments without steps get no voice button.
 * - Demo hold: upstream labs run their "Tự động" sequence on the shared playback clock (`useLabPlayback`, cn11
 *   `mechanicsTimeout`); while a holder is set that clock reads as paused, so the next step waits for the voice.
 */
import { useSyncExternalStore } from 'react';

function ownerSet() {
  const owners = new Set<object>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    set(owner: object, on: boolean) {
      if (on === owners.has(owner)) return;
      if (on) owners.add(owner);
      else owners.delete(owner);
      emit();
    },
    any: () => owners.size > 0,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
}

const present = ownerSet();
const holds = ownerSet();

export const setVoicePresent = (owner: object, on: boolean): void => present.set(owner, on);
export const voicePresent = (): boolean => present.any();
export const useVoicePresent = (): boolean => useSyncExternalStore(present.subscribe, present.any, present.any);

export const holdDemo = (owner: object, on: boolean): void => holds.set(owner, on);
/** An automatic demo is waiting for the narration to finish (shared playback clock reads as paused). */
export const demoHeld = (): boolean => holds.any();
export const useDemoHeld = (): boolean => useSyncExternalStore(holds.subscribe, holds.any, holds.any);
