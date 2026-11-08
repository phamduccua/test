import * as THREE from 'three';
import { heightConstraint, surfaceConstraint } from './constraints';
import { createDraggable, type Draggable } from './drag';
import { createSketch, type Sketch, type SketchOptions } from './sketch';
import type { Constraint, InteractCtx, PointerTarget } from './types';
import { labText } from '../text';

/** Địa hình: hàm độ cao (thế giới) hoặc các mesh để raycast. */
export type TerrainSource = { heightAt(x: number, z: number): number; bounds?: THREE.Box3 } | { meshes: THREE.Object3D[] };

export function terrainConstraint(t: TerrainSource): Constraint {
  return 'heightAt' in t ? heightConstraint(t.heightAt, { bounds: t.bounds }) : surfaceConstraint(t.meshes);
}

export interface TerrainHandleOptions {
  /** Vật bám mặt đất (cột mốc, trạm, người…) – vị trí theo hệ cha. */
  object: THREE.Object3D;
  handle?: THREE.Object3D;
  terrain: TerrainSource;
  /** Nhô khỏi mặt đất (thế giới). */
  lift?: number;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  /** Chỉnh điểm (bước lưới, chỉ trên tuyến…) trước khi đặt. */
  filter?(world: THREE.Vector3): void;
  onMove?(world: THREE.Vector3, final: boolean): void;
}

/** Kéo điểm trên địa hình (mốc, trạm đo, người leo núi…): vật bám mặt đất, quán tính nhẹ. */
export function createTerrainHandle(ctx: InteractCtx, o: TerrainHandleOptions): Draggable {
  return createDraggable(ctx, {
    object: o.object,
    handle: o.handle,
    keepOffset: false,
    smoothing: 24,
    hint: o.hint ?? labText('t_b42bea2889d5'),
    enabled: o.enabled,
    constraint: terrainConstraint(o.terrain),
    filter: (w) => {
      o.filter?.(w);
      w.y += o.lift ?? 0;
    },
    onMove: (w) => o.onMove?.(w, false),
    onEnd: (w) => o.onMove?.(w, true),
  });
}

/** Vẽ tuyến/đường trên địa hình (mặt cắt, lưu vực, đường đi…) khi `active()`. */
export function createTerrainSketch(
  ctx: InteractCtx,
  o: Omit<SketchOptions, 'constraint' | 'minStep'> & { terrain: TerrainSource; minStep?: number; lift?: number },
): Sketch {
  return createSketch(ctx, { ...o, constraint: terrainConstraint(o.terrain), minStep: o.minStep ?? 1, lift: o.lift ?? 0.3 });
}
