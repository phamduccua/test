import type * as THREE from 'three';
import type { Tracker } from '../types';
import { labMaterialLook } from './look';
import { accentColor, LAB_PALETTE, type LabAccent } from './palette';
import { mm } from '../units';
import {
  createGlassMaterial,
  createMetalMaterial,
  createPlasticMaterial,
  createRubberMaterial,
  createWoodMaterial,
} from './factories';

/** Bộ vật liệu dùng chung trong MỘT mô phỏng (tạo lười, tự `track` → dispose cùng mô phỏng). */
export interface LabMaterials {
  glass(): THREE.MeshPhysicalMaterial;
  /** Thuỷ tinh dày (đèn cồn, chai). */
  thickGlass(): THREE.MeshPhysicalMaterial;
  /** Thuỷ tinh đặc (đũa, nhiệt kế). */
  solidGlass(): THREE.MeshPhysicalMaterial;
  amberGlass(): THREE.MeshPhysicalMaterial;
  steel(): THREE.MeshStandardMaterial;
  chrome(): THREE.MeshStandardMaterial;
  blackPaint(): THREE.MeshStandardMaterial;
  rubber(): THREE.MeshStandardMaterial;
  blackRubber(): THREE.MeshStandardMaterial;
  whitePlastic(): THREE.MeshPhysicalMaterial;
  bluePlastic(): THREE.MeshPhysicalMaterial;
  darkPlastic(): THREE.MeshPhysicalMaterial;
  wood(): THREE.MeshStandardMaterial;
  cork(): THREE.MeshStandardMaterial;
  cotton(): THREE.MeshStandardMaterial;
  // Bảng màu dụng cụ (LAB_PALETTE) – dùng thay cho màu trắng tự đặt để nhìn rõ trên máy chiếu.
  /** Thân kính hiển vi, đèn, máy nhỏ (ngà). */
  instrument(): THREE.MeshPhysicalMaterial;
  /** Vỏ máy: bể ổn nhiệt, li tâm, cân, khối gia nhiệt (xám xanh nhạt). */
  device(): THREE.MeshPhysicalMaterial;
  /** Vỏ tủ (tủ ấm, tủ an toàn, tủ lạnh, tủ ngăn kéo). */
  cabinet(): THREE.MeshPhysicalMaterial;
  cabinetDark(): THREE.MeshPhysicalMaterial;
  /** Lòng tủ. */
  liner(): THREE.MeshPhysicalMaterial;
  ceramic(): THREE.MeshPhysicalMaterial;
  foam(): THREE.MeshStandardMaterial;
  paper(): THREE.MeshStandardMaterial;
  /** Viền, tay nắm, chân đế, núm (gần đen). */
  trim(): THREE.MeshPhysicalMaterial;
  /** Bảng điều khiển / màn hình tắt. */
  panel(): THREE.MeshPhysicalMaterial;
  /** Nhựa màu nhận diện (nắp, quai, cán) – tên LAB_ACCENT hoặc mã màu. */
  plastic(color: LabAccent | string): THREE.MeshPhysicalMaterial;
  /** Nhựa trong (lọ PET, cốc nhựa, hộp) – có viền mép như thuỷ tinh, ngả màu nhẹ để thấy thành. */
  clearPlastic(tint?: string): THREE.MeshPhysicalMaterial;
}

const kits = new WeakMap<object, LabMaterials>();

/** Lấy (hoặc tạo) bộ vật liệu gắn với `ctx`. Khi mô phỏng huỷ, vật liệu bị dispose cùng ctx. */
export function labMaterials(ctx: Tracker): LabMaterials {
  const found = kits.get(ctx);
  if (found) return found;
  const cache = new Map<string, THREE.Material>();
  const once = <T extends THREE.Material>(key: string, make: () => T): (() => T) => () => {
    let m = cache.get(key) as T | undefined;
    if (!m) {
      m = ctx.track(make());
      cache.set(key, m);
    }
    return m;
  };
  const kit: LabMaterials = {
    glass: once('glass', () => createGlassMaterial()),
    thickGlass: once('thickGlass', () => createGlassMaterial({ thickness: mm(6), attenuationDistance: 1.5 })),
    solidGlass: once('solidGlass', () => createGlassMaterial({ thickness: mm(6), attenuationDistance: 2 })),
    amberGlass: once('amberGlass', () =>
      createGlassMaterial({ thickness: mm(4), tint: 0x8a4a12, attenuationDistance: 0.06 }),
    ),
    steel: once('steel', () => createMetalMaterial(0xc4c8ce, 0.32)),
    chrome: once('chrome', () => createMetalMaterial(0xe8ebef, 0.12, 1)),
    blackPaint: once('blackPaint', () => createMetalMaterial(0x23262b, 0.45, 0.55)),
    rubber: once('rubber', () => createRubberMaterial()),
    blackRubber: once('blackRubber', () => createRubberMaterial(0x26282b)),
    // Preset ánh sáng (bench/dark/bright) đặt whiteBody → "nhựa trắng" ngả xám nhẹ, khỏi loá trên mặt bàn trắng.
    whitePlastic: once('whitePlastic', () => createPlasticMaterial(labMaterialLook().whiteBody ?? 0xf2f4f6)),
    bluePlastic: once('bluePlastic', () => createPlasticMaterial(0x1f5fbf, 0.35)),
    darkPlastic: once('darkPlastic', () => createPlasticMaterial(0x2a2e35, 0.5)),
    wood: once('wood', () => createWoodMaterial(...(labMaterialLook().wood ?? []))),
    cork: once('cork', () => createRubberMaterial(0xb58a5a)),
    cotton: once('cotton', () => createRubberMaterial(0xf1ece0)),
    instrument: once('instrument', () => createPlasticMaterial(LAB_PALETTE.instrument, 0.42)),
    device: once('device', () => createPlasticMaterial(LAB_PALETTE.device, 0.45)),
    cabinet: once('cabinet', () => createPlasticMaterial(LAB_PALETTE.cabinet, 0.5)),
    cabinetDark: once('cabinetDark', () => createPlasticMaterial(LAB_PALETTE.cabinetDark, 0.5)),
    liner: once('liner', () => createPlasticMaterial(LAB_PALETTE.liner, 0.6)),
    ceramic: once('ceramic', () => createPlasticMaterial(LAB_PALETTE.ceramic, 0.3)),
    foam: once('foam', () => createRubberMaterial(LAB_PALETTE.foam)),
    paper: once('paper', () => createRubberMaterial(LAB_PALETTE.paper)),
    trim: once('trim', () => createPlasticMaterial(LAB_PALETTE.trim, 0.5)),
    panel: once('panel', () => createPlasticMaterial(LAB_PALETTE.panel, 0.4)),
    plastic: (c) => {
      const hex = accentColor(c);
      return once(`plastic:${hex}`, () => createPlasticMaterial(hex, 0.38))();
    },
    clearPlastic: (tint = '#dfeaf0') =>
      once(`clearPlastic:${tint}`, () => createGlassMaterial({ thickness: mm(1.5), tint, attenuationDistance: 0.25, roughness: 0.12 }))(),
  };
  // Khi ctx huỷ, xoá khỏi cache (WeakMap tự bỏ khi ctx bị thu gom; đây chỉ để chắc chắn).
  ctx.track(() => kits.delete(ctx));
  kits.set(ctx, kit);
  return kit;
}
