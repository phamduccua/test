/**
 * Pure text helpers for spoken step guidance (no DOM, no audio): speech-friendly normalisation, the parts of a step
 * announcement ("Bước 2." · step name · explanation) and the sentence chunks handed to the speech engine.
 */
import { labText } from '../../text';

/** Word read between the numbers of a range ("5 – 10" → "5 đến 10"). */
const rangeWord = (): string => labText('t_3d59982c523b');

/** The step bar's own word for a step ("Bước"). */
export const stepWord = (): string => labText('t_15ee30ad0abe').trim();

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUB_RE = /[₀-₉]/g;
const SUP_RE = /[⁰¹²³⁴-⁹]/g;
/** Arrows and list separators read as a short pause. */
const PAUSE_RE = /\s*[→⟶⇌⇒➜]\s*|\s+[·•–—]\s+/g;
const DROP_RE = /[“”"*_#]/g;
const END_RE = /[.!?…]$/;

/** Text as it is spoken: NFC, sub/superscript digits as digits, arrows and separators as pauses, one sentence end. */
export function speechText(raw: string): string {
  let s = raw.normalize('NFC');
  s = s.replace(SUB_RE, (c) => String(SUB.indexOf(c))).replace(SUP_RE, (c) => String(SUP.indexOf(c)));
  // Charges are said: "Cu²⁺" → "Cu2+".
  // Number ranges are said with "đến" ("tháng 5 – 10"), other dashes and arrows as a pause.
  s = s.replace(/(\d)\s*[–—]\s*(?=\d)/g, (_, d: string) => `${d} ${rangeWord()} `);
  s = s.replace(/⁺/g, '+').replace(/⁻/g, '-').replace(PAUSE_RE, ', ').replace(DROP_RE, '');
  s = s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?…])/g, '$1').replace(/([,;:])[,;:\s]*(?=[,;:])/g, '');
  s = s.replace(/^[\s,.;:]+/, '').replace(/[\s,;:]+$/, '').trim();
  if (s && !END_RE.test(s)) s += '.';
  return s;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Drops a leading step number that the bar already says ("2/4. …", "Bước 1 · …", "3) …"). */
export function stripStepNumber(text: string, stepWord: string): string {
  const word = stepWord.trim();
  const re = new RegExp(`^\\s*(?:${word ? `${escape(word)}\\s*` : ''})?\\d+(?:\\s*/\\s*\\d+)?\\s*[.:\\u00b7)\\-\\u2013]\\s+`, 'iu');
  return text.replace(re, '');
}

export interface StepSpeech {
  /** Position shown on the bar (0-based). */
  index: number;
  total: number;
  /** Step name shown on the bar. */
  title: string;
  /** Explanation shown under ⓘ (empty when the sim narrates by itself). */
  caption?: string;
  /** All steps done: no "Bước n." prefix. */
  done?: boolean;
}

const bare = (t: string) => t.replace(/[.!?…]+$/, '').toLowerCase();

/** Spoken parts of a step, in order; [] when there is nothing to say. `stepWord` = the bar's own word ("Bước"). */
export function stepParts(s: StepSpeech, stepWord: string): string[] {
  const title = speechText(stripStepNumber(s.title ?? '', stepWord));
  let caption = s.caption ? speechText(stripStepNumber(s.caption, stepWord)) : '';
  if (caption && bare(caption) === bare(title)) caption = '';
  if (!title && !caption) return [];
  const parts: string[] = [];
  if (!s.done) parts.push(`${stepWord.trim()} ${s.index + 1}.`);
  if (title && !(caption && bare(caption).startsWith(bare(title)))) parts.push(title);
  if (caption) parts.push(caption);
  return parts;
}

/**
 * Spoken parts of the step after `s`: from the bar's full step list when known (the finish step included), else only
 * its "Bước n." – what a clip engine fetches ahead.
 */
export function nextStepParts(s: StepSpeech, steps: readonly StepSpeech[] | null, stepWord: string): string[] {
  if (s.done) return [];
  const next = steps?.find((x) => x.index === s.index + 1);
  if (next) return stepParts(next, stepWord);
  return s.index + 1 < s.total ? [`${stepWord.trim()} ${s.index + 2}.`] : [];
}

/** Rough speaking time (ms) of a text at `rate` – safety timeouts and demo pacing when the real length is unknown. */
export function estimateMs(text: string, rate = 1): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.round((600 + words * 330) / Math.max(0.5, rate));
}

/**
 * Splits text into sentence chunks of at most ~`max` chars (Chrome may stop an utterance after ~15 s): sentence ends
 * first, then commas / semicolons; short sentences are joined again.
 */
export function speechChunks(text: string, max = 160): string[] {
  const sentences = text.split(/(?<=[.!?…;:])\s+/).flatMap((x) => (x.length <= max ? [x] : x.split(/(?<=,)\s+/)));
  const out: string[] = [];
  for (const piece of sentences.map((x) => x.trim()).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last && last.length + piece.length + 1 <= max) out[out.length - 1] = `${last} ${piece}`;
    else out.push(piece);
  }
  return out;
}
