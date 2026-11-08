/**
 * DEV only: `window.__voice` – what the guidance voice was asked to say and how (speech / none, skip reason), engine
 * state, the step catalog of the open experiment (`catalog()` → spoken parts of every step) and the pieces a part is
 * said from when it has no clip (`pieces(part)`). Production builds register nothing.
 */
import { clearVoiceLog, speak, speaking, speechRemainingMs, speechSettled, stopSpeech, voiceBlocked, voiceLog } from './narrator';
import { getVoiceSettings, setVoiceSettings } from './settings';
import { numberPieces, sentences } from './pieces';
import { speechChunks, speechText, stepParts, stepWord, type StepSpeech } from './text';
import { engineStatus, voiceEngines } from './engines';
import { webSpeechVoice, webSpeechVoices } from './webSpeech';

type Catalog = () => StepSpeech[];
const catalogs = new Map<object, Catalog>();

/** A step bar's full step list (null = remove). */
export function registerVoiceCatalog(owner: object, catalog: Catalog | null): void {
  if (!import.meta.env.DEV) return;
  if (catalog) catalogs.set(owner, catalog);
  else catalogs.delete(owner);
  expose();
}

let exposed = false;

function expose(): void {
  if (exposed || typeof window === 'undefined') return;
  exposed = true;
  const parts = (step: StepSpeech) => stepParts(step, stepWord());
  (window as unknown as { __voice?: unknown }).__voice = {
    /** Every speak() since the last clear: { t, text, via, end, reason, ended }. */
    get log() {
      return voiceLog().map((e) => ({ ...e }));
    },
    texts: () => voiceLog().map((e) => e.text),
    clear: () => clearVoiceLog(),
    state: () => ({
      blocked: voiceBlocked(),
      speaking: speaking(),
      remainingMs: Math.round(speechRemainingMs()),
      engine: engineStatus(),
      engines: voiceEngines().map((e) => `${e.id}:${e.status()}`),
      voice: webSpeechVoice()?.name ?? null,
      settings: getVoiceSettings(),
    }),
    voices: () => webSpeechVoices(),
    speak: (text: string | string[]) => speak(text),
    stop: () => stopSpeech(),
    settled: (ms?: number) => speechSettled(ms),
    set: (patch: object) => setVoiceSettings(patch),
    /** Normalised text and its sentence chunks, as the engine receives them. */
    text: (raw: string) => ({ text: speechText(raw), chunks: speechChunks(speechText(raw)) }),
    parts,
    /** How a part is said when it has no clip of its own: its sentences, and each sentence split around its numbers. */
    pieces: (part: string) => sentences(part).map((s) => ({ sentence: s, numbers: numberPieces(s) })),
    /** Steps of the open experiment(s) and their spoken parts. */
    catalog: () => [...catalogs.values()].flatMap((f) => f().map((step) => ({ step, parts: parts(step) }))),
  };
}
