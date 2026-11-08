import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { element } from '../elements';
import { microMaterials } from '../materials';

export interface AtomBallOptions {
  /** 'vdw' = bán kính van der Waals (đặc), 'covalent' = bán kính cộng hoá trị, hoặc số (Å). */
  radius?: 'vdw' | 'covalent' | number;
  /** Đơn vị cảnh trên 1 Å (mặc định 0,3). */
  scale?: number;
  color?: THREE.ColorRepresentation;
}

/** Quả cầu nguyên tử CPK (nhựa bóng clearcoat), bán kính theo dữ liệu nguyên tố. */
export function createAtomBall(ctx: Tracker, el: string | number, o: AtomBallOptions = {}): THREE.Mesh {
  const info = element(el);
  const r = typeof o.radius === 'number' ? o.radius : o.radius === 'covalent' ? info.covalent : info.vdw;
  const mesh = new THREE.Mesh(microMaterials(ctx).sphere(), microMaterials(ctx).atom(o.color ?? info.color));
  mesh.scale.setScalar(r * (o.scale ?? 0.3));
  mesh.castShadow = true;
  mesh.name = `atom-${info.symbol}`;
  return mesh;
}
