import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';
import type { CrystalView } from './builder';
import { coordinationOf } from './lattice';

export interface CoordinationHighlight {
  group: THREE.Group;
  center: number;
  neighbors: number[];
  setVisible(v: boolean): void;
  update(dt: number, elapsed: number): void;
}

/**
 * Tô sáng số phối trí: ion trung tâm + các ion trái dấu gần nhất (NaCl: 6 → bát diện).
 * Các ion khác mờ tối và thu nhỏ; bát diện trong suốt + cạnh sáng (trụ mảnh) + vầng sáng ở tâm.
 */
export function createCoordinationHighlight(ctx: Tracker, view: CrystalView, center: number, color = 0xffd54a): CoordinationHighlight {
  const kit = microMaterials(ctx);
  const neighbors = coordinationOf(view.sites, center, view.preset.nearest);
  const group = new THREE.Group();
  group.name = 'coordination';
  const c = view.targets[center];
  const pts = neighbors.map((j) => view.targets[j]);
  const near = view.preset.nearest * view.scale * Math.SQRT2 * 1.05;
  const adj = (i: number, j: number) => pts[i].distanceTo(pts[j]) < near;

  const tri: number[] = [];
  const edges: [number, number][] = [];
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      if (adj(i, j)) edges.push([i, j]);
      for (let k = j + 1; k < pts.length; k++) if (adj(i, j) && adj(j, k) && adj(i, k)) tri.push(i, j, k);
    }
  const faceMat = ctx.track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  const fg = ctx.track(new THREE.BufferGeometry().setFromPoints(pts));
  fg.setIndex(tri);
  const faces = new THREE.Mesh(fg, faceMat);
  faces.renderOrder = 5;
  group.add(faces);

  // Cạnh bát diện + nan hoa tâm → đỉnh: trụ mảnh phát sáng.
  const lineMat = ctx.track(new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  const spokeMat = ctx.track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, toneMapped: false }));
  const segs: [THREE.Vector3, THREE.Vector3, number, THREE.Material][] = [
    ...edges.map(([i, j]) => [pts[i], pts[j], 0.018, lineMat] as [THREE.Vector3, THREE.Vector3, number, THREE.Material]),
    ...pts.map((p) => [c, p, 0.01, spokeMat] as [THREE.Vector3, THREE.Vector3, number, THREE.Material]),
  ];
  const up = new THREE.Vector3(0, 1, 0);
  for (const [a, b, r, m] of segs) {
    const cyl = new THREE.Mesh(kit.cylinder(), m);
    const d = b.clone().sub(a);
    cyl.position.copy(a);
    cyl.quaternion.setFromUnitVectors(up, d.clone().normalize());
    cyl.scale.set(r, d.length(), r);
    group.add(cyl);
  }
  const glow = new THREE.Sprite(kit.glow(color, 0.8));
  glow.position.copy(c);
  glow.scale.setScalar(view.preset.nearest * view.scale * 1.1);
  group.add(glow);
  group.visible = false;

  const keep = new Set([center, ...neighbors]);
  let goal = 0;
  let k = 0;
  const apply = () => {
    view.sites.forEach((_, i) => {
      const on = keep.has(i);
      view.setTint(i, on ? 1 : 1 - 0.65 * k);
      view.focus[i] = on ? 1 : 1 - 0.45 * k;
    });
    view.commit();
  };
  return {
    group,
    center,
    neighbors,
    setVisible(v) {
      goal = v ? 1 : 0;
      group.visible = v;
    },
    update(dt, elapsed) {
      if (Math.abs(goal - k) > 1e-3) {
        k += (goal - k) * (1 - Math.exp(-dt * 5));
        if (Math.abs(goal - k) <= 1e-3) k = goal;
        apply();
      }
      if (group.visible) faceMat.opacity = 0.14 + 0.06 * Math.sin(elapsed * 2.5);
    },
  };
}
