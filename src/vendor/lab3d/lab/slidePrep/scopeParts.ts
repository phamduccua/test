import * as THREE from 'three';
import type { Microscope } from '../microscopy/microscope';
import type { Tracker } from '../types';
import { labText } from '../../text';

/** Bộ phận vặn được của `createMicroscope` (kit chưa trả ra – tìm theo dáng mesh, như TN-071-01 / TN-109-01). */
export interface ScopeParts {
  /** Mâm vật kính (Group, trục đứng). */
  turret: THREE.Object3D;
  /** Ốc to / ốc nhỏ bên trái (x < 0 của kính) – chỗ tay vặn; `coarseAll` / `fineAll` = cả hai bên. */
  coarse: THREE.Object3D;
  fine: THREE.Object3D;
  coarseAll: THREE.Object3D[];
  fineAll: THREE.Object3D[];
  /** Đèn ở đế (toạ độ của kính) – chỗ đặt lam sai hay gặp. */
  lamp: THREE.Vector3;
  /** Quay vòng ốc theo phần mỗi ốc đã dời (µm) / µm mỗi vòng. */
  spin(coarseTurns: number, fineTurns: number): void;
}

const cyl = (o: THREE.Object3D, r: number) => {
  const g = (o as THREE.Mesh).geometry as THREE.CylinderGeometry | undefined;
  return g?.type === 'CylinderGeometry' && Math.abs(g.parameters.radiusTop - r) < 1e-4;
};

/** Tìm mâm + ốc của kính hiển vi kit, gắn vạch trắng lên vành ốc (thấy được đang vặn). */
export function findScopeParts(ctx: Tracker, scope: Microscope): ScopeParts {
  const turret = scope.group.children.find((o) => o.type === 'Group' && Math.abs(o.position.y - 2.42) < 0.01);
  const coarseAll = scope.group.children.filter((o) => cyl(o, 0.19));
  const fineAll = scope.group.children.filter((o) => cyl(o, 0.11));
  if (!turret || coarseAll.length < 1 || fineAll.length < 1) throw new Error(labText('t_5b21de775b59'));
  const left = (list: THREE.Object3D[]) => list.reduce((a, k) => (k.position.x < a.position.x ? k : a));
  const mark = ctx.track(new THREE.MeshBasicMaterial({ color: '#f4f4f4' }));
  const tick = (k: THREE.Object3D, r: number) => {
    const m = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(0.03, r * 0.42, 0.02)), mark);
    m.position.set(0, 0, r);
    k.add(m);
  };
  coarseAll.forEach((k) => tick(k, 0.19));
  fineAll.forEach((k) => tick(k, 0.11));
  const base = new Map([...coarseAll, ...fineAll].map((k) => [k, k.rotation.x]));
  return {
    turret,
    coarse: left(coarseAll),
    fine: left(fineAll),
    coarseAll,
    fineAll,
    lamp: new THREE.Vector3(0, 0.3, 0.25),
    spin(ct, ft) {
      const set = (k: THREE.Object3D, turns: number) => (k.rotation.x = base.get(k)! + turns * Math.PI * 2 * Math.sign(k.position.x || 1));
      coarseAll.forEach((k) => set(k, ct));
      fineAll.forEach((k) => set(k, ft));
    },
  };
}
