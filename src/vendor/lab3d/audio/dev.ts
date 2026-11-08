/** CHỈ DEV: `window.__audio` – đọc trạng thái AudioContext/gain, phát thử (Playwright, trang thử nghe). */
import { audioCore, audioRunning } from './context';
import { loadedCount, loadManifest, loadSound } from './loader';
import { getAudioSettings } from './settings';
import { currentSimAudio } from './simAudio';
import type { AmbientLayer, LoopOptions } from './types';

let analyser: AnalyserNode | null = null;

/** RMS (dBFS) hiện tại sau master – đo bằng AnalyserNode gắn lười (chỉ dev). */
function levelDb(): number | null {
  const c = audioCore();
  if (!c) return null;
  if (!analyser) {
    analyser = c.ctx.createAnalyser();
    analyser.fftSize = 2048;
    c.master.connect(analyser);
  }
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let s = 0;
  for (const v of buf) s += v * v;
  return 10 * Math.log10(s / buf.length + 1e-12);
}

export function exposeAudioDevHook(): void {
  if (!import.meta.env.DEV) return;
  const w = window as unknown as { __audio?: unknown };
  if (w.__audio) return;
  w.__audio = {
    levelDb,
    loop: (id: string, opts?: LoopOptions) => currentSimAudio()?.loop(id, opts) ?? null,
    ambient: (layers: AmbientLayer[], fadeIn?: number) => currentSimAudio()?.ambient(layers, fadeIn) ?? null,
    state() {
      const c = audioCore();
      return {
        ctx: c?.ctx.state ?? 'none',
        unlocked: c?.unlocked ?? false,
        running: audioRunning(),
        master: c ? c.master.gain.value : null,
        sampleRate: c?.ctx.sampleRate ?? null,
        settings: getAudioSettings(),
        loaded: loadedCount(),
        sim: currentSimAudio()?.stats() ?? null,
      };
    },
    manifest: async () => [...(await loadManifest()).keys()],
    async decode(id: string) {
      const b = await loadSound(id);
      return b ? { duration: b.duration, channels: b.numberOfChannels, rate: b.sampleRate } : null;
    },
    play: (id: string, opts?: object) => currentSimAudio()?.sfx(id, opts),
  };
}
