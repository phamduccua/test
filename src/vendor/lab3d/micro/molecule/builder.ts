import * as THREE from 'three';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';
import { neighbors } from './analysis';
import { createBondView, orientBond, type BondView } from './bonds';
import { atomColor, atomRadius, BOND_ORDER_COLORS, KIT_STICK_COLOR, type MolStyle } from './style';
import type { MoleculeData } from './types';

export interface MoleculeOptions {
  style?: MolStyle;
  /** Đơn vị cảnh trên 1 Å (mặc định 0,3 → C–C 1,54 Å ≈ 4,6 cm như bộ mô hình thật). */
  scale?: number;
}

export interface MoleculeView {
  data: MoleculeData;
  group: THREE.Group;
  atoms: THREE.Mesh[];
  bonds: BondView[];
  /** Vị trí đích (toạ độ group) của từng nguyên tử. */
  targets: THREE.Vector3[];
  readonly style: MolStyle;
  scale: number;
  /** Đổi kiểu hiển thị; `animate` = co giãn bán kính mượt (cần gọi update). */
  setStyle(style: MolStyle, animate?: boolean): void;
  /** Tô màu que theo loại liên kết (đơn/đôi/ba). */
  highlightOrders(on: boolean): void;
  /** Cập nhật lại các que theo vị trí hiện tại của nguyên tử (khi nguyên tử đang di chuyển). */
  syncBonds(): void;
  update(dt: number): void;
}

/** Hướng lệch cho liên kết bội: nằm trong mặt phẳng tạo bởi liên kết và một láng giềng. */
function perpFor(nb: number[][], a: number, b: number, P: THREE.Vector3[]): THREE.Vector3 {
  const axis = P[b].clone().sub(P[a]).normalize();
  for (const [c, from] of [...nb[a].filter((k) => k !== b).map((k) => [k, a]), ...nb[b].filter((k) => k !== a).map((k) => [k, b])]) {
    const v = P[c].clone().sub(P[from]);
    v.addScaledVector(axis, -v.dot(axis));
    if (v.lengthSq() > 1e-4) return v.normalize();
  }
  const t = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  return t.addScaledVector(axis, -t.dot(axis)).normalize();
}

/** Dựng phân tử 3D: quả cầu nguyên tử (mesh riêng để lắp ráp/chọn) + que liên kết; đổi kiểu que – cầu / bộ lắp ráp / đặc. */
export function createMolecule(ctx: Tracker, data: MoleculeData, o: MoleculeOptions = {}): MoleculeView {
  const kit = microMaterials(ctx);
  const s = o.scale ?? 0.3;
  const group = new THREE.Group();
  group.name = `molecule-${data.id}`;
  const targets = data.atoms.map((a) => new THREE.Vector3(a.x, a.y, a.z).multiplyScalar(s));
  const atoms = data.atoms.map((a, i) => {
    const m = new THREE.Mesh(kit.sphere(), kit.atom(atomColor(a.el, 'ballStick')));
    m.name = `atom-${a.el}-${i}`;
    m.position.copy(targets[i]);
    m.castShadow = true;
    m.userData.atomIndex = i;
    group.add(m);
    return m;
  });
  const nb = neighbors(data);
  const bonds = data.bonds.map((b) => {
    const v = createBondView(ctx, b, targets[b.a], targets[b.b], perpFor(nb, b.a, b.b, targets), {
      scale: s,
      colorA: atomColor(data.atoms[b.a].el, 'ballStick'),
      colorB: atomColor(data.atoms[b.b].el, 'ballStick'),
      kitColor: KIT_STICK_COLOR,
    });
    for (const m of v.meshes) m.userData.baseMat = m.material;
    group.add(v.pivot);
    return v;
  });

  let style: MolStyle = o.style ?? 'kit';
  const radius = data.atoms.map(() => 0);
  const goal = data.atoms.map(() => 0);
  const apply = (st: MolStyle) => {
    data.atoms.forEach((a, i) => {
      atoms[i].material = kit.atom(atomColor(a.el, st));
      goal[i] = atomRadius(a.el, st) * s;
    });
    for (const b of bonds) {
      b.stick.visible = st === 'ballStick';
      b.kit.visible = st === 'kit';
    }
  };
  const view: MoleculeView = {
    data,
    group,
    atoms,
    bonds,
    targets,
    scale: s,
    get style() {
      return style;
    },
    setStyle(st, animate = true) {
      style = st;
      apply(st);
      if (!animate) goal.forEach((g, i) => (radius[i] = g));
      view.update(0);
    },
    highlightOrders(on) {
      for (const b of bonds)
        for (const m of b.meshes) m.material = on ? kit.stick(BOND_ORDER_COLORS[b.bond.order]) : (m.userData.baseMat as THREE.Material);
    },
    syncBonds() {
      for (const b of bonds) orientBond(b, atoms[b.bond.a].position, atoms[b.bond.b].position);
    },
    update(dt) {
      const k = dt > 0 ? 1 - Math.exp(-dt * 7) : 0;
      atoms.forEach((m, i) => {
        radius[i] += (goal[i] - radius[i]) * k;
        // userData.appear (0…1): hệ số xuất hiện do hoạt cảnh lắp ráp đặt.
        m.scale.setScalar(Math.max(1e-4, radius[i] * (m.userData.appear ?? 1)));
      });
    },
  };
  view.setStyle(style, false);
  return view;
}
