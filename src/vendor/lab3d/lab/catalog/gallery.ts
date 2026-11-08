import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { createContactShadow } from '../room/contactShadow';
import { EQUIPMENT, EQUIPMENT_FAMILIES, type EquipmentEntry, type EquipmentFamily } from './equipment';

export interface EquipmentGallery {
  /** Hiện một nhóm (khối các hàng, căn giữa quanh gốc). */
  show(family: EquipmentFamily): void;
  families: EquipmentFamily[];
  /** Khổ lớn nhất của các khối (để đặt cỡ mặt bàn). */
  extent: { width: number; depth: number };
  /** Tâm + bán kính khối đang hiện – để đặt camera. */
  bounds(): { center: THREE.Vector3; radius: number };
  /** Vật của từng mục (kiểm tra / kịch bản). */
  items: Map<string, THREE.Object3D>;
}

const GAP = 0.35;
/** Ô tối thiểu cho mỗi vật – nhãn tên của vật nhỏ (dao lam, que cấy) khỏi chồng nhau. */
const MIN_SLOT = 1.5;

/**
 * Bày toàn bộ EQUIPMENT lên mặt bàn (y = 0): mỗi nhóm một khối các hàng, mỗi vật có bóng tiếp xúc + nhãn tên.
 * Dùng cho trang "Thư viện dụng cụ" (soi màu/tỉ lệ dưới preset bench, so với TN-073-05) và tài liệu cho nhóm khác.
 */
export function createEquipmentGallery(ctx: SimContext, root: THREE.Object3D, o: { rowWidth?: number; entries?: EquipmentEntry[] } = {}): EquipmentGallery {
  const rowWidth = o.rowWidth ?? 9;
  const entries = o.entries ?? EQUIPMENT;
  const items = new Map<string, THREE.Object3D>();
  const blocks = new Map<EquipmentFamily, THREE.Group>();
  /** Nhãn CSS2D không tự ẩn theo cha → ẩn riêng từng nhãn của nhóm. */
  const tags = new Map<EquipmentFamily, THREE.Object3D[]>();
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const extent = { width: 0, depth: 0 };
  for (const fam of Object.keys(EQUIPMENT_FAMILIES) as EquipmentFamily[]) {
    const list = entries.filter((x) => x.family === fam);
    if (!list.length) continue;
    const block = new THREE.Group();
    block.name = `gallery-${fam}`;
    root.add(block);
    blocks.set(fam, block);
    tags.set(fam, []);
    let x = 0;
    let rowDepth = 0;
    let rowZ = 0;
    const row: THREE.Object3D[] = [];
    const flush = () => {
      for (const it of row) it.position.x -= x / 2; // căn giữa hàng
      row.length = 0;
      rowZ += rowDepth + GAP * 2;
      x = 0;
      rowDepth = 0;
    };
    for (const it of list) {
      const holder = new THREE.Group();
      holder.name = `gallery-item-${it.id}`;
      const obj = it.make(ctx);
      holder.add(obj);
      holder.updateMatrixWorld(true);
      box.setFromObject(obj).getSize(size);
      box.getCenter(mid);
      obj.position.x -= mid.x;
      obj.position.z -= mid.z;
      obj.position.y -= box.min.y; // đặt đáy lên mặt bàn
      const slot = Math.max(size.x, MIN_SLOT);
      if (x > 0 && x + slot > rowWidth) flush();
      holder.position.set(x + slot / 2, 0, rowZ + size.z / 2);
      holder.add(createContactShadow(ctx, Math.max(0.12, Math.max(size.x, size.z) * 0.55), 0.4));
      const tag = new THREE.Object3D();
      tag.position.set(0, size.y + 0.12, 0);
      holder.add(tag);
      ctx.labels.add(tag, it.name, { variant: 'small' });
      tags.get(fam)!.push(tag);
      block.add(holder);
      items.set(it.id, holder);
      row.push(holder);
      x += slot + GAP;
      rowDepth = Math.max(rowDepth, size.z);
    }
    if (row.length) flush();
    const depth = rowZ - GAP * 2;
    block.position.z = -depth / 2;
    box.setFromObject(block);
    extent.width = Math.max(extent.width, box.max.x - box.min.x);
    extent.depth = Math.max(extent.depth, depth);
  }
  const families = [...blocks.keys()];
  let current = families[0];
  const api: EquipmentGallery = {
    items,
    families,
    extent,
    show(f) {
      current = f;
      for (const [fam, b] of blocks) {
        b.visible = fam === f;
        for (const t of tags.get(fam) ?? []) t.visible = b.visible;
      }
    },
    bounds() {
      box.makeEmpty();
      const b = blocks.get(current);
      if (b) box.expandByObject(b);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      return { center: sphere.center, radius: Math.max(0.5, sphere.radius) };
    },
  };
  if (current) api.show(current);
  return api;
}
