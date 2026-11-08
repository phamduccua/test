import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { fromML, mm } from '../units';
import { createGraduations, type GradMark } from './graduations';
import { levelForVolume, type VesselProfile } from './profile';
import {
  BEAKER_SIZES,
  beakerProfile,
  cylinderProfile,
  erlenmeyerProfile,
  roundFlaskProfile,
  testTubeProfile,
  type BeakerSize,
  type ErlenmeyerSize,
} from './shapes';
import { createVessel, type Vessel } from './vessel';

/** Vạch theo thể tích: mỗi `step` mL, vạch chính mỗi `major` mL (có số). */
function volumeMarks(p: VesselProfile, max: number, step: number, major: number, from = step): GradMark[] {
  const out: GradMark[] = [];
  for (let v = from; v <= max + 1e-6; v += step) {
    const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    out.push({ y: levelForVolume(p.inner, fromML(v)), major: isMajor, label: isMajor ? String(v) : undefined });
  }
  return out;
}

/** A-ONG-NGHIEM – ống nghiệm (mặc định 16×160 mm). */
export function createTestTube(ctx: Tracker, diameter = 16, length = 160): Vessel {
  return createVessel(ctx, testTubeProfile(diameter, length), { name: 'test-tube', segments: 48 });
}

/** Bước vạch / vạch chính (mL) theo cỡ cốc. */
const BEAKER_GRAD: Record<BeakerSize, [number, number]> = { 50: [10, 20], 100: [10, 20], 150: [25, 50], 250: [25, 50], 500: [50, 100], 1000: [100, 200] };

/** A-COC-50/100/150/250/500/1000 – cốc có mỏ rót và vạch chia. */
export function createBeaker(ctx: Tracker, size: BeakerSize = 250): Vessel {
  const s = BEAKER_SIZES[size];
  const v = createVessel(ctx, beakerProfile(s.d, s.h, s.wall), { name: `beaker-${size}` });
  const [step, major] = BEAKER_GRAD[size];
  const marks = volumeMarks(v.profile, size * 0.8, step, major, step * 2);
  v.group.add(createGraduations(ctx, v.profile, { marks, title: `${size} mL`, arc: 0.9 }));
  // Mỏ rót: nửa vòng xuyến nhỏ nhô ra ở miệng (phía +x).
  const R = s.d / 2;
  const spout = new THREE.Mesh(
    new THREE.TorusGeometry(mm(5.5), mm(s.wall * 0.7), 8, 20, Math.PI),
    labMaterials(ctx).glass(),
  );
  spout.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
  spout.rotation.order = 'YXZ';
  spout.position.set(mm(R - 4), v.mouthY - mm(0.3), 0);
  spout.rotateX(-0.35);
  v.group.add(spout);
  return v;
}

/** A-BINH-TAM-GIAC 50/100/250/500 mL. */
export function createErlenmeyer(ctx: Tracker, size: ErlenmeyerSize = 250): Vessel {
  const v = createVessel(ctx, erlenmeyerProfile(size), { name: `erlenmeyer-${size}` });
  const step = { 50: 10, 100: 25, 250: 50, 500: 100 }[size];
  const marks = volumeMarks(v.profile, size * 0.8, step, step * 2, step);
  v.group.add(createGraduations(ctx, v.profile, { marks, title: `${size} mL`, arc: 0.8 }));
  return v;
}

/** A-BINH-CAU – bình cầu; `sideArm` thêm nhánh (bình Wurtz). */
export function createRoundFlask(
  ctx: Tracker,
  o: { diameter?: number; neckD?: number; neckLen?: number; flatBottom?: boolean; sideArm?: boolean } = {},
): Vessel {
  const p = roundFlaskProfile(o.diameter ?? 85, o.neckD ?? 30, o.neckLen ?? 80, o.flatBottom ?? false);
  const v = createVessel(ctx, p, { name: 'round-flask' });
  if (o.sideArm) {
    const y = p.height - mm(25);
    const r = p.outer[p.outer.length - 1].r - mm(1.5);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(r - mm(2), y, 0),
      new THREE.Vector3(r + mm(30), y - mm(18), 0),
      new THREE.Vector3(r + mm(70), y - mm(45), 0),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, mm(3.5), 12), labMaterials(ctx).glass());
    v.group.add(arm);
  }
  return v;
}

/** A-ONG-DONG – ống đong 10/50/100 mL với đế lục giác. */
export function createGraduatedCylinder(ctx: Tracker, size: 10 | 50 | 100 = 100): Vessel {
  const dims = size === 10 ? { d: 16, h: 140, b: 50 } : size === 50 ? { d: 24, h: 200, b: 60 } : { d: 30, h: 250, b: 72 };
  const base = mm(7);
  const p = cylinderProfile(dims.d, dims.h);
  const v = createVessel(ctx, p, { name: `cylinder-${size}` });
  v.glass.position.y = base;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(mm(dims.b / 2), mm(dims.b / 2 + 2), base, 6), labMaterials(ctx).bluePlastic());
  foot.position.y = base / 2;
  foot.castShadow = foot.receiveShadow = true;
  v.group.add(foot);
  const step = size === 10 ? 1 : size === 50 ? 5 : 10;
  const marks = volumeMarks(p, size, step, step * (size === 100 ? 1 : 2), step);
  const grads = createGraduations(ctx, p, { marks, title: `${size} mL`, arc: 1.4 });
  grads.position.y = base;
  v.group.add(grads);
  v.mouthY += base;
  v.mouth.position.y = v.mouthY;
  return v;
}
