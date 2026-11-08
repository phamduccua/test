import * as THREE from 'three';
import { petriProfile } from '../glassware/shapes';
import { createVessel } from '../glassware/vessel';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';
import { mm } from '../units';

/**
 * A-DIA-THACH-KSD: đĩa Petri Ø`diameter` có lớp thạch đục dày `depth` mm; mặt thạch là canvas vuông S×S phủ đường kính thạch
 * (vẽ vệt ria, khuẩn lạc, thảm vi khuẩn, vòng vô khuẩn). Nắp là nhóm riêng để sim nhấc ra/đặt lại.
 * Toạ độ đĩa (u, v) tính bằng mm từ tâm: u → +x, v → −z (v dương = phía sau đĩa).
 */
export interface AgarPlate {
  /** Gốc ở đáy ngoài, tâm đĩa. */
  group: THREE.Group;
  /** Đáy + thạch: gắn khoanh/khuẩn lạc vào đây. */
  base: THREE.Group;
  lid: THREE.Group;
  /** Tư thế nắp khi đậy (toạ độ của group). */
  lidClosed: { pos: THREE.Vector3; rot: THREE.Euler };
  /** Bán kính mặt thạch (mm). */
  radius: number;
  /** Độ cao mặt thạch trong `base`. */
  agarY: number;
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  size: number;
  /** mm → pixel canvas. */
  px(u: number, v: number): [number, number];
  /** mm trên đĩa → điểm trên mặt thạch (toạ độ `base`). */
  toLocal(u: number, v: number, out?: THREE.Vector3): THREE.Vector3;
  /** Gọi sau khi vẽ xong lên canvas. */
  commit(): void;
}

export interface AgarPlateOptions {
  diameter?: number;
  /** Bề dày thạch (mm) – EUCAST: 4 ± 0,5 mm. */
  depth?: number;
  color?: THREE.ColorRepresentation;
  size?: number;
}

export function createAgarPlate(ctx: Tracker, o: AgarPlateOptions = {}): AgarPlate {
  const D = o.diameter ?? 90;
  const depth = o.depth ?? 4;
  const S = o.size ?? 512;
  const R = D / 2 - 1.6;
  const group = new THREE.Group();
  group.name = 'agar-plate';
  const base = new THREE.Group();
  group.add(base);
  const dish = createVessel(ctx, petriProfile(D, 13), { name: 'petri-base' });
  base.add(dish.group);

  const { canvas, g } = makeCanvas(S, S);
  g.fillStyle = new THREE.Color(o.color ?? '#d8b878').getStyle();
  g.fillRect(0, 0, S, S);
  const tex = ctx.track(canvasTexture(canvas));
  const color = new THREE.Color(o.color ?? '#d8b878');
  const topMat = ctx.track(new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.12 }));
  const sideMat = ctx.track(new THREE.MeshPhysicalMaterial({ color: color.clone().multiplyScalar(0.8), roughness: 0.35 }));
  const agarY = mm(1 + depth);
  const topGeo = ctx.track(new THREE.CircleGeometry(mm(R), 96));
  const uv = topGeo.attributes.uv as THREE.BufferAttribute;
  const p = topGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) / mm(R) + 1) / 2, (p.getY(i) / mm(R) + 1) / 2);
  topGeo.rotateX(-Math.PI / 2);
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = agarY;
  top.receiveShadow = true;
  const side = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(R), mm(R), mm(depth), 96, 1, true)), sideMat);
  side.position.y = mm(1 + depth / 2);
  base.add(top, side);

  const lid = new THREE.Group();
  lid.name = 'petri-lid';
  const lidV = createVessel(ctx, petriProfile(D + 4, 9), { name: 'petri-lid-glass' });
  lidV.group.rotation.x = Math.PI;
  lidV.group.position.y = mm(9.6);
  lid.add(lidV.group);
  const lidClosed = { pos: new THREE.Vector3(0, mm(4), 0), rot: new THREE.Euler() };
  lid.position.copy(lidClosed.pos);
  group.add(lid);

  return {
    group,
    base,
    lid,
    lidClosed,
    radius: R,
    agarY,
    canvas,
    g,
    size: S,
    px: (u, v) => [((u + R) / (2 * R)) * S, ((R - v) / (2 * R)) * S],
    toLocal: (u, v, out = new THREE.Vector3()) => out.set(mm(u), agarY, -mm(v)),
    commit: () => void (tex.needsUpdate = true),
  };
}
