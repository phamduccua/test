import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';
import type { MolBond } from './types';

/** Một liên kết: pivot đặt ở nguyên tử a, trục +Y cục bộ hướng tới b, +X cục bộ nằm trong mặt phẳng phân tử. */
export interface BondView {
  bond: MolBond;
  pivot: THREE.Group;
  /** Que – cầu chuẩn: trụ chia đôi màu theo nguyên tử, liên kết bội = trụ song song. */
  stick: THREE.Group;
  /** Bộ lắp ráp (Hình 12.8): que xám, liên kết bội = que dẻo cong. */
  kit: THREE.Group;
  /** Các mesh để tô màu theo loại liên kết. */
  meshes: THREE.Mesh[];
  /** Độ dài lúc dựng (đơn vị cảnh). */
  length0: number;
  /** Hướng lệch trong mặt phẳng (đơn vị, toạ độ phân tử). */
  perp: THREE.Vector3;
  /** 0…1: que "mọc" từ a sang b. */
  grow: number;
}

export interface BondBuildOptions {
  /** Đơn vị cảnh / Å. */
  scale: number;
  colorA: THREE.ColorRepresentation;
  colorB: THREE.ColorRepresentation;
  kitColor: THREE.ColorRepresentation;
}

const Y = new THREE.Vector3();
const X = new THREE.Vector3();
const Zv = new THREE.Vector3();
const M = new THREE.Matrix4();

/** Đặt pivot theo vị trí hiện tại của hai nguyên tử. */
export function orientBond(v: BondView, A: THREE.Vector3, B: THREE.Vector3): void {
  Y.subVectors(B, A);
  const len = Y.length();
  if (len < 1e-6) {
    v.pivot.scale.set(1, 1e-4, 1);
    return;
  }
  Y.divideScalar(len);
  X.copy(v.perp).addScaledVector(Y, -v.perp.dot(Y));
  if (X.lengthSq() < 1e-6) {
    X.set(Y.y, -Y.x, 0);
    if (X.lengthSq() < 1e-6) X.set(1, 0, 0);
  }
  X.normalize();
  Zv.crossVectors(X, Y);
  M.makeBasis(X, Y, Zv);
  v.pivot.quaternion.setFromRotationMatrix(M);
  v.pivot.position.copy(A);
  v.pivot.scale.set(1, Math.max(1e-4, (len / v.length0) * v.grow), 1);
}

function cyl(ctx: Tracker, mat: THREE.Material, r: number, y0: number, h: number, x = 0): THREE.Mesh {
  const m = new THREE.Mesh(microMaterials(ctx).cylinder(), mat);
  m.scale.set(r, h, r);
  m.position.set(x, y0, 0);
  m.castShadow = true;
  return m;
}

/** Que dẻo cong (bezier bậc 2) từ (0,0,0) tới (0,L,0), phồng ra theo hướng `dir` trong mặt XZ cục bộ. */
function arc(ctx: Tracker, mat: THREE.Material, L: number, bulge: number, angle: number, r: number): THREE.Mesh {
  const dx = Math.cos(angle) * bulge * 2;
  const dz = Math.sin(angle) * bulge * 2;
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(dx, L / 2, dz), new THREE.Vector3(0, L, 0));
  const m = new THREE.Mesh(ctx.track(new THREE.TubeGeometry(curve, 28, r, 10, false)), mat);
  m.castShadow = true;
  return m;
}

export function createBondView(ctx: Tracker, bond: MolBond, A: THREE.Vector3, B: THREE.Vector3, perp: THREE.Vector3, o: BondBuildOptions): BondView {
  const kitM = microMaterials(ctx);
  const L = A.distanceTo(B);
  const s = o.scale;
  const pivot = new THREE.Group();
  pivot.name = `bond-${bond.a}-${bond.b}`;
  const stick = new THREE.Group();
  const kit = new THREE.Group();
  pivot.add(stick, kit);
  const meshes: THREE.Mesh[] = [];
  const ma = kitM.stick(o.colorA);
  const mb = kitM.stick(o.colorB);

  // Que – cầu: n trụ song song, mỗi trụ chia đôi màu.
  const n = bond.order;
  const r = (n === 1 ? 0.1 : n === 2 ? 0.07 : 0.06) * s;
  const gap = (n === 2 ? 0.17 : 0.2) * s;
  for (let k = 0; k < n; k++) {
    const x = (k - (n - 1) / 2) * gap;
    const h1 = cyl(ctx, ma, r, 0, L / 2, x);
    const h2 = cyl(ctx, mb, r, L / 2, L / 2, x);
    stick.add(h1, h2);
    meshes.push(h1, h2);
  }

  // Bộ lắp ráp: đơn = que thẳng; đôi = 2 que cong trên/dưới mặt phẳng; ba = 3 que cong cách 120°.
  const kmat = kitM.stick(o.kitColor);
  if (n === 1) {
    const c = cyl(ctx, kmat, 0.085 * s, 0, L);
    kit.add(c);
    meshes.push(c);
  } else {
    const bulge = (n === 2 ? 0.3 : 0.34) * s;
    for (let k = 0; k < n; k++) {
      const ang = n === 2 ? Math.PI / 2 + k * Math.PI : Math.PI / 2 + (k * 2 * Math.PI) / 3;
      const a = arc(ctx, kmat, L, bulge, ang, 0.06 * s);
      kit.add(a);
      meshes.push(a);
    }
  }
  const view: BondView = { bond, pivot, stick, kit, meshes, length0: L, perp: perp.clone().normalize(), grow: 1 };
  orientBond(view, A, B);
  return view;
}
