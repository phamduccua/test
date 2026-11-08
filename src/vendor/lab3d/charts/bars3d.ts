import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createPlasticMaterial, labMaterials, mm } from '../lab';
import type { SimContext } from '../sim/types';

export interface Bars3D {
  /** Gốc ở giữa đế; cột dựng theo +y, xếp theo +x. */
  group: THREE.Group;
  /** Đặt giá trị (null = chưa có số liệu → cột ẩn); cột cao dần mượt trong update. */
  setValues(values: (number | null)[]): void;
  setMax(max: number): void;
  setCategories(names: string[]): void;
  update(dt: number): void;
}

/**
 * Biểu đồ cột 3D đặt trên bàn (vd. 1/t theo nồng độ): đế, trục, cột nhựa bóng, nhãn tên dưới chân + giá trị trên đỉnh.
 */
export function createBars3d(
  ctx: SimContext,
  o: {
    categories: string[];
    colors: THREE.ColorRepresentation[];
    height?: number;
    barWidth?: number;
    gap?: number;
    max?: number;
    title?: string;
    format?(v: number): string;
  },
): Bars3D {
  const H = o.height ?? mm(140);
  const bw = o.barWidth ?? mm(26);
  const gap = o.gap ?? mm(16);
  const n = o.categories.length;
  const W = n * bw + (n + 1) * gap;
  const fmt = o.format ?? ((v: number) => v.toFixed(3).replace('.', ','));
  const group = new THREE.Group();
  group.name = 'bars3d';
  const mats = labMaterials(ctx);
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, mm(8), bw + gap * 2, 2, mm(2)), mats.darkPlastic());
  base.position.y = mm(4);
  base.receiveShadow = base.castShadow = true;
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H + mm(14), mm(3)), ctx.track(createPlasticMaterial(0xf4f6f8, 0.6)));
  back.position.set(0, mm(8) + (H + mm(14)) / 2, -(bw / 2 + gap * 0.8));
  back.receiveShadow = true;
  group.add(base, back);
  // Vạch lưới ngang trên tấm nền.
  const lineMat = ctx.track(new THREE.MeshBasicMaterial({ color: 0xb8c2cc }));
  for (let i = 1; i <= 4; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(W - mm(6), mm(0.6), mm(0.5)), lineMat);
    l.position.set(0, mm(8) + (H * i) / 4, back.position.z + mm(1.8));
    group.add(l);
  }
  if (o.title) {
    const t = new THREE.Object3D();
    t.position.set(0, mm(8) + H + mm(24), back.position.z);
    group.add(t);
    ctx.labels.add(t, o.title, { variant: 'small' });
  }
  let max = o.max ?? 1;
  const bars = o.categories.map((cat, i) => {
    const mat = ctx.track(
      new THREE.MeshPhysicalMaterial({ color: o.colors[i % o.colors.length], roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 }),
    );
    const geo = new RoundedBoxGeometry(bw, 1, bw, 2, mm(2));
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.Mesh(geo, mat);
    const x = -W / 2 + gap + bw / 2 + i * (bw + gap);
    mesh.position.set(x, mm(8), 0);
    mesh.scale.y = 1e-3;
    mesh.castShadow = true;
    const foot = new THREE.Object3D();
    foot.position.set(x, 0, bw / 2 + gap * 0.9);
    const top = new THREE.Object3D();
    group.add(mesh, foot, top);
    const catLabel = ctx.labels.add(foot, cat, { variant: 'small' });
    const valLabel = ctx.labels.add(top, '', { variant: 'small' });
    return { mesh, top, catLabel, valLabel, value: null as number | null, shown: 0 };
  });
  return {
    group,
    setValues(values) {
      values.forEach((v, i) => bars[i] && (bars[i].value = v));
    },
    setCategories(names) {
      names.forEach((n, i) => bars[i] && (bars[i].catLabel.element.textContent = n));
    },
    setMax(m) {
      max = Math.max(1e-9, m);
    },
    update(dt) {
      for (const b of bars) {
        const target = b.value === null ? 0 : (Math.min(b.value, max) / max) * H;
        b.shown += (target - b.shown) * Math.min(1, dt * 4);
        b.mesh.scale.y = Math.max(1e-3, b.shown);
        b.mesh.visible = b.shown > mm(0.5);
        b.top.position.set(b.mesh.position.x, mm(8) + b.shown + mm(10), 0);
        b.valLabel.visible = b.value !== null;
        const txt = b.value === null ? '' : fmt(b.value);
        if (b.valLabel.element.textContent !== txt) b.valLabel.element.textContent = txt;
      }
    },
  };
}
