import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { lathe, P, shadowed, type Accent } from './common';

export interface PlateOptions {
  /** Ø ngoài × cao (mm). Mặc định 110 × 12 (đĩa sứ nhỏ). */
  diameter?: number;
  height?: number;
  /** 'ceramic' (mặc định, ngà viền màu), 'glass' (đĩa kính dày), 'plastic' (nhựa màu `color`). */
  material?: 'ceramic' | 'glass' | 'plastic';
  /** Màu viền (sứ) / thân (nhựa). Mặc định 'blue'; `rim: false` bỏ viền. */
  color?: Accent;
  rim?: boolean;
}

export interface Plate {
  group: THREE.Group;
  /** Mặt lòng đĩa (đặt vật lên). */
  topY: number;
  /** Bán kính lòng đĩa phẳng. */
  radius: number;
}

/** A-DIA-SU – đĩa sứ/kính/nhựa nông có chân, lòng phẳng, viền màu. Gốc ở tâm đáy. */
export function createPlate(ctx: Tracker, o: PlateOptions = {}): Plate {
  const mats = labMaterials(ctx);
  const R = (o.diameter ?? 110) / 2;
  const H = o.height ?? 12;
  const kind = o.material ?? 'ceramic';
  const mat = kind === 'glass' ? mats.thickGlass() : kind === 'plastic' ? mats.plastic(o.color ?? 'blue') : mats.ceramic();
  const floor = H * 0.42;
  const pts = [P(0, floor - 2.5), P(R * 0.62, floor - 2.5), P(R * 0.6, 0), P(R * 0.66, 0), P(R * 0.74, floor - 2), P(R, H), P(R - 2.5, H), P(R * 0.74, floor), P(0, floor)];
  const group = new THREE.Group();
  group.name = 'plate';
  const body = lathe(ctx, pts, mat, 64);
  if (kind === 'glass') body.castShadow = false;
  group.add(body);
  if (kind === 'ceramic' && o.rim !== false) {
    const rim = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(R - 1.2), mm(1.4), 6, 64)), mats.plastic(o.color ?? 'blue'));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = mm(H - 0.4);
    // Chỉ xanh quanh lòng đĩa (như đĩa sứ Việt) – đĩa sáng không chìm vào mặt bàn trắng.
    const line = new THREE.Mesh(ctx.track(new THREE.RingGeometry(mm(R * 0.72), mm(R * 0.72 + 1.6), 64)), rim.material);
    line.rotation.x = -Math.PI / 2;
    line.position.y = mm(floor + 0.15);
    group.add(rim, line);
  }
  return { group, topY: mm(floor), radius: mm(R * 0.72) };
}

export interface SpotPlateOptions {
  /** Số giếng theo x × z (mặc định 3 × 1, đĩa sứ 3 giếng 100 × 36 mm). */
  cols?: number;
  rows?: number;
  /** Ø giếng, khoảng cách tâm, sâu (mm). */
  well?: number;
  pitch?: number;
  depth?: number;
  /** Màu dung dịch ban đầu trong giếng (không đặt = giếng rỗng). */
  liquid?: THREE.ColorRepresentation;
  /** Màu số thứ tự / viền (mặc định 'blue'). */
  color?: Accent;
}

export interface SpotPlate {
  group: THREE.Group;
  /** Tâm mặt dung dịch từng giếng (cục bộ group). */
  wells: THREE.Vector3[];
  /** Đổ dung dịch vào giếng i: màu + độ đầy 0…1 (0 = rỗng); `opacity` 0…1. */
  setWell(i: number, color: THREE.ColorRepresentation | null, fill?: number, opacity?: number): void;
}

/** A-DIA-GIENG – đĩa sứ nhiều giếng (đĩa thử màu): khối sứ ngà + giếng chỏm cầu + vạch màu dưới mỗi giếng. Gốc ở giữa đáy. */
export function createSpotPlate(ctx: Tracker, o: SpotPlateOptions = {}): SpotPlate {
  const mats = labMaterials(ctx);
  const cols = o.cols ?? 3;
  const rows = o.rows ?? 1;
  const r = mm((o.well ?? 26) / 2);
  const pitch = mm(o.pitch ?? 32);
  const depth = mm(o.depth ?? 8);
  const H = mm(12);
  const W = cols * pitch + mm(4);
  const D = rows * pitch + mm(4);
  const group = new THREE.Group();
  group.name = 'spot-plate';
  const shape = new THREE.Shape();
  const c = mm(6);
  shape.moveTo(-W / 2 + c, -D / 2);
  shape.lineTo(W / 2 - c, -D / 2).quadraticCurveTo(W / 2, -D / 2, W / 2, -D / 2 + c);
  shape.lineTo(W / 2, D / 2 - c).quadraticCurveTo(W / 2, D / 2, W / 2 - c, D / 2);
  shape.lineTo(-W / 2 + c, D / 2).quadraticCurveTo(-W / 2, D / 2, -W / 2, D / 2 - c);
  shape.lineTo(-W / 2, -D / 2 + c).quadraticCurveTo(-W / 2, -D / 2, -W / 2 + c, -D / 2);
  const centers: THREE.Vector2[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) centers.push(new THREE.Vector2((i - (cols - 1) / 2) * pitch, (j - (rows - 1) / 2) * pitch));
  for (const p of centers) {
    const hole = new THREE.Path();
    hole.absarc(p.x, p.y, r, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const slab = shadowed(new THREE.Mesh(ctx.track(new THREE.ExtrudeGeometry(shape, { depth: H - mm(2), bevelEnabled: true, bevelSize: mm(1), bevelThickness: mm(1), bevelSegments: 2, curveSegments: 40 })), mats.ceramic()));
  slab.rotation.x = -Math.PI / 2;
  slab.position.y = mm(1);
  // Đế mỏng tối viền quanh khối sứ – tách đĩa giếng khỏi mặt bàn sáng.
  const foot = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(W + mm(3), mm(2), D + mm(3))), mats.trim());
  foot.position.y = mm(1);
  group.add(slab, foot);
  // Lòng giếng: chỏm cầu lõm, mép trùng lỗ trên mặt đĩa (mặt trong = BackSide của chỏm lồi).
  const bowl: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2);
    bowl.push(new THREE.Vector2(Math.sin(a) * r, H - depth * Math.cos(a)));
  }
  const bowlGeo = ctx.track(new THREE.LatheGeometry(bowl, 40));
  const inside = ctx.track(mats.ceramic().clone());
  inside.side = THREE.DoubleSide;
  // Gạch màu nhỏ phía trước mỗi giếng (số giếng in men) – phần màu đậm để nhận ra đĩa trên bàn sáng.
  const tickGeo = ctx.track(new THREE.BoxGeometry(mm(8), mm(0.6), mm(2.2)));
  const surfGeo = ctx.track(new THREE.CircleGeometry(1, 40));
  const liquids: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
  const wells = centers.map((p) => {
    const b = new THREE.Mesh(bowlGeo, inside);
    b.position.set(p.x, 0, -p.y);
    b.receiveShadow = true;
    group.add(b);
    const tick = new THREE.Mesh(tickGeo, mats.plastic(o.color ?? 'blue'));
    tick.position.set(p.x, H + mm(0.2), -p.y + r + mm(1.6));
    group.add(tick);
    const mat = ctx.track(new THREE.MeshStandardMaterial({ color: o.liquid ?? '#e3d28e', roughness: 0.05, transparent: true, opacity: 0.6 }));
    const mesh = new THREE.Mesh(surfGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    group.add(mesh);
    liquids.push({ mesh, mat });
    return new THREE.Vector3(p.x, H - mm(3), -p.y);
  });
  const api: SpotPlate = {
    group,
    wells,
    setWell(i, color, fill = 0.6, opacity = 0.6) {
      const l = liquids[i];
      l.mesh.visible = color !== null && fill > 0;
      if (color === null) return;
      l.mat.color.set(color);
      l.mat.opacity = opacity;
      // Mặt dung dịch ở độ sâu theo `fill`; bán kính theo chỏm cầu tại độ cao đó.
      const h = depth * Math.min(1, fill);
      const y = H - depth + h;
      const k = 1 - h / depth;
      l.mesh.position.set(wells[i].x, y, wells[i].z);
      l.mesh.scale.setScalar(Math.max(mm(1), r * Math.sqrt(Math.max(0, 1 - k * k)) * 0.98));
      wells[i].y = y;
    },
  };
  centers.forEach((_, i) => api.setWell(i, o.liquid ?? null));
  return api;
}
