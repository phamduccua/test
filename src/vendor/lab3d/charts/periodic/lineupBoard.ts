import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { SimContext } from '../../sim/types';

const MAX_TICKS = 8;
const MAX_POINTS = 40;

export interface BoardFrame {
  /** Mép trái/phải và mặt phẳng z của bảng. */
  x0: number;
  x1: number;
  z: number;
  /** Đv cảnh trên một đơn vị giá trị (độ cao đỉnh mark = v·k). */
  k: number;
  ticks: readonly number[];
  /** Đỉnh các mark (đã sắp theo x) – vẽ đường nối như đồ thị. */
  tops: readonly THREE.Vector3[];
}

export interface LineupBoard {
  group: THREE.Group;
  title: CSS2DObject;
  update(f: BoardFrame): void;
  setVisible(v: boolean): void;
}

/** "Đồ thị phụ" sau hàng mark: bảng kính đứng có vạch chia giá trị + đường nối đỉnh các mark. */
export function createLineupBoard(ctx: Pick<SimContext, 'track' | 'labels'>, unit: string, color = 0xffd36b): LineupBoard {
  const group = new THREE.Group();
  group.name = 'lineup-board';
  const panel = new THREE.Mesh(
    ctx.track(new THREE.PlaneGeometry(1, 1)),
    ctx.track(new THREE.MeshBasicMaterial({ color: 0x18263a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })),
  );
  const tickGeo = ctx.track(new THREE.BufferGeometry());
  tickGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TICKS * 6), 3));
  const ticks = new THREE.LineSegments(tickGeo, ctx.track(new THREE.LineBasicMaterial({ color: 0x8fa6c4, transparent: true, opacity: 0.5 })));
  const curveGeo = ctx.track(new THREE.BufferGeometry());
  curveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
  const curve = new THREE.Line(curveGeo, ctx.track(new THREE.LineBasicMaterial({ color })));
  group.add(panel, ticks, curve);
  const tickTags: CSS2DObject[] = [];
  for (let i = 0; i < MAX_TICKS; i++) {
    const a = new THREE.Object3D();
    group.add(a);
    tickTags.push(ctx.labels.add(a, '', { className: 'pt-tick' }));
  }
  const titleAnchor = new THREE.Object3D();
  group.add(titleAnchor);
  const title = ctx.labels.add(titleAnchor, unit, { className: 'pt-tick pt-tick--title' });

  return {
    group,
    title,
    update(f) {
      const top = Math.max((f.ticks[f.ticks.length - 1] ?? 1) * f.k, ...f.tops.map((t) => t.y)) + 0.35;
      const w = f.x1 - f.x0 + 1.2;
      panel.scale.set(w, top, 1);
      panel.position.set((f.x0 + f.x1) / 2, top / 2, f.z);
      const tp = tickGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < MAX_TICKS; i++) {
        const v = f.ticks[i];
        const y = v === undefined ? -1 : v * f.k;
        tp.setXYZ(i * 2, f.x0 - 0.6, y, f.z + 0.01);
        tp.setXYZ(i * 2 + 1, f.x1 + 0.6, y, f.z + 0.01);
        const tag = tickTags[i];
        tag.visible = v !== undefined;
        tag.parent?.position.set(f.x0 - 0.85, y, f.z);
        if (v !== undefined) tag.element.textContent = String(v);
      }
      tp.needsUpdate = true;
      titleAnchor.position.set(f.x0 - 0.85, top + 0.25, f.z);
      const cp = curveGeo.getAttribute('position') as THREE.BufferAttribute;
      const n = Math.min(MAX_POINTS, f.tops.length);
      for (let i = 0; i < n; i++) cp.setXYZ(i, f.tops[i].x, f.tops[i].y, f.tops[i].z);
      cp.needsUpdate = true;
      curveGeo.setDrawRange(0, n);
      curveGeo.computeBoundingSphere();
    },
    setVisible(v) {
      group.visible = v;
    },
  };
}
