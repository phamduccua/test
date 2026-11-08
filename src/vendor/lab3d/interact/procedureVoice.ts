/**
 * Spoken guidance of the procedure bar (`createProcedure`): the shown step is said as "Bước n. <title>. <caption>"
 * (caption only when the bar owns the captions), and in "Tự động" a finished step waits for its narration before the
 * next one shows – the step's animation and its narration run together, the demo moves on when both are done.
 * Voice off / muted / unsupported → `after()` runs at once (timing as before).
 */
import { createStepVoice, type StepSpeech } from '../audio/voice';
import type { SimContext } from '../sim/types';
import { labText } from '../text';
import type { ProcedureOptions, ProcedureStep } from './procedureTypes';

type SpeechOptions = Pick<ProcedureOptions, 'captions' | 'finishCaption'>;

/** What the bar shows for step `index` (bar numbering skips the steps that are skipped right now). */
export function procedureSpeech(steps: readonly ProcedureStep[], index: number, finished: boolean, o: SpeechOptions): StepSpeech {
  const visible = steps.filter((s) => !s.skip?.()).length;
  const captions = o.captions !== false;
  if (finished) return { index: visible, total: visible, title: labText('t_58f8d6d2c457'), caption: captions ? (o.finishCaption ?? labText('t_340bf4ba57e2')) : '', done: true };
  const s = steps[index];
  const at = steps.slice(0, index).filter((x) => !x.skip?.()).length;
  return { index: at, total: visible, title: s?.title ?? '', caption: captions ? s?.caption : '' };
}

export function createProcedureVoice(ctx: Pick<SimContext, 'track'>, steps: readonly ProcedureStep[], o: SpeechOptions) {
  const catalog = () => [...steps.map((s, i) => (s.skip?.() ? null : procedureSpeech(steps, i, false, o))), procedureSpeech(steps, steps.length, true, o)].filter((s): s is StepSpeech => !!s);
  const voice = createStepVoice({ catalog });
  let ticket = 0;
  ctx.track(() => {
    ticket = 0;
    voice.dispose();
  });
  return {
    say: (s: StepSpeech) => void voice.say(s),
    /** Demo: run `next` once the current narration is over (at once when silent; capped, see `speechSettled`). */
    after(next: () => void): void {
      if (!voice.speaking()) return next();
      const t = ++ticket;
      void voice.settled().then(() => {
        if (t !== ticket) return;
        ticket = 0;
        next();
      });
    },
    /** Drop a waiting `next`; true if one was waiting. */
    cancel(): boolean {
      const had = ticket !== 0;
      ticket = 0;
      return had;
    },
    /** Stop the narration (demo stopped). */
    stop: () => voice.stop(),
  };
}
