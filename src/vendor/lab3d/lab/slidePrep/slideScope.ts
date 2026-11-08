import type { InteractCtx } from '../../interact/index';
import { createFocusModel, type FocusKnob, type FocusModel } from './focusModel';
import { createScopeControls, type ScopeControls, type ScopeControlsOptions } from './scopeControls';
import type { ScopeParts } from './scopeParts';
import { labText } from '../../text';

/**
 * Độ sâu trường ảnh (µm) ≈ λn/NA² + n·e/(M·NA), λ = 0,55 µm, e = 11 µm (Nikon MicroscopyU): 4× NA 0,1 ≈ 60 µm; 10× NA 0,25 ≈ 13 µm;
 * 40× NA 0,65 ≈ 1,7 µm; 100× dầu (n = 1,515) NA 1,25 ≈ 0,7 µm.
 */
export const SCOPE_DOF: Record<number, number> = { 4: 60, 10: 13, 40: 1.7, 100: 0.7 };
/** Khoảng làm việc (µm) của vật kính tiêu sắc trường học: 4× ≈ 20 mm, 10× ≈ 7 mm, 40× ≈ 0,6 mm, 100× dầu ≈ 0,15 mm. */
export const SCOPE_WD: Record<number, number> = { 4: 20000, 10: 7000, 40: 600, 100: 150 };

export interface SlideScopeOptions {
  parts: ScopeParts;
  /** Mâm vật kính của kính (createMicroscope / fitOilObjective): đổi vật kính trên hình. */
  turret: { setObjective(o: never): void };
  stops: readonly number[];
  /** Vật kính lúc đầu (mặc định 10). */
  start?: number;
  live(): boolean;
  micro(): boolean;
  cls: string;
  /** Có dầu soi giữa vật kính 100× và tiêu bản (mặc định coi như có). */
  oil?(): boolean;
  /** Đang ở bước lấy nét ở 10× (chưa nét thì chưa cho chuyển vật kính lớn hơn). */
  focusFirst?(): boolean;
  /** Luật riêng của sim trước khi đổi vật kính (vd. chọn vùng mẫu ở 10× rồi mới lên 40×): true hoặc lí do không cho. */
  canSwitch?(to: number, from: number): true | string;
  /** Lời cảnh báo (toast đỏ + đếm lỗi của quy trình). */
  wrong(msg: string): void;
  /** Vật kính vừa đổi (sim chỉnh camera vi mô, tham số lil-gui). */
  changed?(o: number): void;
  crash?(): void;
  sound?(e: FocusKnob | 'nose', dz: number): void;
  settled?(): void;
  layers?(): readonly number[];
  pan?: ScopeControlsOptions['pan'];
}

export interface SlideScope {
  focus: FocusModel;
  controls: ScopeControls;
  readonly objective: number;
  /** Mâm vật kính (tay / demo / lil-gui): true hoặc lí do không cho. */
  switchTo(o: number): true | string;
  /** Đặt ngay vật kính (hoàn tác, làm lại) – không lệch nét đồng tiêu. */
  setObjective(o: number): void;
  /** Mờ nhoè thị trường (px): lệch nét + thiếu dầu ở 100×. */
  blur(max?: number): number;
  /** Ảnh 100× thiếu dầu. */
  dry(): boolean;
}

/**
 * Kính hiển vi dùng chung cho các sim làm tiêu bản: mô hình lấy nét (µm) + ốc to / ốc nhỏ / mâm vật kính (núm 3D + vòng HTML) + luật
 * đổi vật kính (lấy nét 10× trước; 100× không dầu → mờ, cảnh báo; lamen vỡ thì thôi).
 */
export function createSlideScope(ctx: InteractCtx, o: SlideScopeOptions): SlideScope {
  let obj = o.start ?? 10;
  const focus = createFocusModel({ dof: SCOPE_DOF, wd: SCOPE_WD, layers: o.layers }, { obj: () => obj, warn: o.wrong, crash: () => o.crash?.() });
  const dry = () => obj === 100 && !(o.oil?.() ?? true);
  const setObjective = (to: number) => {
    obj = to;
    o.turret.setObjective(to as never);
    o.changed?.(to);
  };
  const switchTo = (to: number): true | string => {
    if (to === obj) return true;
    if (focus.broken) return labText('t_1e0a024c8569');
    if (to > obj && obj === 10 && o.focusFirst?.() && !focus.sharp()) return labText('t_782df8024351');
    const rule = o.canSwitch?.(to, obj) ?? true;
    if (rule !== true) return rule;
    if (to === 4) return labText('t_0a5c44a6b2e1');
    if (to === 100 && !(o.oil?.() ?? true)) o.wrong(labText('t_4999c7e10ae6'));
    focus.objective(obj, to);
    setObjective(to);
    return true;
  };
  const controls = createScopeControls(ctx, {
    focus, parts: o.parts, stops: o.stops, objective: () => obj, switchTo, live: o.live, micro: o.micro, cls: o.cls,
    sound: o.sound, settled: o.settled, pan: o.pan,
  });
  return {
    focus, controls, switchTo, setObjective,
    get objective() {
      return obj;
    },
    blur: (max = 8) => focus.blur(max) + (dry() ? 3.5 : 0),
    dry,
  };
}
