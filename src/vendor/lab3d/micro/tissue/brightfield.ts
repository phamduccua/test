import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Tracker } from '../../lab/types';
import { insetPoly, type Pt } from './voronoi';

/**
 * Dựng mô trường sáng (kính hiển vi quang học, không nhuộm) theo µm trên mặt phẳng (x, z), y hướng về vật kính:
 * vành vách tế bào gộp một geometry, mặt lấp bên trong có màu từng ô, và "đốm" InstancedMesh (nhân, lục lạp, hồng cầu…).
 * Đa giác (x, y) → cảnh (x, ·, −y).
 */
export interface PolyCell {
  poly: Pt[];
  center: Pt;
}

/** Vật liệu bán trong kiểu trường sáng: có emissive nhẹ để không tối khi đèn chiếu xiên. */
export function brightfieldMaterial(color: THREE.ColorRepresentation, opacity = 1, o: { emissive?: number } = {}) {
  const c = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({
    color: c,
    emissive: c.clone().multiplyScalar(o.emissive ?? 0.35),
    roughness: 0.55,
    metalness: 0,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
}

/** Vách: mỗi ô một vành (đa giác − đa giác co vào `wall` µm), cao `height`, gộp một mesh. */
export function createWallMesh(ctx: Tracker, cells: PolyCell[], o: { wall: number; height: number; color: THREE.ColorRepresentation; opacity?: number }): THREE.Mesh {
  const geos = cells.map((c) => {
    const shape = new THREE.Shape(c.poly.map((p) => new THREE.Vector2(p[0], p[1])));
    shape.holes.push(new THREE.Path(insetPoly(c.poly, c.center, o.wall).map((p) => new THREE.Vector2(p[0], p[1])).reverse()));
    return new THREE.ExtrudeGeometry(shape, { depth: o.height, bevelEnabled: false, curveSegments: 1 });
  });
  const geo = ctx.track(mergeGeometries(geos));
  geos.forEach((g) => g.dispose());
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, ctx.track(brightfieldMaterial(o.color, o.opacity ?? 1)));
  mesh.name = 'cell-walls';
  return mesh;
}

/** Mặt lấp trong mỗi ô ở độ cao `y` (màu từng ô qua `color(i)`), gộp một mesh dùng vertex color. */
export function createFillMesh(ctx: Tracker, cells: PolyCell[], o: { y: number; inset?: number; opacity?: number; color(i: number): THREE.Color }): THREE.Mesh {
  const geos = cells.map((c, i) => {
    const pts = (o.inset ? insetPoly(c.poly, c.center, o.inset) : c.poly).map((p) => new THREE.Vector2(p[0], p[1]));
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts), 1);
    const col = o.color(i);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) arr.set([col.r, col.g, col.b], k * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    return g;
  });
  const geo = ctx.track(mergeGeometries(geos));
  geos.forEach((g) => g.dispose());
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, o.y, 0);
  // Không chiếu sáng: màu ô = màu ánh sáng truyền qua tế bào (emissive của MeshStandard không nhân vertex color).
  const op = o.opacity ?? 1;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: op < 1, opacity: op, depthWrite: op >= 1 });
  const mesh = new THREE.Mesh(geo, ctx.track(mat));
  mesh.name = 'cell-fills';
  return mesh;
}

export interface Blobs {
  mesh: THREE.InstancedMesh;
  /** Đặt đốm i: vị trí, bán trục (µm), góc quanh y. Bán trục 0 = ẩn. */
  set(i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY?: number): void;
  setColor(i: number, c: THREE.ColorRepresentation): void;
  commit(): void;
}

/** `count` đốm elipsoid (cầu đơn vị co giãn) cùng vật liệu; mặc định ẩn hết. */
export function createBlobs(
  ctx: Tracker,
  count: number,
  o: { color: THREE.ColorRepresentation; opacity?: number; segments?: [number, number]; geometry?: THREE.BufferGeometry; emissive?: number },
): Blobs {
  const geo = o.geometry ?? ctx.track(new THREE.SphereGeometry(1, o.segments?.[0] ?? 12, o.segments?.[1] ?? 8));
  const mesh = new THREE.InstancedMesh(geo, ctx.track(brightfieldMaterial(o.color, o.opacity ?? 1, { emissive: o.emissive })), count);
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  const blobs: Blobs = {
    mesh,
    set(i, x, y, z, sx, sy, sz, rotY = 0) {
      q.setFromAxisAngle(up, rotY);
      m.compose(p.set(x, y, z), q, s.set(sx, sy, sz));
      mesh.setMatrixAt(i, m);
    },
    setColor(i, c) {
      mesh.setColorAt(i, col.set(c));
    },
    commit() {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
  for (let i = 0; i < count; i++) blobs.set(i, 0, 0, 0, 0, 0, 0);
  blobs.commit();
  return blobs;
}
