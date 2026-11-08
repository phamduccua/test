/**
 * Spoken step guidance in Vietnamese ("Đọc hướng dẫn"): OmniVoice TTS (PTIT, omniVoice.ts) first, pre-generated clips (voice/index.json) when the parts have them,
 * else the browser's best vi-VN Web Speech voice; neither → silent (the on-screen caption stays). Follows the sound policy of the kit: global volume / mute, first user gesture,
 * hidden tab.
 * - `speak(text)` → Promise resolved on end / skip / cancel / error; `stopSpeech()`, `speechSettled()`.
 */
export type { EngineStatus, SpeakEnd, SpeakOptions, SpeechParams, VoiceEngine, VoiceLogEntry, VoiceVia } from './types';
export { speak, speaking, speechSettled, speechRemainingMs, stopSpeech, voiceBlocked } from './narrator';
export { createStepVoice, type StepVoice, type StepVoiceOptions } from './stepVoice';
export { demoHeld, holdDemo, useDemoHeld, useVoicePresent, voicePresent } from './presence';
export { getVoiceSettings, onVoiceSettings, setVoiceSettings, useVoiceSettings, type VoiceSettings } from './settings';
export { speechChunks, speechText, stepParts, stepWord, type StepSpeech } from './text';
export { addVoiceEngine, engineStatus, onEngineStatus, prefetchSpeech, voiceEngines } from './engines';
export { clipEngine } from './clips';
export { omniClip, omniVoiceEngine, OMNIVOICE_SPEAKER, OMNIVOICE_URL } from './omniVoice';
export { webSpeechEngine } from './webSpeech';
export { pickVoice, rankVoice } from './voices';
