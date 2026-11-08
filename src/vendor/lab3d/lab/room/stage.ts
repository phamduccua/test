import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { LAB_PALETTE } from '../materials/palette';
import { createLabBackdrop } from './backdrop';
import { createBench, type BenchTop } from './bench';
import { createLabLighting, type LabLighting } from './labLighting';
import { createLabRoom } from './labRoom';
import { LAB_LOOKS, type LabLightingPreset } from './lightingPresets';
import { createLightRig, type LightRig } from './lighting';
import { createWallShelf } from './shelf';

export interface LabStageOptions {
  benchWidth?: number;
  benchDepth?: number;
  top?: BenchTop;
  /** Kệ treo tường phía sau bàn. */
  shelf?: boolean;
  /** Khoảng camera mặc định tới tâm bàn. */
  viewDistance?: number;
  /**
   * Bộ đèn chuẩn (createLabLighting): env studio + tone mapping Neutral + phông nền sau dụng cụ + phòng tối bớt + hậu kỳ nhẹ.
   * Bỏ trống = giao diện cũ (RoomEnvironment sáng, ACES).
   */
  lighting?: LabLightingPreset;
  /** Phông nền sau dụng cụ khi có `lighting` (mặc định bật): chiều cao, độ ôm (rad), khoảng lùi z so với mép sau bàn. */
  backdrop?: false | { height?: number; arc?: number; inset?: number; width?: number };
  /** Tắt hậu kỳ của `lighting`. */
  post?: boolean;
  /** false = không dựng vỏ phòng (sim tự dựng bối cảnh khác, vd. phòng thí nghiệm cổ). Mặc định true. */
  room?: boolean;
}

export interface LabStage {
  root: THREE.Group;
  bench: THREE.Group;
  /** Mặt bàn (luôn 0). */
  topY: number;
  width: number;
  depth: number;
  lights: LightRig;
  /** Mặt trên kệ tường (nếu có). */
  shelf: THREE.Group | null;
  /** Kết quả createLabLighting khi đặt `lighting`. */
  lighting: LabLighting | null;
  backdrop: THREE.Mesh | null;
}

/**
 * Dựng phòng thí nghiệm chuẩn: phòng + bàn + đèn + (kệ). Thang đo 1 đơn vị = 1 dm, mặt bàn y = 0.
 * Đặt camera nhìn chéo xuống bàn và giới hạn OrbitControls.
 */
export function createLabStage(ctx: SimContext, o: LabStageOptions = {}): LabStage {
  const width = o.benchWidth ?? 18;
  const depth = o.benchDepth ?? 7.5;
  const { scene, camera, controls } = ctx;
  scene.background = new THREE.Color(0xdde4ea);
  scene.environmentIntensity = 0.7;
  const root = new THREE.Group();
  root.name = 'lab-stage';
  const backZ = -depth / 2 - 0.3;
  const look = o.lighting ? LAB_LOOKS[o.lighting] : null;
  if (o.room !== false) root.add(createLabRoom(ctx, { backZ, tone: look?.roomTone }));
  const bench = createBench(ctx, { width, depth, top: o.top, topTint: o.top === 'white' ? look?.whiteTopTint : undefined, cabinetColor: look ? LAB_PALETTE.cabinet : undefined });
  root.add(bench);
  const lights = createLightRig(Math.max(width, 14), look?.lights);
  let backdrop: THREE.Mesh | null = null;
  if (look && o.backdrop !== false) {
    const b = o.backdrop ?? {};
    backdrop = createLabBackdrop(ctx, { colors: look.backdrop, width: b.width ?? width * 0.96, height: b.height, arc: b.arc });
    backdrop.position.set(0, 0, -depth / 2 + (b.inset ?? 0.12));
    root.add(backdrop);
  }
  root.add(lights.group);
  let shelf: THREE.Group | null = null;
  if (o.shelf !== false) {
    shelf = createWallShelf(ctx, width * 0.7, 2);
    shelf.position.set(0, 3.9, backZ + 1);
    root.add(shelf);
  }
  scene.add(ctx.track(root));
  const lighting = o.lighting ? createLabLighting(ctx, { preset: o.lighting, post: o.post }) : null;

  camera.fov = 38;
  camera.updateProjectionMatrix();
  const dist = o.viewDistance ?? 22;
  camera.position.set(0, dist * 0.42, dist * 0.9);
  ctx.frameTo(new THREE.Vector3(0, 1.4, 0), dist);
  controls.minDistance = 1.2;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minPolarAngle = 0.15;
  return { root, bench, topY: 0, width, depth, lights, shelf, lighting, backdrop };
}
