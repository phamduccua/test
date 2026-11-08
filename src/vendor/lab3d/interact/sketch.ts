import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { pointerHub } from './pointer';
import type { Constraint, InteractCtx, PointerTarget } from './types';
import { labText } from '../text';

export interface SketchOptions {
  /** Vật bắt đầu nét vẽ (mặt địa cầu, địa hình…). */
  surface: THREE.Object3D;
  /** Tia → điểm trên bề mặt (sphereConstraint / heightConstraint / surfaceConstraint). */
  constraint: Constraint;
  /** Chỉ vẽ khi trả true (chế độ "Vẽ tuyến" – còn lại kéo bề mặt vẫn xoay camera). */
  active(): boolean;
  /** Khoảng cách tối thiểu giữa hai điểm (thế giới). */
  minStep: number;
  /** Nâng nét vẽ khỏi bề mặt theo pháp tuyến (hàm) hoặc +y (số). */
  lift?: number | ((p: THREE.Vector3) => THREE.Vector3);
  color?: THREE.ColorRepresentation;
  /** Bề rộng nét (px màn hình, mặc định 3). */
  width?: number;
  maxPoints?: number;
  priority?: number;
  hint?: PointerTarget['hint'];
  /** Mỗi điểm mới (final = nhả chuột) – điểm thế giới. */
  onStroke?(points: THREE.Vector3[], final: boolean): void;
}

export interface Sketch {
  readonly points: THREE.Vector3[];
  /** Nét vẽ (Line2 – `material.color`, `material.linewidth`, `visible`). */
  line: Line2;
  clear(): void;
  /** Đặt nét bằng mã (demo/khôi phục). */
  setPoints(pts: THREE.Vector3[]): void;
}

/** Vẽ đường/tuyến bằng chuột trên bề mặt (nét liền vẽ đè, không bị che). */
export function createSketch(ctx: InteractCtx, o: SketchOptions): Sketch {
  const hub = pointerHub(ctx);
  const max = Math.max(2, o.maxPoints ?? 512);
  // Line2 (nét có bề rộng thật, như bút): đoạn i = (điểm i, điểm i+1), cấp phát một lần, chỉ vẽ `instanceCount` đoạn đầu.
  const segs = new Float32Array((max - 1) * 6);
  const geo = ctx.track(new LineGeometry());
  geo.setPositions(segs);
  geo.instanceCount = 0;
  const mat = ctx.track(new LineMaterial({ color: new THREE.Color(o.color ?? 0xfbbf24).getHex(), linewidth: o.width ?? 3, depthTest: false, transparent: true, toneMapped: false }));
  const line = new Line2(geo, mat);
  line.renderOrder = 997;
  line.frustumCulled = false;
  line.raycast = () => {};
  ctx.scene.add(line);
  const points: THREE.Vector3[] = [];
  const shown = (p: THREE.Vector3) => (typeof o.lift === 'function' ? o.lift(p) : p.clone().setY(p.y + (o.lift ?? 0)));
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const redraw = () => {
    const n = Math.min(points.length, max);
    for (let i = 0; i + 1 < n; i++) {
      (i === 0 ? a.copy(shown(points[0])) : a.copy(b)).toArray(segs, i * 6);
      b.copy(shown(points[i + 1])).toArray(segs, i * 6 + 3);
    }
    (geo.attributes.instanceStart as THREE.InterleavedBufferAttribute).data.needsUpdate = true;
    geo.instanceCount = Math.max(0, n - 1);
  };
  const hit = new THREE.Vector3();
  const remove = hub.add({
    object: o.surface,
    priority: o.priority ?? -1,
    cursor: 'crosshair',
    hint: o.hint ?? labText('t_d14d548ff243'),
    enabled: o.active,
    onDown(_h, p) {
      if (!o.constraint.project(p.ray, hit)) return false;
      points.length = 0;
      points.push(hit.clone());
      redraw();
      return {
        cursor: 'crosshair',
        move(q) {
          if (!o.constraint.project(q.ray, hit) || points.length >= max) return;
          if (hit.distanceTo(points[points.length - 1]) < o.minStep) return;
          points.push(hit.clone());
          redraw();
          o.onStroke?.(points, false);
        },
        end() {
          o.onStroke?.(points, true);
        },
      };
    },
  });
  ctx.track(remove);
  return {
    points,
    line,
    clear() {
      points.length = 0;
      redraw();
    },
    setPoints(pts) {
      points.length = 0;
      points.push(...pts.map((p) => p.clone()));
      redraw();
    },
  };
}
