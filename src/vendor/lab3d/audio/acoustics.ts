/**
 * Hậu xử lý âm của MỘT sim (tuỳ chọn, `ctx.audio.setAcoustics`): bus sim → [khô + vang (ConvolverNode, đáp ứng xung tổng hợp)]
 * → lọc tông (lowshelf ấm + highshelf trong) → nén nhẹ → master. Không gọi thì bus nối thẳng master như cũ.
 */
export interface Acoustics {
  /** Tỉ lệ vang 0…1 (ngoài trời 0,08–0,15; sảnh gỗ 0,25; hầm, hang 0,4). */
  reverb: number;
  /** Thời gian vang (s): ngoài trời 0,6; sảnh 1,6; hầm 2,4. */
  decay: number;
  /** Tăng/giảm dải trầm (dB) tại 200 Hz. */
  warmth?: number;
  /** Tăng/giảm dải cao (dB) tại 6 kHz – âm trong, rõ hơn. */
  air?: number;
}

export interface AcousticsChain {
  input: GainNode;
  set(a: Acoustics): void;
  dispose(): void;
}

/** Đáp ứng xung stereo tổng hợp: nhiễu giảm theo hàm mũ, hai kênh lệch nhau cho cảm giác không gian. */
function impulse(ctx: BaseAudioContext, decay: number): AudioBuffer {
  const len = Math.max(1, Math.round(ctx.sampleRate * Math.min(4, Math.max(0.2, decay))));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = rnd() * Math.pow(1 - i / len, 2.6) * (i < 64 ? i / 64 : 1);
  }
  return buf;
}

export function createAcoustics(ctx: AudioContext, out: AudioNode, a: Acoustics): AcousticsChain {
  const input = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const conv = ctx.createConvolver();
  const low = ctx.createBiquadFilter();
  const high = ctx.createBiquadFilter();
  const comp = ctx.createDynamicsCompressor();
  low.type = 'lowshelf';
  low.frequency.value = 200;
  high.type = 'highshelf';
  high.frequency.value = 6000;
  Object.assign(comp, {});
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 2.5;
  comp.attack.value = 0.01;
  comp.release.value = 0.25;
  input.connect(dry).connect(low);
  input.connect(conv).connect(wet).connect(low);
  low.connect(high).connect(comp).connect(out);
  let decay = -1;
  const chain: AcousticsChain = {
    input,
    set(n) {
      const t = ctx.currentTime;
      const r = Math.min(1, Math.max(0, n.reverb));
      dry.gain.setTargetAtTime(1 - r * 0.5, t, 0.08);
      wet.gain.setTargetAtTime(r, t, 0.08);
      low.gain.setTargetAtTime(n.warmth ?? 0, t, 0.08);
      high.gain.setTargetAtTime(n.air ?? 0, t, 0.08);
      if (Math.abs(n.decay - decay) > 0.05) {
        decay = n.decay;
        conv.buffer = impulse(ctx, decay);
      }
    },
    dispose() {
      for (const n of [input, dry, wet, conv, low, high, comp]) n.disconnect();
    },
  };
  chain.set(a);
  return chain;
}
