import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { SimContext } from '../../sim/types';

/**
 * Mặt bàn bảng tuần hoàn: tấm đế kính tối + ô kính mờ (InstancedMesh) + nhãn hàng/cột.
 * Mọi thứ dựng theo đơn vị "ô" rồi co giãn bằng `setCell(cell)` (chỉ x, z).
 */
export interface GridBase {
  group: THREE.Group;
  rowTags: Map<number, CSS2DObject>;
  colTags: Map<number, CSS2DObject>;
  setCell(cell: number): void;
  /** Tô sáng ô theo hàm (null = bình thường). */
  highlight(test: ((period: number, group: number) => boolean) | null): void;
  /** Độ mờ nhãn hàng/cột (vd. khi đang "sắp xếp" thì nhãn không còn đúng). */
  setHeaderOpacity(v: number): void;
}

const TILE = new THREE.Color(0x2a3a52);
const TILE_ON = new THREE.Color(0x3f6b9a);

export function createGridBase(
  ctx: Pick<SimContext, 'track' | 'labels'>,
  periods: readonly number[],
  groups: readonly number[],
  rowLabel: (p: number) => string,
  colLabel: (g: number) => string,
): GridBase {
  const nx = groups.length;
  const nz = periods.length;
  const group = new THREE.Group();
  group.name = 'periodic-base';
  const scaled = new THREE.Group();
  group.add(scaled);

  const slab = new THREE.Mesh(
    ctx.track(new RoundedBoxGeometry(nx + 0.5, 0.16, nz + 0.5, 3, 0.08)),
    ctx.track(new THREE.MeshPhysicalMaterial({ color: 0x0d1522, roughness: 0.18, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 })),
  );
  slab.position.y = -0.08;
  slab.receiveShadow = true;

  const tileMat = ctx.track(
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0, clearcoat: 0.6, transparent: true, opacity: 0.82 }),
  );
  const tiles = new THREE.InstancedMesh(ctx.track(new RoundedBoxGeometry(0.92, 0.05, 0.92, 2, 0.04)), tileMat, nx * nz);
  tiles.receiveShadow = true;
  const m = new THREE.Matrix4();
  const cells: { p: number; g: number }[] = [];
  periods.forEach((p, iz) =>
    groups.forEach((g, ix) => {
      m.makeTranslation(ix - (nx - 1) / 2, 0.025, iz - (nz - 1) / 2);
      tiles.setMatrixAt(cells.length, m);
      tiles.setColorAt(cells.length, TILE);
      cells.push({ p, g });
    }),
  );
  ctx.track(() => tiles.dispose());
  scaled.add(slab, tiles);

  const rowTags = new Map<number, CSS2DObject>();
  const colTags = new Map<number, CSS2DObject>();
  periods.forEach((p, iz) => {
    const a = new THREE.Object3D();
    a.position.set(-nx / 2 - 0.42, 0.05, iz - (nz - 1) / 2);
    scaled.add(a);
    rowTags.set(p, ctx.labels.add(a, rowLabel(p), { className: 'pt-head pt-head--row' }));
  });
  groups.forEach((g, ix) => {
    const a = new THREE.Object3D();
    a.position.set(ix - (nx - 1) / 2, 0.05, -nz / 2 - 0.22);
    scaled.add(a);
    colTags.set(g, ctx.labels.add(a, colLabel(g), { className: 'pt-head pt-head--col' }));
  });

  return {
    group,
    rowTags,
    colTags,
    setCell(cell) {
      scaled.scale.set(cell, 1, cell);
    },
    highlight(test) {
      cells.forEach((c, i) => tiles.setColorAt(i, test && test(c.p, c.g) ? TILE_ON : TILE));
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    },
    setHeaderOpacity(v) {
      for (const t of [...rowTags.values(), ...colTags.values()]) t.element.style.opacity = String(v);
    },
  };
}
