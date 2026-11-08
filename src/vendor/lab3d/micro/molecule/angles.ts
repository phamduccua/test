import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { representativeAngles } from './analysis';
import type { MoleculeView } from './builder';

export interface AngleMarkers {
  group: THREE.Group;
  setVisible(v: boolean): void;
}

const fmt = (deg: number) => `${(Math.round(deg * 10) / 10).toString().replace('.', ',')}°`;

/** Cung + nhãn góc liên kết tiêu biểu (vd. 109,5° của CH₄) tại các nguyên tử trung tâm. */
export function createAngleMarkers(ctx: Pick<SimContext, 'track' | 'labels'>, mol: MoleculeView, color = 0xffd166): AngleMarkers {
  const group = new THREE.Group();
  group.name = 'bond-angles';
  const mat = ctx.track(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false }));
  const r = 0.62 * mol.scale;
  for (const ang of representativeAngles(mol.data)) {
    const c = mol.targets[ang.center];
    const u = mol.targets[ang.a].clone().sub(c).normalize();
    const v = mol.targets[ang.b].clone().sub(c).normalize();
    const pts: THREE.Vector3[] = [];
    const axis = new THREE.Vector3().crossVectors(u, v);
    if (axis.lengthSq() < 1e-6) axis.set(u.y, -u.x, u.z === 0 ? 1 : 0).normalize();
    else axis.normalize();
    const total = u.angleTo(v);
    for (let i = 0; i <= 32; i++) pts.push(u.clone().applyAxisAngle(axis, (total * i) / 32).multiplyScalar(r).add(c));
    const line = new THREE.Line(ctx.track(new THREE.BufferGeometry().setFromPoints(pts)), mat);
    line.renderOrder = 10;
    group.add(line);
    const anchor = new THREE.Object3D();
    anchor.position.copy(u.clone().applyAxisAngle(axis, total / 2).multiplyScalar(r * 1.55).add(c));
    group.add(anchor);
    ctx.labels.add(anchor, fmt(ang.deg), { variant: 'small', color: '#ffd166' });
  }
  group.visible = false;
  return {
    group,
    setVisible(v) {
      group.visible = v;
    },
  };
}
