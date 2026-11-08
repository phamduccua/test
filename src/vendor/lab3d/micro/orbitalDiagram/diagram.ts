import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { SimContext } from '../../sim/types';
import { createSpinArrow, type SpinArrow } from './arrow';
import { createOrbitalBox, type OrbitalBox } from './box';
import type { FillingModel } from './filling';
import { cssHex, FLAG_COLORS, SUB_COLORS } from './kit';
import { slotOffset, type SubCenter } from './layout';
import { subName, sup, type Spin } from './subshell';
import './diagram.css';

export interface DiagramOptions {
  /** Cạnh ô (đv cảnh). */
  box?: number;
  depth?: number;
  /** Nhãn dưới phân lớp: 'name' = "2p", 'count' = "2p⁴" (tự cập nhật), false = không. */
  labels?: 'name' | 'count' | false;
  /** Độ cao thả electron (bội số cạnh ô). */
  dropHeight?: number;
}

export interface OrbitalDiagram {
  group: THREE.Group;
  model: FillingModel;
  box: number;
  /** Mỗi ô một OrbitalBox (cùng thứ tự `model.slots`). */
  boxes: OrbitalBox[];
  /** Nhóm của mỗi phân lớp (gốc tại tâm phân lớp). */
  subGroups: THREE.Group[];
  labels: (CSS2DObject | null)[];
  /** Dùng với createPicker: {object: lòng ô, slot}. */
  pickables: { object: THREE.Object3D; slot: number }[];
  /** Tâm ô theo toạ độ `group`. */
  slotLocal(slot: number, out?: THREE.Vector3): THREE.Vector3;
  slotWorld(slot: number, out?: THREE.Vector3): THREE.Vector3;
  /** Khớp mũi tên với `model`: electron mới rơi vào (từ `from` – toạ độ group), electron bị bỏ bay đi. */
  sync(o?: { from?: THREE.Vector3; instant?: boolean; delayStep?: number }): void;
  /** Electron bị từ chối: rơi tới miệng ô rồi bật ra, ô rung đỏ. */
  reject(slot: number, spin: Spin, from?: THREE.Vector3): void;
  flash(slot: number, color?: THREE.ColorRepresentation): void;
  /** Mũi tên đang nằm trong ô (theo thứ tự ↑ trước). */
  arrowsOf(slot: number): SpinArrow[];
  setSubFade(sub: number, a: number): void;
  setLabel(sub: number, text: string): void;
  update(dt: number): void;
  dispose(): void;
}

/** Sơ đồ ô orbital 3D gắn với một FillingModel; vị trí phân lớp do `centers` (placeRow / placeLadder / tự đặt). */
export function createOrbitalDiagram(ctx: SimContext, model: FillingModel, centers: SubCenter[], o: DiagramOptions = {}): OrbitalDiagram {
  const B = o.box ?? 0.5;
  const AH = B * 0.78;
  const group = new THREE.Group();
  group.name = 'orbital-diagram';
  const subGroups = model.subs.map((_, i) => {
    const g = new THREE.Group();
    g.position.set(centers[i].x, centers[i].y, centers[i].z);
    group.add(g);
    return g;
  });
  const boxes = model.slots.map((sl) => {
    const s = model.subs[sl.sub];
    const b = createOrbitalBox(ctx, { w: B, h: B, d: o.depth ?? B * 0.62, color: SUB_COLORS[s.l] });
    const holder = new THREE.Group();
    holder.position.x = slotOffset(s, sl.k, B);
    holder.add(b.group);
    subGroups[sl.sub].add(holder);
    return b;
  });
  const labels = model.subs.map((s, i) => {
    if (o.labels === false) return null;
    const anchor = new THREE.Object3D();
    anchor.position.y = -B * 0.86;
    subGroups[i].add(anchor);
    return ctx.labels.add(anchor, subName(s), { variant: 'small', className: 'od-sub', color: cssHex(SUB_COLORS[s.l]) });
  });
  const arrows: SpinArrow[][] = model.slots.map(() => []);
  const leaving: SpinArrow[] = [];
  const v = new THREE.Vector3();

  const slotLocal = (slot: number, out = new THREE.Vector3()) => {
    const sl = model.slots[slot];
    const c = centers[sl.sub];
    return out.set(c.x + slotOffset(model.subs[sl.sub], sl.k, B), c.y, c.z);
  };
  const place = (slot: number) => {
    const list = arrows[slot].sort((a, b) => b.spin - a.spin);
    list.forEach((a, i) => {
      slotLocal(slot, a.target);
      if (list.length === 2) a.target.x += (i === 0 ? -1 : 1) * B * 0.2;
      a.target.z += B * 0.04;
    });
  };
  const makeArrow = (spin: Spin) => {
    const a = createSpinArrow(ctx, spin, AH);
    group.add(a.group);
    return a;
  };

  const d: OrbitalDiagram = {
    group,
    model,
    box: B,
    boxes,
    subGroups,
    labels,
    pickables: boxes.map((b, slot) => ({ object: b.hit, slot })),
    slotLocal,
    slotWorld: (slot, out = new THREE.Vector3()) => group.localToWorld(slotLocal(slot, out)),
    sync(so = {}) {
      let k = 0;
      model.slots.forEach((sl, slot) => {
        const want = [...sl.spins];
        const keep: SpinArrow[] = [];
        for (const a of arrows[slot]) {
          const j = want.indexOf(a.spin);
          if (j >= 0) {
            want.splice(j, 1);
            keep.push(a);
          } else {
            a.leave();
            leaving.push(a);
          }
        }
        const fresh = want.map(makeArrow);
        arrows[slot] = [...keep, ...fresh];
        place(slot);
        for (const a of fresh) {
          if (so.instant) a.snap();
          else a.drop(so.from?.clone() ?? a.target.clone().add(v.set(0, B * (o.dropHeight ?? 3.2), 0)), (so.delayStep ?? 0) * k++);
        }
        boxes[slot].setFill(sl.spins.length / 2);
      });
      if (o.labels === 'count')
        model.subs.forEach((s, i) => d.setLabel(i, `${subName(s)}${model.subCount(i) ? sup(model.subCount(i)) : ''}`));
    },
    reject(slot, spin, from) {
      const a = makeArrow(spin);
      slotLocal(slot, a.target);
      a.target.x += arrows[slot].length ? B * 0.2 : 0;
      a.reject(from?.clone() ?? a.target.clone().add(v.set(0, B * (o.dropHeight ?? 3.2), 0)));
      leaving.push(a);
      boxes[slot].flash(FLAG_COLORS.bad, 1.2);
      boxes[slot].shake();
    },
    flash(slot, color = FLAG_COLORS.good) {
      boxes[slot].flash(color, 1);
    },
    arrowsOf: (slot) => arrows[slot],
    setSubFade(sub, a) {
      for (const j of model.slotsOf(sub)) {
        boxes[j].setFade(a);
        arrows[j].forEach((x) => x.setOpacity(a));
      }
      const l = labels[sub];
      if (l) l.element.style.opacity = String(Math.max(0.15, a));
    },
    setLabel(sub, text) {
      const l = labels[sub];
      if (l && l.element.textContent !== text) l.element.textContent = text;
    },
    update(dt) {
      boxes.forEach((b) => b.update(dt));
      arrows.forEach((list) => list.forEach((a) => a.update(dt)));
      for (let i = leaving.length - 1; i >= 0; i--) {
        leaving[i].update(dt);
        if (leaving[i].done) leaving.splice(i, 1)[0].dispose();
      }
    },
    dispose() {
      arrows.flat().concat(leaving).forEach((a) => a.dispose());
      boxes.forEach((b) => b.dispose());
      labels.forEach((l) => {
        l?.element.remove();
        l?.removeFromParent();
      });
      group.removeFromParent();
    },
  };
  return d;
}
