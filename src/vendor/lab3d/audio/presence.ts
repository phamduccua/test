/**
 * Sim sessions that use sound: a SimAudio joins on its first loop / ambient / preload / sfx (or at `createSimSound`) and
 * leaves on dispose. The toolbar speaker (SoundControl) shows only while one is open, so silent experiments get no speaker.
 */
const voiced = new Set<object>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function markVoiced(owner: object): void {
  if (voiced.has(owner)) return;
  voiced.add(owner);
  emit();
}

export function clearVoiced(owner: object): void {
  if (voiced.delete(owner)) emit();
}

export const soundPresent = (): boolean => voiced.size > 0;

export function onSoundPresence(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
