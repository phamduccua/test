import * as THREE from 'three';
import { buildProfile } from '../glassware/profile';
import { createVessel, latheFromProfile, type Vessel } from '../glassware/vessel';
import { labMaterials } from '../materials/kit';
import { LAB_PALETTE } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface Mortar extends Vessel {
  /** Độ cao mặt trong lòng cối tại bán kính r (đv, toạ độ cối) – đặt chất rắn lên (như `createWatchGlass`). */
  surfaceY(r: number): number;
  /** Chày sứ: gốc ở đầu giã (đáy chày), trục +y. Không gắn vào cối – sim tự đặt (để cầm/kéo). */
  pestle: THREE.Group;
  /** Chiều dài chày (đv). */
  pestleLength: number;
}

const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) });

/** Men sứ ngà (LAB_PALETTE.ceramic – không trắng tinh, tách khỏi mặt bàn trắng) – dùng cho cối/chày. */
function porcelain(ctx: Tracker, rough: number): THREE.MeshPhysicalMaterial {
  return ctx.track(new THREE.MeshPhysicalMaterial({ color: LAB_PALETTE.ceramic, roughness: rough, clearcoat: rough < 0.5 ? 0.5 : 0, clearcoatRoughness: 0.35 }));
}

/**
 * A-COI-CHAY-SU – cối sứ (Ø ngoài ~`diameter` mm) + chày sứ. Gốc cối ở đáy. Lòng cối nhám (không men) để giã đá vôi, muối…
 * Dùng `surfaceY` cho chất rắn nằm trong cối; chày là nhóm riêng (kéo giã bằng `createPestleGesture`). `height` (mm, mặc định 44) – cối sâu lòng.
 */
export function createMortar(ctx: Tracker, diameter = 92, height = 44): Mortar {
  const R = diameter / 2;
  const k = height / 44;
  const outer = [P(0, 0), P(R * 0.62, 0), P(R * 0.7, 3 * k), P(R * 0.8, 16 * k), P(R * 0.94, 36 * k), P(R, height)];
  const profile = buildProfile(outer, mm(7));
  const v = createVessel(ctx, profile, { name: 'mortar', material: porcelain(ctx, 0.42) });
  v.glass.castShadow = v.glass.receiveShadow = true;
  // Lòng cối: lớp nhám (không men) phủ mặt trong.
  const inside = new THREE.Mesh(latheFromProfile(profile.inner.map((p) => ({ r: p.r * 0.995, y: p.y + mm(0.2) })), 48), porcelain(ctx, 0.9));
  ctx.track(inside.geometry);
  (inside.material as THREE.Material).side = THREE.DoubleSide;
  inside.receiveShadow = true;
  v.group.add(inside);
  // Viền men xanh sẫm quanh miệng cối (phần màu đậm để nhận ra cối trên bàn trắng).
  const band = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(mm(R * 0.985), mm(1.6), 8, 72).rotateX(Math.PI / 2)), labMaterials(ctx).plastic('blue'));
  band.position.y = mm(height - 2.5);
  v.group.add(band);
  const inner = profile.inner;
  const surfaceY = (r: number) => {
    if (r <= inner[0].r) return inner[0].y;
    for (let i = 1; i < inner.length; i++) {
      const a = inner[i - 1];
      const b = inner[i];
      if (r <= b.r) return a.y + ((b.y - a.y) * (r - a.r)) / Math.max(1e-9, b.r - a.r);
    }
    return inner[inner.length - 1].y;
  };

  const L = mm(125);
  const pts = [
    new THREE.Vector2(0.0001, 0), new THREE.Vector2(mm(7), mm(1.2)), new THREE.Vector2(mm(11), mm(6)), new THREE.Vector2(mm(12.5), mm(13)),
    new THREE.Vector2(mm(11), mm(22)), new THREE.Vector2(mm(7.5), mm(34)), new THREE.Vector2(mm(6.5), mm(70)), new THREE.Vector2(mm(7.5), L - mm(9)),
    new THREE.Vector2(mm(6), L - mm(2)), new THREE.Vector2(0.0001, L),
  ];
  const pestle = new THREE.Group();
  pestle.name = 'pestle';
  const pm = new THREE.Mesh(ctx.track(new THREE.LatheGeometry(pts, 32)), porcelain(ctx, 0.45));
  pm.castShadow = true;
  pestle.add(pm);
  return { ...v, surfaceY, pestle, pestleLength: L };
}
