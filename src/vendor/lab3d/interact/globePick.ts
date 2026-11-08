import * as THREE from 'three';
import { latLonToXYZ, xyzToLatLon, type LatLon } from '../geo/globe/coords';
import { sphereConstraint } from './constraints';
import { createDraggable } from './drag';
import { pointerHub } from './pointer';
import { createSketch, type Sketch } from './sketch';
import type { Binding, InteractCtx, PointerTarget } from './types';
import { labText } from '../text';

export interface GlobeFrame {
  /** Nhóm địa cầu (lat/lon theo hệ cục bộ của nó, quy ước kit/lab3d/geo/globe/coords); bỏ qua = gốc thế giới. */
  frame?: THREE.Object3D;
  /** Bán kính cầu (hệ cục bộ của frame, mặc định 1). */
  radius?: number;
}

const worldCenter = (f: GlobeFrame) => (f.frame ? f.frame.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3());
const worldRadius = (f: GlobeFrame) => (f.radius ?? 1) * (f.frame ? f.frame.getWorldScale(new THREE.Vector3()).x : 1);
/** Điểm thế giới → lat/lon theo frame. */
export function worldToLatLon(f: GlobeFrame, w: THREE.Vector3): LatLon {
  const l = f.frame ? f.frame.worldToLocal(w.clone()) : w.clone();
  return xyzToLatLon(l.x, l.y, l.z);
}
/** lat/lon (+ độ cao tương đối) → điểm thế giới. */
export function latLonToWorld(f: GlobeFrame, ll: LatLon, alt = 0, out = new THREE.Vector3()): THREE.Vector3 {
  out.fromArray(latLonToXYZ(ll.lat, ll.lon, (f.radius ?? 1) * (1 + alt)));
  return f.frame ? f.frame.localToWorld(out) : out;
}

export interface GlobePinOptions extends GlobeFrame {
  /** Ghim (gốc ở chân, trục +y hướng ra ngoài) – được đặt + xoay theo pháp tuyến. */
  pin: THREE.Object3D;
  handle?: THREE.Object3D;
  value: Binding<LatLon>;
  /** Độ nổi chân ghim (tỉ lệ bán kính). */
  altitude?: number;
  hint?: PointerTarget['hint'];
  enabled?(): boolean;
  /** Giới hạn / làm tròn (vd. chỉ trên đất liền, bước 1°). */
  filter?(ll: LatLon): LatLon | null;
  onMove?(ll: LatLon, final: boolean): void;
}

/** Ghim kéo được trên mặt cầu (lat/lon): kéo → value.set; GUI/mô hình đổi value → ghim tự chạy theo. */
export function createGlobePin(ctx: InteractCtx, o: GlobePinOptions) {
  const hub = pointerHub(ctx);
  const up = new THREE.Vector3(0, 1, 0);
  const n = new THREE.Vector3();
  const place = (ll: LatLon) => {
    const w = latLonToWorld(o, ll, o.altitude ?? 0);
    const c = worldCenter(o);
    n.copy(w).sub(c).normalize();
    const parent = o.pin.parent;
    o.pin.position.copy(parent ? parent.worldToLocal(w.clone()) : w);
    const pq = parent ? parent.getWorldQuaternion(new THREE.Quaternion()).invert() : new THREE.Quaternion();
    o.pin.quaternion.setFromUnitVectors(up, n).premultiply(pq);
  };
  let cur = o.value.get();
  const drag = createDraggable(ctx, {
    object: o.pin,
    handle: o.handle,
    keepOffset: false,
    hint: o.hint ?? labText('t_e54bf6d70b17'),
    enabled: o.enabled,
    constraint: sphereConstraint(() => worldCenter(o), worldRadius(o)),
    apply: (w) => {
      const ll = o.filter ? o.filter(worldToLatLon(o, w)) : worldToLatLon(o, w);
      if (!ll) return;
      cur = ll;
      o.value.set(ll);
      place(ll);
      o.onMove?.(ll, false);
    },
    onEnd: () => {
      o.value.commit?.(cur);
      o.onMove?.(cur, true);
    },
  });
  ctx.track(
    hub.onFrame(() => {
      if (drag.dragging) return;
      cur = o.value.get();
      place(cur);
    }),
  );
  place(cur);
  return drag;
}

/** Vẽ tuyến trên địa cầu bằng chuột (khi `active()`), trả điểm lat/lon. */
export function createGlobeSketch(
  ctx: InteractCtx,
  o: GlobeFrame & { surface: THREE.Object3D; active(): boolean; minStepDeg?: number; color?: THREE.ColorRepresentation; onStroke?(pts: LatLon[], final: boolean): void },
): Sketch {
  const r = () => worldRadius(o);
  return createSketch(ctx, {
    surface: o.surface,
    constraint: sphereConstraint(() => worldCenter(o), r()),
    active: o.active,
    minStep: ((o.minStepDeg ?? 0.5) * Math.PI * r()) / 180,
    lift: (p) => p.clone().sub(worldCenter(o)).multiplyScalar(1.004).add(worldCenter(o)),
    color: o.color,
    onStroke: (pts, final) => o.onStroke?.(pts.map((p) => worldToLatLon(o, p)), final),
  });
}
