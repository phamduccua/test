import * as THREE from 'three';
import { createVessel, type Vessel } from '../glassware/vessel';
import { bowlProfile, createGlassBowl } from '../equipment/kitchen';
import type { Liquid, LiquidOptions } from '../liquid/liquid';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { accentColor } from '../materials/palette';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, lathe, optionalLiquid, P, type Accent } from './common';

export interface BowlOptions {
  /** 'ceramic' = bát sứ ngà viền màu (mặc định), 'glass' = bát thuỷ tinh (createGlassBowl), 'plastic' = bát nhựa màu, 'steel' = inox. */
  material?: 'ceramic' | 'glass' | 'plastic' | 'steel';
  diameter?: number;
  height?: number;
  /** Màu viền miệng (sứ/inox) hoặc màu thân (nhựa). Mặc định 'blue'. */
  color?: Accent;
  /** Đống hạt trong bát (muối hạt, đường cát, hạt giống…). */
  grains?: { color: THREE.ColorRepresentation; size?: number; count?: number };
  liquid?: LiquidOptions;
}

export interface Bowl {
  group: THREE.Group;
  vessel: Vessel;
  liquid: Liquid | null;
  grains: THREE.InstancedMesh | null;
  /** Đáy trong. */
  floorY: number;
  /** Điểm múc (đỉnh đống hạt / giữa lòng bát). */
  scoop: THREE.Object3D;
}

/** A-BAT – bát sứ/thuỷ tinh/nhựa/inox Ø 110 × 50 mm. Gốc ở đáy ngoài. Rót/múc vào `vessel.profile`. */
export function createBowl(ctx: Tracker, o: BowlOptions = {}): Bowl {
  const mats = labMaterials(ctx);
  const kind = o.material ?? 'ceramic';
  const D = o.diameter ?? 110;
  const H = o.height ?? 50;
  const color = o.color ?? 'blue';
  const vessel =
    kind === 'glass'
      ? createGlassBowl(ctx, { diameter: D, height: H })
      : createVessel(ctx, bowlProfile(D, H, kind === 'steel' ? 1.2 : 3), {
          material: kind === 'ceramic' ? mats.ceramic() : kind === 'steel' ? mats.steel() : mats.plastic(color),
          name: 'bowl',
          segments: 64,
        });
  vessel.glass.castShadow = kind !== 'glass';
  vessel.glass.receiveShadow = kind !== 'glass';
  const group = vessel.group;
  if (kind === 'ceramic' || kind === 'steel') {
    // Viền miệng màu (bát sứ Việt viền xanh) – tách mép bát khỏi mặt bàn sáng.
    const rim = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(D / 2 - 0.6), mm(1.8), 8, 64)), mats.plastic(color));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = mm(H - 0.6);
    group.add(rim);
  }
  let grains: THREE.InstancedMesh | null = null;
  let top = vessel.profile.innerBottom + mm(H * 0.2);
  if (o.grains) {
    const n = o.grains.count ?? 260;
    const s = o.grains.size ?? mm(2.4);
    grains = new THREE.InstancedMesh(ctx.track(new THREE.BoxGeometry(s, s, s)), ctx.track(new THREE.MeshStandardMaterial({ color: o.grains.color, roughness: 0.4 })), n);
    const heap = mm(D * 0.33);
    const base = vessel.profile.innerBottom;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < n; i++) {
      const a = i * 2.399;
      const k = Math.sqrt(i / n);
      const y = base + s + (1 - k * k) * mm(H * 0.26) + k * k * mm(H * 0.12) + ((i * 7) % 5) * s * 0.2;
      m.compose(v.set(Math.cos(a) * heap * k, y, Math.sin(a) * heap * k), q.setFromEuler(e.set(i, i * 0.7, i * 1.3)), one);
      grains.setMatrixAt(i, m);
    }
    grains.castShadow = true;
    group.add(grains);
    top = base + s + mm(H * 0.26);
  }
  const liquid = optionalLiquid(ctx, vessel.profile, group, o.liquid);
  return { group, vessel, liquid, grains, floorY: vessel.profile.innerBottom, scoop: anchor(group, 'bowl-scoop', 0, top) };
}

/** Lỗ thoát nước của rổ: lưới khe dọc (alpha) vẽ canvas. */
function slotTexture(): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(256, 64);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#000';
  for (let i = 0; i < 16; i++) g.fillRect(i * 16 + 5, 12, 6, 40);
  const t = canvasTexture(canvas, false, [6, 1]);
  return t;
}

export interface Basket {
  group: THREE.Group;
  /** Đáy trong (chỗ đặt rau/quả). */
  floorY: number;
  /** Bán kính đáy dùng được (để rải vật). */
  radius: number;
}

/** A-RO – rổ nhựa Ø 220 × 80 mm, thành có khe thoát nước, vành dày; màu nhận diện (mặc định 'green'). */
export function createBasket(ctx: Tracker, o: { diameter?: number; height?: number; color?: Accent } = {}): Basket {
  const R = (o.diameter ?? 220) / 2;
  const H = o.height ?? 80;
  const group = new THREE.Group();
  group.name = 'basket';
  const hex = accentColor(o.color ?? 'green');
  const solid = labMaterials(ctx).plastic(hex);
  const holed = ctx.track(new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.4, side: THREE.DoubleSide, alphaMap: ctx.track(slotTexture()), alphaTest: 0.5 }));
  const bottom = R * 0.6;
  // Đáy đặc + thành có khe (lathe hở) + vành miệng đặc.
  group.add(lathe(ctx, [P(0, 8), P(bottom + 4, 8), P(bottom + 4, 0), P(0, 0)], solid, 48));
  const wall = lathe(ctx, [P(bottom, 4), P(R * 0.8, H * 0.4), P(R - 4, H - 6)], holed, 48);
  group.add(wall);
  const rim = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(R - 3), mm(4), 8, 64)), solid);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = mm(H - 4);
  rim.castShadow = true;
  group.add(rim);
  return { group, floorY: mm(8), radius: mm(bottom + 10) };
}
