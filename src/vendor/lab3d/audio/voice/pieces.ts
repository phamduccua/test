/**
 * How a spoken part can still be said from pre-generated clips when it has no clip of its own (clips.ts): sentence by
 * sentence, and a sentence that has no clip either from the text around its numbers plus one clip per number
 * ("Ngày 21: mô sẹo tăng sinh." → "Ngày" · "21" · "mô sẹo tăng sinh."). Captions with a live value (a day count, a
 * slider value, a clock reading) then need a clip per number instead of a clip per sentence. Pure; the clip generator
 * asks the app for the same split (DEV probe `__voice.pieces`).
 */

export interface Piece {
  text: string;
  /** Said right after the piece before, without a pause (the pieces of one sentence). */
  joined: boolean;
}

/** Sentence ends followed by a space ("0,5." inside a number or "AgNO3!)" before a bracket do not split). */
const SENTENCE_RE = /(?<=[.!?…])\s+(?=\S)/u;
/** A number said on its own: digits with inner separators (0,05 · 19.4 · 01:00:00 · 4/4), not glued to letters (CO2). */
const NUMBER_RE = /(?<![\p{L}\p{N}_])\p{Nd}+(?:[.,:/]\p{Nd}+)*(?![\p{L}\p{N}_])/gu;
/** Punctuation that only belonged to the neighbouring number or sentence. */
const LEAD_RE = /^[\s,.;:)\]]+/u;
const TAIL_RE = /[\s,;:([]+$/u;
const SAYABLE_RE = /[\p{L}\p{N}]/u;

/** Sentences of a part (the part itself when it is one sentence). */
export function sentences(part: string): string[] {
  return part.split(SENTENCE_RE).map((s) => s.trim()).filter(Boolean);
}

/** Text around the numbers of a sentence and the numbers themselves, in order; [] when it has no number. */
export function numberPieces(sentence: string): string[] {
  const out: string[] = [];
  const text = (s: string) => {
    const t = s.replace(LEAD_RE, '').replace(TAIL_RE, '').trim();
    if (SAYABLE_RE.test(t)) out.push(t);
  };
  let at = 0;
  for (const m of sentence.matchAll(NUMBER_RE)) {
    text(sentence.slice(at, m.index));
    out.push(m[0]);
    at = m.index + m[0].length;
  }
  if (!at) return [];
  text(sentence.slice(at));
  return out;
}

/**
 * Ways to say a part, from the most natural: the whole part; else every sentence whole or, when it has no clip, split
 * around its numbers. `has(text)` tells whether a text has a clip; null = no way.
 */
export async function resolvePieces(part: string, has: (text: string) => Promise<boolean>): Promise<Piece[] | null> {
  if (await has(part)) return [{ text: part, joined: false }];
  const all = sentences(part);
  const out: Piece[] = [];
  for (const s of all) {
    if (all.length > 1 && (await has(s))) {
      out.push({ text: s, joined: false });
      continue;
    }
    const nums = numberPieces(s);
    if (nums.length < 2) return null;
    for (let i = 0; i < nums.length; i++) {
      if (!(await has(nums[i]))) return null;
      out.push({ text: nums[i], joined: i > 0 });
    }
  }
  return out.length ? out : null;
}
