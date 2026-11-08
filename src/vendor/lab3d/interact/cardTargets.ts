import * as THREE from 'three';
import { createCardDrop, type CardDrop, type CardDropOptions } from './cardDrop';
import { createDropZones } from './dropZones';
import type { Constraint, InteractCtx } from './types';

export interface CardTarget {
  id: string;
  /** Đoạn trục của vật (thế giới) – vd. ống nghiệm: đáy → miệng. Thẻ thả cách đoạn ≤ `radius` là trúng. */
  segment(): [THREE.Vector3, THREE.Vector3];
  radius: number;
  enabled?(): boolean;
  /** true | chuỗi lí do sai (toast) | false = bỏ qua. */
  accepts?(item: string): boolean | string;
  onDrop?(item: string): void;
}

export interface CardTargetsOptions extends Omit<CardDropOptions, 'zones' | 'surface'> {
  targets: CardTarget[];
}

/**
 * Kéo THẺ HTML thả vào VẬT 3D dạng thanh (ống nghiệm, lọ, cột…): tia con trỏ chiếu lên mặt phẳng đứng qua các vật, hướng về camera;
 * vùng thả = điểm gần nhất trên trục vật (thả ở miệng, giữa hay đáy ống đều trúng). Gộp createCardDrop + createDropZones.
 * `carryTo(item, id)` (demo) bay thẻ tới giữa vật, cùng luồng kiểm tra.
 */
export function createCardTargets(ctx: InteractCtx, o: CardTargetsOptions): CardDrop {
  const zones = createDropZones(ctx);
  const last = new THREE.Vector3(1e9, 1e9, 1e9);
  const line = new THREE.Line3();
  const near = (t: CardTarget) => {
    const [a, b] = t.segment();
    return line.set(a, b).closestPointToPoint(last, true, new THREE.Vector3());
  };
  for (const t of o.targets)
    zones.add({ id: t.id, anchor: () => near(t), shape: 'sphere', radius: t.radius, ring: false, enabled: t.enabled, accepts: t.accepts, onDrop: t.onDrop });
  const plane = new THREE.Plane();
  const mid = new THREE.Vector3();
  const surface: Constraint = {
    project(ray, out) {
      const live = o.targets.filter((t) => t.enabled?.() ?? true);
      mid.set(0, 0, 0);
      for (const t of live) {
        const [a, b] = t.segment();
        mid.add(a).add(b);
      }
      if (live.length) mid.multiplyScalar(0.5 / live.length);
      // Mặt đứng qua các vật (pháp tuyến = hướng nhìn nằm ngang): con trỏ trên thân vật → điểm nằm đúng trên trục vật ở mọi độ cao.
      const n = ctx.camera.getWorldDirection(new THREE.Vector3()).negate();
      if (Math.hypot(n.x, n.z) > 0.2) n.setY(0).normalize();
      plane.setFromNormalAndCoplanarPoint(n, mid);
      const ok = !!ray.intersectPlane(plane, out);
      if (ok) last.copy(out);
      return ok;
    },
  };
  const cards = createCardDrop(ctx, { ...o, zones, surface });
  const carry = cards.carryTo.bind(cards);
  // Demo: đặt điểm trỏ ở giữa vật trước khi bay thẻ (tâm vùng = điểm gần nhất trên trục vật).
  cards.carryTo = (item, id, done) => {
    const t = o.targets.find((x) => x.id === id);
    if (t) {
      const [a, b] = t.segment();
      last.copy(a).add(b).multiplyScalar(0.5);
    }
    carry(item, id, done);
  };
  return cards;
}
