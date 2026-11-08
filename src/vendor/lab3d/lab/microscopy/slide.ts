import * as THREE from 'three';
import { createGlassMaterial } from '../materials/factories';
import { createLiquidMaterial } from '../liquid/liquidMaterial';
import { mm } from '../units';
import type { SimContext } from '../../sim/types';

/** A-LAM-KINH + A-LAMEN + giọt dung dịch + A-BIEU-BI. Gốc = tâm mặt dưới lam kính; lam dài theo x. */
export interface SlideKit {
  group: THREE.Group;
  /** Mặt trên lam kính (y cục bộ). */
  topY: number;
  /** Lamen (con của bench root khi chưa đặt; được gắn vào lam bằng `attachCover`). */
  cover: THREE.Mesh;
  /** Mảnh biểu bì (bay từ lá tới lam). */
  peel: THREE.Mesh;
  /** Giọt dung dịch 0…1 (0 = không có); `flat` = đã đậy lamen và thấm (lớp mỏng dưới lamen). */
  setDrop(size: number, flat?: boolean): void;
  /** Vệt nước ở mép lamen (Hình 11.1): side = +1 phải, −1 trái, 0 = không. */
  setEdgeWater(side: number): void;
  /** Đặt lamen lên lam; `lift` = nâng thêm (vd. có tấm thạch/lớp đệm dưới lamen). */
  attachCover(lift?: number): void;
  attachPeel(): void;
  /** Nhuộm giọt/lớp dung dịch (xanh methylene, acetocarmine…) bằng vật liệu đục để thấy rõ; null = nước trong. */
  setDropColor(color: THREE.ColorRepresentation | null, opacity?: number): void;
  reset(): void;
}

const L = mm(75);
const W = mm(25);
const T = mm(1.1);
const C = mm(22);

export interface SlideKitOptions {
  /** Đầu lam mờ (vùng ghi nhãn) để nhận ra lam trên bàn kính tối – mặc định false (giữ dáng cũ). */
  frosted?: boolean;
}

export function createSlideKit(ctx: SimContext, o: SlideKitOptions = {}): SlideKit {
  const glass = ctx.track(createGlassMaterial({ thickness: mm(1) }));
  const group = new THREE.Group();
  group.name = 'slide';
  const slab = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(L, T, W)), glass);
  slab.position.y = T / 2;
  group.add(slab);
  if (o.frosted) {
    const frost = new THREE.Mesh(
      ctx.track(new THREE.BoxGeometry(mm(18), mm(0.06), W * 0.98)),
      ctx.track(new THREE.MeshStandardMaterial({ color: '#eef0ee', roughness: 0.95 })),
    );
    frost.position.set(-L / 2 + mm(9.5), T + mm(0.03), 0);
    group.add(frost);
  }
  const liquid = ctx.track(createLiquidMaterial(mm(1)));
  // Giọt nhuộm màu: vật liệu đục (vật transmission mỏng trên lam/tấm lót tối gần như vô hình).
  const stained = ctx.track(new THREE.MeshPhysicalMaterial({ roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.85, depthWrite: false }));
  const drop = new THREE.Mesh(ctx.track(new THREE.SphereGeometry(mm(5), 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)), liquid);
  drop.position.y = T;
  drop.renderOrder = -2;
  group.add(drop);
  const film = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(C * 0.98, mm(0.12), C * 0.98)), liquid);
  film.position.y = T + mm(0.06);
  film.renderOrder = -2;
  group.add(film);
  const edgeGeo = ctx.track(new THREE.SphereGeometry(mm(3.2), 20, 10, 0, Math.PI * 2, 0, Math.PI / 2));
  const edge = new THREE.Mesh(edgeGeo, liquid);
  edge.scale.set(0.8, 0.35, 1.6);
  edge.renderOrder = -2;
  group.add(edge);

  // Mảnh biểu bì tím mỏng, viền lượn không đều (vật liệu đục: vật transparent nằm dưới giọt/lamen transmission sẽ bị che).
  const sh = new THREE.Shape();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 1 + 0.12 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 5);
    const x = Math.cos(a) * mm(5.5) * r;
    const y = Math.sin(a) * mm(3.8) * r;
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  const peelMat = ctx.track(new THREE.MeshPhysicalMaterial({ color: '#9b4fb8', roughness: 0.5, side: THREE.DoubleSide, sheen: 0.4 }));
  const peel = new THREE.Mesh(ctx.track(new THREE.ShapeGeometry(sh)), peelMat);
  peel.geometry.rotateX(-Math.PI / 2);
  peel.name = 'epidermis';
  const cover = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(C, mm(0.3), C)), glass);
  cover.name = 'coverslip';

  const kit: SlideKit = {
    group,
    topY: T,
    cover,
    peel,
    setDrop(size, flat = false) {
      drop.visible = size > 0.01 && !flat;
      drop.scale.set(size, size * 0.55, size);
      film.visible = flat;
    },
    setEdgeWater(side) {
      edge.visible = side !== 0;
      edge.position.set(side * (C / 2 + mm(1.5)), T, 0);
    },
    setDropColor(color, opacity = 0.85) {
      const mat = color === null ? liquid : stained;
      if (color !== null) {
        stained.color.set(color);
        stained.opacity = opacity;
      }
      [drop, film, edge].forEach((m) => {
        m.material = mat;
        m.renderOrder = color === null ? -2 : 1;
      });
    },
    attachCover(lift = 0) {
      group.add(cover);
      cover.position.set(0, T + mm(0.12) + mm(0.15) + lift, 0);
      cover.rotation.set(0, 0, 0);
    },
    attachPeel() {
      group.add(peel);
      peel.position.set(0, T + mm(0.08), 0);
      peel.rotation.set(0, 0.3, 0);
    },
    reset() {
      kit.setDrop(0);
      kit.setEdgeWater(0);
    },
  };
  kit.reset();
  return kit;
}
