import type { SimContext } from '../sim/types';
import { createHint } from './hint';
import { pointerHub } from './pointer';
import { createProcedureModel } from './procedureModel';
import { createProcedurePanel, stripStepNo } from './procedurePanel';
import { createProcedureVoice, procedureSpeech } from './procedureVoice';
import type { Procedure, ProcedureOptions } from './procedureTypes';
import { labText } from '../text';
import { emitLabProgress } from './progressEvent';

export type { Procedure, ProcedureOptions, ProcedureStep } from './procedureTypes';

/**
 * Bộ chạy quy trình theo BƯỚC: mỗi bước xong bằng thao tác thật (sự kiện gọi `complete(id)`), mũi tên gợi ý + caption bước hiện tại,
 * làm sai có phản hồi, "Tự động" chạy bằng đúng các action đó, hoàn tác bước gần nhất. Nút chỉ là phím tắt.
 */
export function createProcedure(ctx: SimContext, o: ProcedureOptions): Procedure {
  const hub = pointerHub(ctx);
  const model = createProcedureModel(o.steps.map((s) => s.id));
  const hint = createHint(ctx);
  let demoing = false;
  let timer = 0;
  /** Step shown on the bar (its `enter` ran): behind `model.index` while "Tự động" waits for the narration of the step before. */
  let at = 0;
  const stepAt = (i: number) => o.steps[i] ?? null;
  const skipped = (id: string | null) => !!id && !!o.steps.find((s) => s.id === id)?.skip?.();
  const ended = () => at >= o.steps.length;
  /** Vị trí / tổng số bước trên bảng (không đếm bước đang bị bỏ qua). */
  const shown = () => {
    const vis = o.steps.filter((s) => !s.skip?.());
    return { i: o.steps.slice(0, at).filter((s) => !s.skip?.()).length, n: vis.length };
  };
  const panel =
    o.panel === false
      ? null
      : createProcedurePanel(ctx, { demo: () => (demoing ? api.stop() : api.demo()), undo: () => api.undo(), restart: () => api.restart(), left: o.panelLeft });
  if (panel) {
    // Có thanh bước: caption bỏ số bước tự ghi (số thật ở thanh) và thanh đặt lại ngay khi caption đổi chữ / số dòng – không chờ nhịp 15 frame,
    // tránh caption vừa dài ra đè lên thanh bước.
    const raw = ctx.caption;
    ctx.caption = (text) => {
      raw(stripStepNo(text));
      window.setTimeout(() => requestAnimationFrame(panel.place), 0);
    };
    ctx.track(() => {
      ctx.caption = raw;
    });
  }
  const voice = createProcedureVoice(ctx, o.steps, o);
  const render = () => {
    const s = stepAt(at);
    const v = shown();
    panel?.render(ended() ? v.n : v.i, v.n, s?.title ?? labText('t_58f8d6d2c457'), demoing, v.i > 0);
  };
  const refresh = () => {
    const s = stepAt(at);
    const h = s?.hint;
    hint.show(h && o.hintWhen ? () => (o.hintWhen!() ? h() : null) : (h ?? null));
    if (o.captions !== false) ctx.caption(s ? s.caption : (o.finishCaption ?? labText('t_340bf4ba57e2')));
    render();
    voice.say(procedureSpeech(o.steps, at, ended(), o));
    o.onStep?.(s, at);
  };
  /** Shows step `target` (default: the step the model is on); steps skipped right now are passed over. */
  const enter = (target = model.index) => {
    let i = Math.min(target, model.index);
    while (i < model.index && skipped(o.steps[i].id)) i++;
    if (i >= model.index) {
      while (!model.finished && skipped(model.current)) model.complete(model.current!);
      i = model.index;
    }
    at = i;
    stepAt(at)?.enter?.();
    refresh();
    emitLabProgress(shown().i, shown().n, ended());
    if (ended()) {
      setDemo(false);
      o.onFinish?.();
    }
  };
  /**
   * "Tự động": the steps done meanwhile show one by one, each once the narration of the step before is over (the finish
   * too); the next step's action runs after the pause once the bar has caught up with the model.
   */
  const advance = () =>
    voice.after(() => {
      enter(at + 1);
      if (!demoing) return;
      clearTimeout(timer);
      if (at < model.index) advance();
      else timer = window.setTimeout(runDemoStep, (o.demoPause ?? 0.8) * 1000);
    });
  const setDemo = (on: boolean) => {
    demoing = on;
    hub.enabled = !on;
    clearTimeout(timer);
    // Stopped while a finished step waited for its narration: show the step the model is on.
    if (!on && voice.cancel()) return enter();
    refresh();
  };
  const runDemoStep = () => {
    const s = stepAt(model.index);
    if (!demoing || !s) return setDemo(false);
    const id = s.id;
    if (!s.auto) return setDemo(false);
    s.auto(() => {
      if (model.current === id) api.complete(id);
    });
  };
  const api: Procedure = {
    get current() {
      return stepAt(model.index);
    },
    get index() {
      return model.index;
    },
    get finished() {
      return model.finished;
    },
    get demoing() {
      return demoing;
    },
    complete(id) {
      if (!model.complete(id)) return false;
      hub.toast.show(`✓ ${o.steps.find((s) => s.id === id)?.title ?? ''}`, 'ok', 1400);
      if (!demoing) {
        enter();
        return true;
      }
      // A step done before its demo action ran (by the sim itself): that pending action must not run for the next step.
      clearTimeout(timer);
      advance();
      return true;
    },
    is: (id) => model.current === id,
    isDone: (id) => model.isDone(id),
    wrong(msg) {
      model.mistake();
      hub.toast.show(msg, 'error');
    },
    undo() {
      voice.cancel();
      if (demoing) setDemo(false);
      let id = model.undo();
      if (!id) return;
      while (id && skipped(id)) id = model.undo();
      if (!id) return enter();
      o.steps.find((s) => s.id === id)?.undo?.();
      enter();
    },
    restart() {
      voice.cancel();
      setDemo(false);
      if (o.onRestart) o.onRestart();
      else while (model.index > 0) api.undo();
      model.reset();
      enter();
    },
    demo() {
      if (model.finished) api.restart();
      setDemo(true);
      runDemoStep();
    },
    stop() {
      voice.stop();
      setDemo(false);
    },
    retitle: render,
  };
  if (o.gui !== false) {
    const f = ctx.gui.addFolder(labText('t_4e8bce41f28f'));
    f.add({ demo: () => api.demo() }, 'demo').name(labText('t_31dcad619d5d'));
    f.add({ undo: () => api.undo() }, 'undo').name(labText('t_813d79220b81'));
    f.add({ restart: () => api.restart() }, 'restart').name(labText('t_a4dc8fe67683'));
  }
  ctx.track(() => clearTimeout(timer));
  ctx.track(hub.busy(() => demoing));
  // Frame đầu: đặt lại caption (SimHost có thể xoá caption đặt trong create()) + bám vị trí caption.
  let frames = 0;
  ctx.track(
    hub.onFrame(() => {
      if (frames++ === 1) refresh();
      if (frames % 15 === 0) panel?.place();
    }),
  );
  enter();
  return api;
}
