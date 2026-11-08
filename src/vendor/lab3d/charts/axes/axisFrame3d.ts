import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { SimContext } from '../../sim/types';
import './axes.css';

export interface AxisFrameOptions {
  /** Mép trái/phải của vùng đồ thị (đv cảnh); trục tung đặt ở x0. */
  x0: number;
  x1: number;
  /** Mặt phẳng bảng nền (sau các cột) và mép trước của tấm đế. */
  z: number;
  zFront: number;
  /** Vạch trục hoành (vị trí cảnh + nhãn). */
  xTicks: readonly { x: number; label: string }[];
  /** Giá trị vạch trục tung. */
  yTicks: readonly number[];
  /** Đv cảnh trên một đơn vị giá trị. */
  k: number;
  xTitle?: string;
  yTitle?: string;
  format?(v: number): string;
}

export interface AxisFrame {
  group: THREE.Group;
  setK(k: number): void;
  /** 0…1: mờ dần cả khung (khi chuyển bố cục). */
  setOpacity(v: number): void;
}

/** Khung đồ thị 3D: tấm đế, bảng nền đứng, lưới ngang theo vạch tung, trục tung + nhãn vạch, nhãn trục hoành. */
export function createAxisFrame3d(ctx: Pick<SimContext, 'track' | 'labels'>, o: AxisFrameOptions): AxisFrame {
  const fmt = o.format ?? ((v: number) => String(v));
  const group = new THREE.Group();
  group.name = 'axis-frame';
  const w = o.x1 - o.x0;
  const depth = o.zFront - o.z + 0.3;
  const slabMat = ctx.track(
    new THREE.MeshPhysicalMaterial({ color: 0x0d1522, roughness: 0.2, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true }),
  );
  const slab = new THREE.Mesh(ctx.track(new RoundedBoxGeometry(w + 0.9, 0.14, depth, 3, 0.06)), slabMat);
  slab.position.set((o.x0 + o.x1) / 2, -0.07, o.z - 0.3 + depth / 2);
  slab.receiveShadow = true;
  const boardMat = ctx.track(
    new THREE.MeshBasicMaterial({ color: 0x16243a, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
  );
  const board = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(1, 1)), boardMat);
  const gridMat = ctx.track(new THREE.LineBasicMaterial({ color: 0x7f97b8, transparent: true, opacity: 0.45 }));
  const gridGeo = ctx.track(new THREE.BufferGeometry());
  gridGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(o.yTicks.length * 6 + 6), 3));
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  const axisMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0xdfe7f2, roughness: 0.4, metalness: 0.3, transparent: true }));
  const yAxis = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.025, 0.025, 1, 10).translate(0, 0.5, 0)), axisMat);
  const yHead = new THREE.Mesh(ctx.track(new THREE.ConeGeometry(0.075, 0.24, 16)), axisMat);
  const xAxis = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.025, 0.025, w + 0.5, 10).rotateZ(-Math.PI / 2)), axisMat);
  const xHead = new THREE.Mesh(ctx.track(new THREE.ConeGeometry(0.075, 0.24, 16).rotateZ(-Math.PI / 2)), axisMat);
  xAxis.position.set((o.x0 + o.x1) / 2 + 0.25, 0.02, o.z + 0.02);
  xHead.position.set(o.x1 + 0.6, 0.02, o.z + 0.02);
  group.add(slab, board, grid, yAxis, yHead, xAxis, xHead);

  const tags: CSS2DObject[] = [];
  const add = (pos: THREE.Vector3Tuple, text: string, cls: string) => {
    const a = new THREE.Object3D();
    a.position.set(...pos);
    group.add(a);
    const t = ctx.labels.add(a, text, { className: cls });
    tags.push(t);
    return a;
  };
  const yAnchors = o.yTicks.map((v) => add([o.x0 - 0.35, 0, o.z], fmt(v), 'ax-tick ax-tick--y'));
  add([o.x0 - 0.35, 0, o.z], '0', 'ax-tick ax-tick--y');
  for (const t of o.xTicks) add([t.x, 0.02, o.zFront - 0.12], t.label, 'ax-tick ax-tick--x');
  if (o.xTitle) add([(o.x0 + o.x1) / 2, 0, o.zFront + 0.95], o.xTitle, 'ax-title');
  const yTitle = o.yTitle ? add([o.x0 - 1.05, 0, o.z], '', 'ax-title ax-title--v') : null;
  if (yTitle && o.yTitle) {
    const span = document.createElement('span');
    span.textContent = o.yTitle;
    tags[tags.length - 1].element.appendChild(span);
  }

  const setK = (k: number) => {
    const top = (o.yTicks[o.yTicks.length - 1] ?? 1) * k;
    board.scale.set(w + 0.5, top + 0.5, 1);
    board.position.set((o.x0 + o.x1) / 2 + 0.25, (top + 0.5) / 2, o.z - 0.01);
    yAxis.scale.y = top + 0.35;
    yAxis.position.set(o.x0, 0, o.z + 0.02);
    yHead.position.set(o.x0, top + 0.47, o.z + 0.02);
    const p = gridGeo.getAttribute('position') as THREE.BufferAttribute;
    o.yTicks.forEach((v, i) => {
      p.setXYZ(i * 2, o.x0, v * k, o.z);
      p.setXYZ(i * 2 + 1, o.x1 + 0.25, v * k, o.z);
      yAnchors[i].position.y = v * k;
    });
    p.needsUpdate = true;
    gridGeo.computeBoundingSphere();
    if (yTitle) yTitle.position.y = top / 2;
  };
  setK(o.k);

  let last = 1;
  return {
    group,
    setK,
    setOpacity(v) {
      if (Math.abs(v - last) < 1e-3) return;
      last = v;
      group.visible = v > 0.01;
      slabMat.opacity = v;
      slabMat.depthWrite = v > 0.9;
      boardMat.opacity = 0.6 * v;
      gridMat.opacity = 0.45 * v;
      axisMat.opacity = v;
      for (const t of tags) t.element.style.opacity = String(v);
    },
  };
}
