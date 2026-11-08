import * as THREE from 'three';
import { chaikin, densify } from '../glassware/curves';
import { buildProfile, radiusAt, type VesselProfile } from '../glassware/profile';
import { createVessel, latheFromProfile, type Vessel } from '../glassware/vessel';
import { createWrapLabel, type WrapLabel } from '../glassware/wrapLabel';
import { createLiquid, type Liquid } from '../liquid/liquid';
import { createGlassMaterial, createPlasticMaterial } from '../materials/factories';
import type { P2, Tracker } from '../types';
import { mm } from '../units';

/** Ống li tâm đáy nón (polycarbonate trong) + nắp vặn + chất lỏng + lớp cặn đục ở đáy. Gốc = mũi đáy ống, trục +y. */
export interface CentrifugeTube {
  group: THREE.Group;
  vessel: Vessel;
  profile: VesselProfile;
  liquid: Liquid;
  cap: THREE.Group;
  label: WrapLabel;
  /** Độ cao miệng (cục bộ). */
  mouthY: number;
  /** Đặt cặn: thể tích (mL) và màu; 0 = không có cặn. */
  setPellet(ml: number, color?: THREE.ColorRepresentation): void;
  readonly pelletML: number;
  setCap(on: boolean): void;
  /** Khối lượng ống + nắp + dịch (g), khối lượng riêng dịch ≈ 1,03 g/mL (cặn đã nằm trong thể tích dịch). */
  mass(): number;
  update(dt: number): void;
}

export interface CentrifugeTubeOptions {
  diameter?: number;
  length?: number;
  capColor?: THREE.ColorRepresentation;
  label?: string;
}

const P = (r: number, y: number): P2 => ({ r: mm(r), y: mm(y) });

/** Profile ống li tâm Ø × L (mm), đáy nón 18 mm. */
export function centrifugeTubeProfile(diameter = 16, length = 100): VesselProfile {
  const R = diameter / 2;
  const pts = [P(0, 0), P(1.6, 0.4), P(R - 0.4, 17), P(R, 19), P(R, length)];
  return buildProfile(densify(chaikin(pts, 3), mm(2.5)), mm(0.9));
}

/** Khối cặn đục theo lòng ống từ đáy trong tới mực `h`. */
function pelletGeometry(inner: P2[], h: number): THREE.LatheGeometry {
  const pts = inner.filter((p) => p.y < h).map((p) => ({ r: Math.max(0, p.r - mm(0.15)), y: p.y }));
  pts.push({ r: Math.max(0, radiusAt(inner, h) - mm(0.15)), y: h }, { r: 0, y: h + mm(0.4) });
  return latheFromProfile([{ r: 0, y: inner[0].y }, ...pts], 32);
}

export function createCentrifugeTube(ctx: Tracker, o: CentrifugeTubeOptions = {}): CentrifugeTube {
  const profile = centrifugeTubeProfile(o.diameter ?? 16, o.length ?? 100);
  const glass = ctx.track(createGlassMaterial({ thickness: mm(1.2), tint: 0xf7fbff }));
  const vessel = createVessel(ctx, profile, { material: glass, name: 'centrifuge-tube' });
  const group = vessel.group;
  const liquid = createLiquid(ctx, profile, { volumeML: 0, meniscus: mm(1.2) });
  group.add(liquid.mesh);
  const R = profile.maxRadius;
  // Nắp vặn: thân có khía + mặt trên.
  const cap = new THREE.Group();
  const capMat = ctx.track(createPlasticMaterial(o.capColor ?? 0xd32f2f, 0.42));
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R + mm(1.3), R + mm(1.3), mm(12), 36, 1), capMat);
  shell.position.y = mm(6);
  const ribGeo = new THREE.BoxGeometry(mm(0.9), mm(10), mm(0.9));
  for (let i = 0; i < 24; i++) {
    const rib = new THREE.Mesh(ribGeo, capMat);
    const a = (i / 24) * Math.PI * 2;
    rib.position.set(Math.cos(a) * (R + mm(1.4)), mm(6), Math.sin(a) * (R + mm(1.4)));
    rib.rotation.y = -a;
    cap.add(rib);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R + mm(0.6), R + mm(1.3), mm(1.2), 36), capMat);
  top.position.y = mm(12.4);
  cap.add(shell, top);
  cap.position.y = profile.height - mm(9);
  cap.traverse((m) => (m.castShadow = true));
  group.add(cap);
  const label = createWrapLabel(ctx, o.label ?? '', { radius: R + mm(0.25), height: mm(14), arc: 1.6, stripe: '#c62828' });
  label.mesh.position.y = profile.height - mm(26);
  group.add(label.mesh);
  const pelletMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0xd9c2b0, roughness: 0.75 }));
  const pellet = new THREE.Mesh(new THREE.BufferGeometry(), pelletMat);
  pellet.visible = false;
  group.add(pellet);
  ctx.track(() => pellet.geometry.dispose());
  let pelletML = 0;

  return {
    group,
    vessel,
    profile,
    liquid,
    cap,
    label,
    mouthY: profile.height,
    get pelletML() {
      return pelletML;
    },
    setPellet(ml, color) {
      if (color !== undefined) pelletMat.color.set(color);
      if (Math.abs(ml - pelletML) < 1e-4 && pellet.visible === ml > 0) return;
      pelletML = ml;
      pellet.visible = ml > 0.002;
      if (!pellet.visible) return;
      // Thể tích nón ≈ πR²h/3 → h theo ml (1 mL = 1e-3 đv³), tối thiểu 0,6 mm để nhìn thấy.
      const r = radiusAt(profile.inner, mm(18));
      const h0 = profile.inner[0].y;
      const h = Math.max(mm(0.6), Math.cbrt((3 * ml * 1e-3) / (Math.PI * (r / mm(17)) ** 2)));
      pellet.geometry.dispose();
      pellet.geometry = pelletGeometry(profile.inner, h0 + h);
    },
    setCap(on) {
      cap.visible = on;
    },
    // Cặn lắng từ chính dịch trong ống (khối lượng bảo toàn) nên không cộng thêm.
    mass: () => 6.2 + 1.03 * liquid.volumeML,
    update(dt) {
      liquid.update(dt);
    },
  };
}
