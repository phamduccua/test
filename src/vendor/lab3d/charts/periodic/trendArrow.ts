import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { SimContext } from '../../sim/types';

export interface TrendArrowOptions {
  color?: number;
  /** Bán kính thân (đv cảnh). */
  radius?: number;
  label?: string;
  /** Nhãn đặt ở giữa thân + độ lệch này. */
  labelOffset?: THREE.Vector3Tuple;
  /** Nhãn dọc (xoay 90°, đọc từ dưới lên như trục tung sách). */
  vertical?: boolean;
}

export interface TrendArrow {
  group: THREE.Group;
  label: CSS2DObject | null;
  setVisible(v: boolean): void;
}

/** Mũi tên 3D (trụ + nón) từ `from` tới `to`, có nhãn CSS2D tuỳ chọn – chỉ chiều xu hướng. */
export function createTrendArrow(
  ctx: Pick<SimContext, 'track' | 'labels'>,
  from: THREE.Vector3,
  to: THREE.Vector3,
  o: TrendArrowOptions = {},
): TrendArrow {
  const r = o.radius ?? 0.07;
  const dir = to.clone().sub(from);
  const len = dir.length();
  const head = Math.min(len * 0.25, r * 6);
  const mat = ctx.track(
    new THREE.MeshPhysicalMaterial({ color: o.color ?? 0xdfe6f0, roughness: 0.3, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }),
  );
  const shaftGeo = ctx.track(new THREE.CylinderGeometry(r, r, len - head, 20));
  shaftGeo.translate(0, (len - head) / 2, 0);
  const coneGeo = ctx.track(new THREE.ConeGeometry(r * 2.6, head, 28));
  coneGeo.translate(0, len - head / 2, 0);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  const cone = new THREE.Mesh(coneGeo, mat);
  shaft.castShadow = cone.castShadow = true;
  const group = new THREE.Group();
  group.name = 'trend-arrow';
  const body = new THREE.Group();
  body.add(shaft, cone);
  body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  group.position.copy(from);
  group.add(body);
  let label: CSS2DObject | null = null;
  if (o.label) {
    const anchor = new THREE.Object3D();
    anchor.position.copy(dir.clone().multiplyScalar(0.5)).add(new THREE.Vector3(...(o.labelOffset ?? [0, 0.35, 0])));
    group.add(anchor);
    label = ctx.labels.add(anchor, o.label, { className: `pt-arrow${o.vertical ? ' pt-arrow--v' : ''}` });
  }
  return {
    group,
    label,
    setVisible(v) {
      group.visible = v;
      if (label) label.visible = v;
    },
  };
}
