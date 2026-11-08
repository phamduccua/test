import * as THREE from 'three';
import { createOrbitalCloud, type OrbitalCloud } from './cloud';
import { isoForEnclosed } from './grid';
import type { OrbitalQN } from './hydrogen';
import { createIsosurface, type Isosurface } from './isosurface';
import { orbitalName } from './names';
import { orbitalField, type OrbitalField, type OrbitalGridOptions } from './orbitalGrid';
import { rng, sampleDensity } from './sampling';

export type OrbitalDisplay = 'surface' | 'cloud' | 'none';

export interface OrbitalModelOptions extends OrbitalGridOptions {
  /** Xác suất bao của mặt đẳng trị (0…1), mặc định 0,9. */
  enclosed?: number;
  display?: OrbitalDisplay;
  pos?: THREE.ColorRepresentation;
  neg?: THREE.ColorRepresentation;
  opacity?: number;
  /** Số điểm của mây xác suất. */
  points?: number;
  pointSize?: number;
}

export interface OrbitalModel {
  qn: OrbitalQN;
  name: string;
  field: OrbitalField;
  group: THREE.Group;
  /** Đẳng trị |ψ| hiện tại. */
  level: number;
  setEnclosed(p: number): void;
  setDisplay(d: OrbitalDisplay): void;
  setColors(pos: THREE.ColorRepresentation, neg: THREE.ColorRepresentation): void;
  setOpacity(o: number): void;
  setClipping(planes: THREE.Plane[] | null): void;
  dispose(): void;
}

/**
 * Một orbital thực ψ_nlm hoàn chỉnh: mặt đẳng trị (marching tetrahedra, 2 pha) + mây điểm |ψ|² (tạo lười).
 * Toạ độ cảnh theo `frame` (mặc định BOOK_FRAME: z hoá học hướng lên). Người gọi gọi `dispose()`.
 */
export function createOrbitalModel(qn: OrbitalQN, o: OrbitalModelOptions = {}): OrbitalModel {
  const field = orbitalField(qn, o);
  const group = new THREE.Group();
  group.name = `orbital-${orbitalName(qn)}`;
  let colors: [THREE.ColorRepresentation, THREE.ColorRepresentation] = [o.pos ?? 0x3b9bff, o.neg ?? 0xff8a3d];
  let opacity = o.opacity ?? 0.45;
  let clip: THREE.Plane[] | null = null;
  let surface: Isosurface | null = null;
  let cloud: OrbitalCloud | null = null;

  const model: OrbitalModel = {
    qn,
    name: orbitalName(qn),
    field,
    group,
    level: isoForEnclosed(field.grid, o.enclosed ?? 0.9),
    setEnclosed(p) {
      model.level = isoForEnclosed(field.grid, p);
      surface?.setLevel(model.level);
    },
    setDisplay(d) {
      if (d === 'surface' && !surface) {
        surface = createIsosurface(field.grid, { level: model.level, pos: colors[0], neg: colors[1], opacity });
        surface.setClipping(clip);
        group.add(surface.group);
      }
      if (d === 'cloud' && !cloud) {
        const pts = sampleDensity(field.grid, o.points ?? 16000, rng(qn.n * 97 + qn.l * 13 + qn.m + 5));
        cloud = createOrbitalCloud(pts, { pos: colors[0], neg: colors[1], size: o.pointSize ?? field.half * 0.026 });
        group.add(cloud.points);
      }
      if (surface) surface.group.visible = d === 'surface';
      if (cloud) cloud.points.visible = d === 'cloud';
    },
    setColors(pos, neg) {
      colors = [pos, neg];
      surface?.setColors(pos, neg);
      cloud?.setColors(pos, neg);
    },
    setOpacity(op) {
      opacity = op;
      surface?.setOpacity(op);
      cloud?.setOpacity(Math.min(1, 0.35 + op));
    },
    setClipping(planes) {
      clip = planes;
      surface?.setClipping(planes);
      if (cloud) {
        (cloud.points.material as THREE.Material).clippingPlanes = planes;
        (cloud.points.material as THREE.Material).needsUpdate = true;
      }
    },
    dispose() {
      surface?.dispose();
      cloud?.dispose();
      group.removeFromParent();
    },
  };
  model.setDisplay(o.display ?? 'surface');
  return model;
}
