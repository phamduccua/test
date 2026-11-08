import * as THREE from 'three';
import { createMetalMaterial } from '../materials/factories';
import type { Tracker } from '../types';

/** Đồ trên bàn làm việc thế kỉ 19 (đơn vị dm, gốc ở tâm đáy): đèn dầu, lọ mực + bút lông ngỗng, chồng sách cổ. */

const lathe = (pts: [number, number][], seg = 36) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

export interface OilLamp {
  group: THREE.Group;
  /** Tâm ngọn lửa (toạ độ group) – đặt đèn điểm / hướng gương. */
  flame: THREE.Vector3;
  light: THREE.PointLight;
  update(dt: number, elapsed: number): void;
}

/** Đèn dầu ≈ 42 cm: đế + bầu dầu đồng, bấc trong ống khói thuỷ tinh (vật liệu đục, sáng nhẹ), ngọn lửa lung linh + đèn điểm ấm. */
export function createOilLamp(ctx: Tracker): OilLamp {
  const brass = ctx.track(createMetalMaterial('#b8893e', 0.3, 1));
  const g = new THREE.Group();
  g.name = 'oil-lamp';
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0) => {
    const m = new THREE.Mesh(ctx.track(geo), mat);
    m.position.y = y;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  mesh(lathe([[0, 0], [0.42, 0], [0.42, 0.05], [0.3, 0.09], [0.12, 0.2], [0.09, 0.62], [0.16, 0.7]]), brass);
  mesh(lathe([[0.16, 0.7], [0.36, 0.82], [0.4, 0.98], [0.3, 1.12], [0.14, 1.18], [0.14, 1.26], [0, 1.26]]), brass);
  mesh(lathe([[0.18, 1.24], [0.2, 1.3], [0.18, 1.34], [0, 1.34]]), brass);
  // Ống khói: kính mờ đục bán sáng (không transmission để ngọn lửa bên trong vẫn nhìn được qua emissive).
  const chimney = ctx.track(new THREE.MeshStandardMaterial({ color: '#fff3dd', emissive: '#ffc777', emissiveIntensity: 0.35, roughness: 0.2, transparent: true, opacity: 0.32, depthWrite: false }));
  const c = mesh(lathe([[0.13, 1.34], [0.2, 1.5], [0.21, 1.62], [0.12, 1.85], [0.1, 2.45], [0.11, 2.5]], 40), chimney);
  c.castShadow = false;
  c.renderOrder = 3;
  const flameMat = ctx.track(new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }));
  const flame = mesh(new THREE.SphereGeometry(0.05, 20, 14), flameMat, 1.48);
  flame.castShadow = false;
  flame.scale.set(0.8, 2.2, 0.8);
  const core = mesh(new THREE.SphereGeometry(0.03, 14, 10), ctx.track(new THREE.MeshBasicMaterial({ color: '#fff8e6', toneMapped: false })), 1.43);
  core.scale.set(0.8, 1.6, 0.8);
  const light = new THREE.PointLight('#ffb766', 3.2, 9, 1.6);
  light.position.y = 1.55;
  light.castShadow = false;
  g.add(light);
  return {
    group: g,
    flame: new THREE.Vector3(0, 1.48, 0),
    light,
    update(_dt, t) {
      const f = 1 + 0.06 * Math.sin(t * 13) + 0.04 * Math.sin(t * 7.3 + 1);
      flame.scale.set(0.8, 2.2 * f, 0.8);
      light.intensity = 3.2 * (0.92 + 0.08 * f);
    },
  };
}

/** Lọ mực thuỷ tinh đen vuông + bút lông ngỗng cắm nghiêng. */
export function createInkwell(ctx: Tracker): THREE.Group {
  const g = new THREE.Group();
  g.name = 'inkwell';
  const ink = ctx.track(new THREE.MeshStandardMaterial({ color: '#141821', roughness: 0.08, metalness: 0.3 }));
  const brass = ctx.track(createMetalMaterial('#b8893e', 0.3, 1));
  const body = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(0.34, 0.24, 0.34)), ink);
  body.position.y = 0.12;
  const neck = new THREE.Mesh(ctx.track(lathe([[0.07, 0.24], [0.09, 0.27], [0.09, 0.31], [0.06, 0.31]])), brass);
  body.castShadow = neck.castShadow = true;
  g.add(body, neck);
  // Bút lông: thân (cuống lông) + phiến lông dẹt hai bên, cong nhẹ.
  const quill = new THREE.Group();
  quill.name = 'quill';
  const shaft = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.008, 0.014, 1.5, 8)), ctx.track(new THREE.MeshStandardMaterial({ color: '#e8dcc4', roughness: 0.5 })));
  shaft.position.y = 0.75;
  const vane = new THREE.Shape();
  vane.moveTo(0, 0.35);
  vane.bezierCurveTo(0.12, 0.6, 0.11, 1.2, 0.01, 1.55);
  vane.lineTo(-0.01, 1.55);
  vane.bezierCurveTo(-0.07, 1.1, -0.06, 0.6, 0, 0.35);
  const feather = new THREE.Mesh(ctx.track(new THREE.ShapeGeometry(vane, 16)), ctx.track(new THREE.MeshStandardMaterial({ color: '#f4efe3', roughness: 0.85, side: THREE.DoubleSide })));
  feather.castShadow = true;
  quill.add(shaft, feather);
  quill.position.set(0.02, 0.18, 0);
  quill.rotation.set(0.15, 0.4, -0.38);
  g.add(quill);
  return g;
}

/** Chồng sách bìa da (màu lần lượt), gáy chữ vàng giả bằng sọc. */
export function createBookStack(ctx: Tracker, colors: string[] = ['#5a2a1e', '#2f3d2a', '#3b2a4a']): THREE.Group {
  const g = new THREE.Group();
  g.name = 'books';
  const pages = ctx.track(new THREE.MeshStandardMaterial({ color: '#e7dcc2', roughness: 0.9 }));
  const gold = ctx.track(createMetalMaterial('#c9a24f', 0.4, 1));
  let y = 0;
  colors.forEach((col, i) => {
    const w = 1.5 - i * 0.12;
    const d = 1.05 - i * 0.07;
    const h = 0.22 + (i % 2) * 0.06;
    const cover = ctx.track(new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }));
    const b = new THREE.Group();
    const shell = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(w, h, d)), cover);
    const inner = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(w - 0.04, h - 0.04, d - 0.02)), pages);
    inner.position.z = 0.02;
    for (const s of [-0.3, 0.3]) {
      const band = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(0.03, h + 0.004, 0.02)), gold);
      band.position.set(s * w, 0, -d / 2);
      b.add(band);
    }
    shell.castShadow = shell.receiveShadow = true;
    b.add(shell, inner);
    b.position.y = y + h / 2;
    b.rotation.y = (i % 2 ? -1 : 1) * 0.08 * (i + 1);
    y += h;
    g.add(b);
  });
  return g;
}
