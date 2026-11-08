import type * as THREE from 'three';
import { createOutline, createOutlineMaterial } from '../lab/interaction/outline';
import { UI } from '../ui/tokens';
import type { HoverState, InteractCtx } from './types';

export interface HoverFxOptions {
  /** Viền sáng (inverted hull, chỉ mesh đục) – màu; false = không viền. Mặc định màu nhấn (đỏ PTIT, token UI.hex.accent). */
  outline?: THREE.ColorRepresentation | false;
  /** Màu viền khi đang kéo (mặc định = outline). */
  dragColor?: THREE.ColorRepresentation;
  /** Nâng nhẹ khi rê lên (đơn vị cảnh, cộng vào position.y của `liftTarget`); 0 = không. */
  lift?: number;
  /** Vật được nâng (mặc định root). Nên là nhóm con "hiển thị" nếu root bị kéo/đặt vị trí mỗi frame. */
  liftTarget?: THREE.Object3D;
  /** Phóng nhẹ (vd. 1,04) khi rê lên. */
  pop?: number;
}

/**
 * Phản hồi rê chuột cho một vật: viền sáng + nâng/phóng nhẹ. Trả hàm `(state) => void` gắn thẳng vào `PointerTarget.onHover`.
 * Nâng chỉ áp ở 'hover' (bỏ khi bắt đầu kéo để không lệch vị trí kéo); viền giữ cả khi kéo.
 */
export function createHoverFx(ctx: Pick<InteractCtx, 'track'>, root: THREE.Object3D, o: HoverFxOptions = {}): (s: HoverState) => void {
  const color = o.outline === false ? null : (o.outline ?? UI.hex.accent);
  const mat = color === null ? null : createOutlineMaterial(ctx, color);
  const outline = mat ? createOutline(root, mat) : null;
  const dragColor = o.dragColor ?? color;
  const lift = o.lift ?? 0;
  const liftObj = o.liftTarget ?? root;
  const pop = o.pop ?? 1;
  let lifted = 0;
  let popped = false;
  return (s) => {
    outline?.set(s !== 'off');
    if (mat && color !== null) mat.color.set(s === 'drag' && dragColor !== null ? dragColor : color);
    const wantLift = s === 'hover' ? lift : 0;
    if (wantLift !== lifted) {
      liftObj.position.y += wantLift - lifted;
      lifted = wantLift;
    }
    const wantPop = s === 'hover' && pop !== 1;
    if (wantPop !== popped) {
      liftObj.scale.multiplyScalar(wantPop ? pop : 1 / pop);
      popped = wantPop;
    }
  };
}

/** Gộp nhiều hàm onHover (vd. viền + nhãn gợi ý). */
export const combineHover =
  (...fns: ((s: HoverState) => void)[]) =>
  (s: HoverState) => {
    for (const f of fns) f(s);
  };
