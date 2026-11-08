/**
 * Pure ranking of Web Speech voices for Vietnamese guidance. Best first: Edge online natural voices (HoaiMy / NamMinh),
 * Google "Tiếng Việt … (Natural)" on Android / ChromeOS, Apple Linh (enhanced before compact), Windows "Microsoft An",
 * then any other vi voice. Formant voices (eSpeak, MBROLA) are rejected: in Vietnamese they are hard to understand, and
 * the on-screen caption is a better fallback.
 */
export interface VoiceLike {
  name: string;
  lang: string;
  localService: boolean;
  voiceURI?: string;
}

/** Score of a voice for vi-VN guidance; < 0 = not usable. */
export function rankVoice(v: VoiceLike): number {
  const lang = v.lang.toLowerCase().replace('_', '-');
  if (!/^vi(-|$)/.test(lang)) return -1;
  const id = `${v.name} ${v.voiceURI ?? ''}`;
  if (/espeak|mbrola/i.test(id)) return -1;
  let s = 10;
  if (/natural|neural|online|wavenet/i.test(id)) s += 40;
  if (/google|vi-vn-x-/i.test(id)) s += 25;
  if (/hoaimy|namminh/i.test(id)) s += 10;
  if (/premium|enhanced/i.test(id)) s += 15;
  if (/\blinh\b/i.test(id)) s += 8;
  if (/microsoft/i.test(id)) s += 5;
  if (lang === 'vi-vn') s += 2;
  return s;
}

/** Best usable voice (first one wins a tie, i.e. the browser's own order). */
export function pickVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  let best: T | null = null;
  let score = -1;
  for (const v of voices) {
    const r = rankVoice(v);
    if (r > score) {
      best = v;
      score = r;
    }
  }
  return score >= 0 ? best : null;
}
