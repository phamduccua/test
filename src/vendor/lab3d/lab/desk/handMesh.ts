import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Tracker } from '../types';
import type { handMaterial } from './handMaterial';
import { FINGERS, PALM_HALF, THUMB, type FingerSpec } from './handSolve';

export interface Chain {
  root: THREE.Object3D;
  joints: THREE.Object3D[];
}

/**
 * Dựng hình bàn tay (mm, khung tay phải – xem handSolve): lòng bàn tay, gò ngón cái, 4 ngón + ngón cái (mỗi ngón 3 khớp lồng nhau),
 * cẳng tay (cổ găng, tay áo). Trả về các khớp để quay theo tư thế.
 */
export function buildHandMesh(ctx: Tracker, body: THREE.Object3D, mat: ReturnType<typeof handMaterial>, o: { arm?: number; sleeve?: string | false }) {
  const mesh = (geo: THREE.BufferGeometry, parent: THREE.Object3D, m: THREE.Material = mat.hand) => {
    const x = new THREE.Mesh(ctx.track(geo), m);
    x.castShadow = true;
    parent.add(x);
    return x;
  };
  // Lòng bàn tay: hộp bo tròn thu hẹp về cổ tay, mu tay hơi khum.
  const palm = new RoundedBoxGeometry(80, 96, PALM_HALF * 2, 6, PALM_HALF - 0.5);
  const pos = palm.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = (y + 48) / 96;
    pos.setX(i, pos.getX(i) * (0.74 + 0.26 * Math.sqrt(Math.max(0, k))));
    if (pos.getZ(i) > 0) pos.setZ(i, pos.getZ(i) * (1 + 0.25 * Math.cos((pos.getX(i) / 40) * 1.2)));
  }
  palm.translate(0, 50, 0);
  palm.computeVertexNormals();
  mesh(palm, body);
  // Gò ngón cái.
  const thenar = mesh(new THREE.SphereGeometry(1, 20, 14), body);
  thenar.scale.set(15, 30, 12);
  thenar.position.set(-20, 30, -5);
  thenar.rotation.z = 0.35;
  const capsule = (f: FingerSpec, i: number) => {
    const r = f === THUMB && i === 0 ? 13 : f.radius * (1 - i * 0.06);
    const L = f.len[i];
    return new THREE.CapsuleGeometry(r, Math.max(0.1, L - r * (i === 2 ? 1 : 0.6)), 6, 14).translate(0, (L - r * (i === 2 ? 1 : 0.6)) / 2 + (i === 2 ? r * 0.15 : r * 0.3), 0);
  };
  const chain = (f: FingerSpec): Chain => {
    const root = new THREE.Group();
    root.position.set(...f.base);
    body.add(root);
    const joints: THREE.Object3D[] = [];
    let parent: THREE.Object3D = root;
    for (let i = 0; i < 3; i++) {
      const j = new THREE.Group();
      if (i) j.position.y = f.len[i - 1];
      parent.add(j);
      mesh(capsule(f, i), j);
      joints.push(j);
      parent = j;
    }
    return { root, joints };
  };
  const fingers = FINGERS.map(chain);
  const thumb = chain(THUMB);
  // Cẳng tay (+ cổ găng, tay áo) – nhóm riêng quay quanh cổ tay.
  const forearm = new THREE.Group();
  forearm.position.y = 6;
  body.add(forearm);
  const armLen = o.arm ?? 110;
  if (armLen > 0) {
    mesh(new THREE.CylinderGeometry(25, 30, armLen, 20, 1, false).translate(0, -armLen / 2, 0), forearm).scale.set(1, 1, 0.72);
    mesh(new THREE.SphereGeometry(25, 20, 12), forearm).scale.set(1, 0.5, 0.72);
    if (mat.cuff) {
      const cuff = mesh(new THREE.TorusGeometry(28.5, 3.2, 8, 28).rotateX(Math.PI / 2), forearm, mat.cuff);
      cuff.position.y = -Math.min(armLen * 0.6, 70);
      cuff.scale.z = 0.74;
    }
    if (o.sleeve) {
      const cloth = mesh(new THREE.CylinderGeometry(36, 40, armLen * 0.7, 22, 1, true), forearm, mat.sleeve(o.sleeve));
      cloth.position.y = -armLen * 0.65 - 10;
      cloth.scale.z = 0.8;
    }
  }
  return { fingers, thumb, forearm };
}
