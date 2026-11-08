/**
 * Kit ÂM THANH dùng chung (mọi môn). Âm ở lab3d/audio/<nhóm>/<tên>.webm|.mp3 (CC0),
 * danh mục lab3d/audio/manifest.json. Trong sim: `createSimSound(ctx, …)` (nền + loop đặt tên + sfx giới hạn tần suất + tạm dừng
 * + probe dev) hoặc thẳng `ctx.audio` (SimAudio, tự dọn khi huỷ sim; an toàn trước cử chỉ đầu).
 */
export type {
  Ambient, AmbientLayer, AudioSettings, LoopOptions, SfxOptions, SoundAt, SoundEntry, SoundLoop, SoundManifest, SoundType, SpatialOptions,
} from './types';
export { createSimAudio, currentSimAudio, type PlayedSound, type SimAudio } from './simAudio';
export { createSimSound } from './simSound';
export { createSoundCore, type SoundHost } from './soundCore';
export { soundEvents, type SoundCue, type SoundRule, type SoundSnapshot } from './soundEvents';
export type { SimLoopDef, SimSfxOptions, SimSound, SimSoundOptions } from './simSoundTypes';
export { playSfx, createLoop, createAmbient } from './api';
export { loadSound, loadManifest, preloadSounds, soundEntry } from './loader';
export { audioAllowed, audioCore, audioRunning, onAudioAllowed } from './context';
export { getAudioSettings, setAudioSettings, onAudioSettings, useAudioSettings } from './settings';
export { soundOnInteract, type InteractSounds } from './interact';
export { levelToGain, clamp01 } from './model';
export { exposeAudioDevHook } from './dev';
export { soundPresent, onSoundPresence } from './presence';
