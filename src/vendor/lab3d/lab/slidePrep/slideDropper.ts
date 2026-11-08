import * as THREE from 'three';
import { addPickProxy, createDropperGesture, type DropperGesture, type DropperGestureOptions, type InteractCtx } from '../../interact/index';
import type { ReagentBottle } from '../equipment/reagentBottle';
import { mm } from '../units';
import { labText } from '../../text';

/** Ống hút đã rút ra hệ `root`: đầu nhọn nghỉ ở `rest` (trong lọ), miệng lọ `mouth`, quả bóp `bulb`. */
export interface DropperKit {
  tool: THREE.Object3D;
  bulb: THREE.Object3D;
  mouth: THREE.Vector3;
  rest: THREE.Vector3;
}

/** Ống hút cắm sẵn của lọ nhỏ giọt kit (`createReagentBottle({style: 'dropper'})`, lọ đã đặt trong `root`) → chuyển sang `root`. */
export function bottleDropper(root: THREE.Object3D, bottle: ReagentBottle): DropperKit {
  const tool = bottle.dropper;
  if (!tool) throw new Error(labText('t_31cad9650ac8'));
  root.updateMatrixWorld(true);
  const rest = root.worldToLocal(bottle.dropperRest.getWorldPosition(new THREE.Vector3()));
  const mouth = root.worldToLocal(bottle.group.localToWorld(new THREE.Vector3(0, bottle.vessel.mouthY, 0)));
  tool.position.copy(rest);
  tool.rotation.set(0, 0, 0);
  root.add(tool);
  return { tool, bulb: tool.children[1], mouth, rest };
}

export interface SlideDropTarget {
  id?: string;
  /** Điểm nhỏ giọt trên mặt lam (hệ root) – đọc mỗi lần (lam có thể đang ở tấm lót, giá nhuộm hay bàn kính). */
  at(): THREE.Vector3;
  /** Mặt thoáng nơi giọt chạm (hệ root) – mặc định at().y + 1,5 mm. */
  surface?(): number;
  radius?: number;
  maxDrops?: number | (() => number);
  fullReason?: string;
  accepts?(): boolean | string;
  onDrop?(i: number, hit: THREE.Vector3): void;
}

export interface SlideDropperOptions extends Omit<DropperGestureOptions, 'tool' | 'bulb' | 'parent' | 'rest' | 'sources' | 'targets' | 'carryY'> {
  kit: DropperKit;
  parent: THREE.Object3D;
  /** Lọ nguồn: id, màu dung dịch (giọt), bán kính bắt. */
  source: { id: string; color?: THREE.ColorRepresentation; radius?: number; dip?: number };
  targets: SlideDropTarget[];
  /** Độ cao mang ngang (hệ root) – mặc định miệng lọ + 0,12. */
  carryY?: number;
}

/**
 * Ống hút nhỏ giọt lên lam bằng tay (createDropperGesture): giữ chuột trong lọ = bóp hút, mang tới trên lam, giữ yên / nhả = nhỏ giọt.
 * Gói các giá trị đã chỉnh ở TN-062-01 (sức chứa 3 giọt, đầu nhọn cách mặt lam 0,08, nhả là về lọ) + vùng bắt to quanh ống hút.
 */
export function createSlideDropper(ctx: InteractCtx, o: SlideDropperOptions): DropperGesture {
  const { kit, parent } = o;
  addPickProxy((x) => ctx.track(x), kit.tool, new THREE.Vector3(0.12, 0.8, 0.12), new THREE.Vector3(0, mm(90), 0));
  const targets = o.targets.map((t, i) => ({
    id: t.id ?? `slide${i || ''}`,
    get mouth() {
      return t.at();
    },
    radius: t.radius ?? 0.12,
    surfaceY: () => (t.surface ? t.surface() : t.at().y + mm(1.5)),
    maxDrops: t.maxDrops,
    fullReason: t.fullReason,
    accepts: t.accepts,
    onDrop: t.onDrop,
  }));
  return createDropperGesture(ctx, {
    capacity: 3,
    above: 0.08,
    park: false,
    ...o,
    tool: kit.tool,
    bulb: kit.bulb,
    parent,
    rest: kit.rest,
    carryY: o.carryY ?? kit.mouth.y + 0.12,
    sources: [{ id: o.source.id, mouth: kit.mouth, radius: o.source.radius ?? 0.13, dip: o.source.dip ?? 0.3, color: o.source.color }],
    targets,
  });
}
