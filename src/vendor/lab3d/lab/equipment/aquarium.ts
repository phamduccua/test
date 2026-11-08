import * as THREE from 'three';
import { applyLiquidLook, createLiquidMaterial } from '../liquid/liquidMaterial';
import { createGlassMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import { createRockGeometry, createRockInstances, createRockMaterial } from '../solids/rock';
import type { Tracker } from '../types';
import { mm } from '../units';

/**
 * A-BE-KINH: bể kính nuôi (mặc định 36 × 22 × 22 cm) có khung nhựa, nước, lớp sỏi và một hòn đá nhô khỏi mặt nước (chỗ ếch con ngồi).
 * Gốc ở giữa đáy ngoài. Vật thả trong bể phải là vật liệu đục (quy tắc kính transmission).
 */
export interface Aquarium {
  group: THREE.Group;
  /** Mặt nước, mặt sỏi (y, toạ độ group). */
  waterY: number;
  floorY: number;
  /** Nửa kích thước lòng bể (x, z). */
  half: THREE.Vector2;
  /** Đỉnh hòn đá (toạ độ group). */
  rockTop: THREE.Vector3;
}

export function createAquarium(ctx: Tracker, o: { width?: number; height?: number; depth?: number; fill?: number } = {}): Aquarium {
  const W = o.width ?? 3.6;
  const H = o.height ?? 2.2;
  const D = o.depth ?? 2.2;
  const t = mm(5);
  const g = new THREE.Group();
  g.name = 'aquarium';
  const glass = ctx.track(createGlassMaterial({ thickness: t * 2, tint: 0xd9f2ea, attenuationDistance: 0.6 }));
  const frame = labMaterials(ctx).darkPlastic();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(w, h, d)), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  box(W, t, D, 0, t / 2, 0, glass);
  for (const s of [-1, 1]) {
    box(W, H, t, 0, H / 2, s * (D / 2 - t / 2), glass);
    box(t, H, D - 2 * t, s * (W / 2 - t / 2), H / 2, 0, glass);
  }
  // Khung viền trên và dưới.
  const f = mm(12);
  for (const y of [f / 2, H - f / 2]) {
    for (const s of [-1, 1]) {
      box(W + mm(4), f, f, 0, y, s * (D / 2), frame);
      box(f, f, D + mm(4), s * (W / 2), y, 0, frame);
    }
  }
  const floorY = mm(30);
  const waterY = H * (o.fill ?? 0.72);
  // Nước: khối transmission nằm trong lòng bể, trên lớp sỏi.
  const wMat = ctx.track(createLiquidMaterial(D));
  applyLiquidLook(wMat, { color: new THREE.Color('#bfe6dc'), density: 0.1, turbidity: 0.02, turbidColor: new THREE.Color('#ffffff') });
  const water = box(W - 2 * t - mm(1), waterY - floorY, D - 2 * t - mm(1), 0, (waterY + floorY) / 2, 0, wMat);
  water.renderOrder = -2;
  // Lớp sỏi: nền đục + sỏi nhỏ.
  const bed = box(W - 2 * t - mm(2), floorY - t, D - 2 * t - mm(2), 0, (floorY + t) / 2, 0, ctx.track(new THREE.MeshStandardMaterial({ color: '#9b8a70', roughness: 1 })));
  bed.receiveShadow = true;
  const pebbles = createRockInstances(ctx, 260, { radius: mm(3.5), detail: 2, bumps: 0.25, grain: 0.05, squash: [1, 0.6, 1], color: '#a99a80', vein: '#6f604c', variants: 4 });
  pebbles.count = 260;
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const q = new THREE.Quaternion();
  for (let i = 0; i < 260; i++) {
    q.setFromEuler(new THREE.Euler(0, rnd() * 6, 0));
    pebbles.setPose(i, new THREE.Vector3((rnd() - 0.5) * (W - 0.12), floorY + mm(1), (rnd() - 0.5) * (D - 0.12)), q, 0.6 + rnd() * 0.8);
  }
  pebbles.commit();
  g.add(pebbles.group);
  // Hòn đá nhô lên khỏi mặt nước ở góc trái.
  const rockH = waterY - floorY + 0.28;
  const rock = new THREE.Mesh(ctx.track(createRockGeometry({ radius: 0.32, detail: 12, seed: 5, bumps: 0.18, squash: [1.3, rockH / 0.32 / 2, 1], color: '#7d7a72', vein: '#5b5750' })), createRockMaterial(ctx));
  rock.position.set(-W / 2 + 0.6, floorY + rockH / 2 - 0.04, -D / 2 + 0.5);
  rock.castShadow = rock.receiveShadow = true;
  g.add(rock);
  return {
    group: g,
    waterY,
    floorY,
    half: new THREE.Vector2(W / 2 - t - 0.05, D / 2 - t - 0.05),
    rockTop: new THREE.Vector3(rock.position.x, floorY + rockH - 0.06, rock.position.z),
  };
}
