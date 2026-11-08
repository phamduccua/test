import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { SimContext } from '../../sim/types';
import { axisDir, BOOK_FRAME, type AxisFrame } from './frame';
import './axes.css';

export interface OrbitalAxesOptions {
  /** Nửa chiều dài mỗi trục (đv cảnh). */
  length?: number;
  frame?: AxisFrame;
  /** Màu trục x, y, z (mặc định xám sáng như sách). */
  colors?: [THREE.ColorRepresentation, THREE.ColorRepresentation, THREE.ColorRepresentation];
  /** Độ dày tương đối (bán kính trục = thickness · length). */
  thickness?: number;
  labels?: boolean;
  small?: boolean;
}

export interface OrbitalAxes {
  group: THREE.Group;
  labels: CSS2DObject[];
  setVisible(v: boolean): void;
  setLabelsVisible(v: boolean): void;
  dispose(): void;
}

/** Hệ trục x, y, z qua hạt nhân (đường liền hai phía, mũi tên ở đầu dương, nhãn chữ nghiêng như Hình 3.3). */
export function createOrbitalAxes(ctx: Pick<SimContext, 'labels'>, o: OrbitalAxesOptions = {}): OrbitalAxes {
  const L = o.length ?? 3;
  const frame = o.frame ?? BOOK_FRAME;
  const r = L * (o.thickness ?? 0.006);
  const colors = o.colors ?? [0xd8e2f0, 0xd8e2f0, 0xd8e2f0];
  const group = new THREE.Group();
  group.name = 'orbital-axes';
  const shaft = new THREE.CylinderGeometry(r, r, 2 * L, 10, 1, true);
  const tip = new THREE.ConeGeometry(r * 3.6, r * 12, 16);
  tip.translate(0, L + r * 6, 0);
  const mats: THREE.Material[] = [];
  const labels: CSS2DObject[] = [];
  (['x', 'y', 'z'] as const).forEach((axis, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: colors[i], transparent: true, opacity: 0.85, depthWrite: false });
    mats.push(mat);
    const arm = new THREE.Group();
    arm.add(new THREE.Mesh(shaft, mat), new THREE.Mesh(tip, mat));
    arm.children.forEach((m) => (m.renderOrder = 3));
    const d = new THREE.Vector3(...axisDir(frame, axis));
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    group.add(arm);
    if (o.labels !== false) {
      const anchor = new THREE.Object3D();
      anchor.position.copy(d).multiplyScalar(L + r * 22);
      group.add(anchor);
      const hex = new THREE.Color(colors[i]).getHexString();
      labels.push(
        ctx.labels.add(anchor, axis, {
          className: `orb-axis-label${o.small ? ' orb-axis-label--small' : ''}`,
          color: `#${hex}`,
        }),
      );
    }
  });
  return {
    group,
    labels,
    setVisible(v) {
      group.visible = v;
    },
    setLabelsVisible(v) {
      for (const l of labels) l.visible = v;
    },
    dispose() {
      shaft.dispose();
      tip.dispose();
      mats.forEach((m) => m.dispose());
      for (const l of labels) {
        l.element.remove();
        l.removeFromParent();
      }
      group.removeFromParent();
    },
  };
}
