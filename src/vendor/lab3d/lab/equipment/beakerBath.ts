import * as THREE from 'three';
import { createBubbles } from '../effects/bubbles';
import { createParticles } from '../effects/particles';
import { createGraduations } from '../glassware/graduations';
import { beakerProfile } from '../glassware/shapes';
import { levelForVolume } from '../glassware/profile';
import { createVessel, latheFromProfile, type Vessel } from '../glassware/vessel';
import { liquidInner, liquidShape } from '../liquid/meniscus';
import { createContactShadow } from '../room/contactShadow';
import type { Tracker } from '../types';
import { fromML, mm } from '../units';
import { createAlcoholLamp, type AlcoholLamp } from './alcoholLamp';
import { createThermometer, type Thermometer } from './thermometer';
import { createTripodGauze, type TripodGauze } from './tripodGauze';

/**
 * A-CACH-THUY / A-NUOC-SOI: đun cách thuỷ kiểu SGK – đèn cồn + kiềng lưới + cốc thuỷ tinh chứa nước (+ nhiệt kế cắm trong nước).
 * Cốc & nước là vật liệu `transparent` (không transmission) để ống nghiệm (transmission) đặt bên trong vẫn hiện; thành cốc có viền Fresnel
 * tối dần ở mép (đọc ra là thuỷ tinh, không trắng đục). Bọt nhỏ từ ~75 °C, sôi sùng sục ở 100 °C, hơi nước từ ~70 °C.
 * Gốc = tâm đáy đèn cồn trên mặt bàn. Mặc định cốc 250 mL (Ø70 × 95 mm) chứa 180 mL nước, lưới ở 146 mm.
 */
export interface BeakerBathOptions {
  /** Cốc: đường kính, cao, bề dày thành (mm). Mặc định 70 × 95 × 1,5. */
  beaker?: [number, number, number];
  waterML?: number;
  /** Độ cao mặt lưới (đv) – ngọn lửa đèn cồn vừa chạm lưới ở ≈ mm(146). */
  gauzeY?: number;
  lit?: boolean;
  /** Nhiệt độ ban đầu (°C). */
  temperature?: number;
  thermometer?: boolean;
  /** Vạch chia + chữ dung tích trên cốc (vd. '500 mL') – vạch mỗi 50 mL. */
  graduations?: string;
  /** Số chỗ đặt ống (xếp vòng quanh tâm, mặc định 1 lệch phải). */
  slots?: number;
}

export interface BeakerBath {
  group: THREE.Group;
  lamp: AlcoholLamp;
  tripod: TripodGauze;
  beaker: Vessel;
  thermometer: Thermometer | null;
  /** Đáy ống đặt trong cốc (cục bộ group). */
  slots: THREE.Vector3[];
  /** Mặt nước (cục bộ group). */
  waterY: number;
  /** Miệng cốc (cục bộ group). */
  mouth: THREE.Vector3;
  readonly temperature: number;
  readonly boiling: boolean;
  setLit(on: boolean): void;
  setTemperature(T: number): void;
  update(dt: number, elapsed: number): void;
  reset(): void;
}

/** Viền Fresnel cho kính/nước transparent: giữa gần trong suốt, mép nhìn xiên đặc + ngả màu `tint`. */
export function fresnelEdge(mat: THREE.MeshPhysicalMaterial, edge: number, tint: number): THREE.MeshPhysicalMaterial {
  const c = new THREE.Color(tint);
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
      float fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.2);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)}), fr * 0.7);
      gl_FragColor.a = clamp(gl_FragColor.a + fr * ${edge.toFixed(2)}, 0.0, 1.0);`,
    );
  };
  mat.customProgramCacheKey = () => `lab-fresnel-${edge.toFixed(2)}-${tint}`;
  return mat;
}

export function createBeakerBath(ctx: Tracker, o: BeakerBathOptions = {}): BeakerBath {
  const [bd, bh, bw] = o.beaker ?? [70, 95, 1.5];
  const gauzeY = o.gauzeY ?? mm(146);
  const group = new THREE.Group();
  group.name = 'beaker-bath';
  const lamp = createAlcoholLamp(ctx, { lit: o.lit ?? false });
  lamp.group.add(createContactShadow(ctx, mm(48), 0.45));
  const tripod = createTripodGauze(ctx, { height: gauzeY });
  group.add(lamp.group, tripod.group);
  const prof = beakerProfile(bd, bh, bw);
  const glassMat = fresnelEdge(ctx.track(new THREE.MeshPhysicalMaterial({
    color: 0xe4f2f7, roughness: 0.03, transparent: true, opacity: 0.08, depthWrite: false, clearcoat: 1, envMapIntensity: 1.8,
  })), 0.6, 0x5f8396);
  const beaker = createVessel(ctx, prof, { material: glassMat, name: 'bath-beaker' });
  beaker.group.position.y = tripod.topY;
  group.add(beaker.group);
  // Viền miệng + đáy tối để thấy mép cốc trên nền sáng.
  const edgeMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0x6f93a6, roughness: 0.2, transparent: true, opacity: 0.75, depthWrite: false }));
  for (const [y, r] of [[mm(bh), mm(bd / 2 + 1)], [mm(1.2), mm(bd / 2 - 0.5)]]) {
    const rim = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(r, mm(1.1), 6, 64)), edgeMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y;
    beaker.group.add(rim);
  }
  if (o.graduations) {
    const ml = (v: number) => levelForVolume(prof.inner, fromML(v));
    const cap = parseFloat(o.graduations) || 250;
    const marks = Array.from({ length: Math.floor((cap * 0.8) / 50) }, (_, i) => (i + 1) * 50).filter((v) => v >= 50);
    beaker.group.add(createGraduations(ctx, prof, {
      marks: marks.map((v) => ({ y: ml(v), major: v % 100 === 0, label: v % 100 === 0 ? `${v}` : undefined })), title: o.graduations,
    }));
  }
  const level = levelForVolume(prof.inner, fromML(o.waterML ?? 180));
  const waterMat = fresnelEdge(ctx.track(new THREE.MeshPhysicalMaterial({
    color: 0x9ccbe8, roughness: 0.08, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 0.6,
  })), 0.4, 0x4f8fb8);
  const shape = liquidShape(liquidInner(prof.inner, mm(0.3)), level, mm(2));
  const water = new THREE.Mesh(ctx.track(latheFromProfile(shape!.points, 56)), waterMat);
  water.renderOrder = 1;
  beaker.group.add(water);
  const r = mm(bd / 2 - 9);
  const bubbles = createBubbles(ctx, prof, { surface: () => level, rate: 0, sizeMin: mm(0.8), sizeMax: mm(2.4), rise: 0.4, maxCount: 90, source: { radius: r, y: mm(3) } });
  beaker.group.add(bubbles.mesh);
  const steam = createParticles(ctx, {
    preset: 'steam', origin: new THREE.Vector3(0, mm(bh + 4), 0),
    config: { rate: 0, emitRadius: r, velocity: [0, 0.14, 0], opacity: 0.26, size: [0.05, 0.32], maxCount: 130 },
  });
  beaker.group.add(steam.points);
  let thermometer: Thermometer | null = null;
  if (o.thermometer) {
    thermometer = createThermometer(ctx, { min: -10, max: 110, value: o.temperature ?? 25 });
    // Thân (Ø7) ngả về sau-trái, tựa vào mép trong miệng cốc: chân lùi vào phía tâm vừa đủ để thân qua miệng cách thành trong 1 mm
    // (trước đây chân sát thành, thân ngả ra ngoài nên xuyên qua thành cốc 10–12 mm).
    const rot = new THREE.Euler(-0.1, 0, 0.16);
    const dir = new THREE.Vector3(0, 1, 0).applyEuler(rot);
    const lean = Math.hypot(dir.x, dir.z);
    const reach = ((mm(bh) - mm(3)) / dir.y) * lean;
    const foot = Math.max(0, mm(bd / 2 - bw) - mm(3.5 + 1) - reach);
    thermometer.group.position.set((dir.x / lean) * foot, tripod.topY + mm(3), (dir.z / lean) * foot);
    thermometer.group.rotation.copy(rot);
    group.add(thermometer.group);
  }
  const n = o.slots ?? 1;
  const slots = n === 1
    ? [new THREE.Vector3(mm(bd * 0.17), tripod.topY + mm(2), mm(bd * 0.08))]
    : Array.from({ length: n }, (_, k) => {
        const a = Math.PI * 0.5 - (k - (n - 1) / 2) * 0.95;
        return new THREE.Vector3(Math.cos(a) * mm(bd / 4), tripod.topY + mm(2), Math.sin(a) * mm(bd / 4));
      });
  let T = o.temperature ?? 25;
  let heat = 0;
  const boiling = () => lamp.lit && T >= 99.5;
  return {
    group,
    lamp,
    tripod,
    beaker,
    thermometer,
    slots,
    waterY: tripod.topY + level,
    mouth: new THREE.Vector3(0, tripod.topY + mm(bh), 0),
    get temperature() {
      return T;
    },
    get boiling() {
      return boiling();
    },
    setLit(on) {
      if (lamp.lit !== on) lamp.setLit(on);
    },
    setTemperature(v) {
      T = v;
      thermometer?.setTemperature(v);
    },
    update(dt, elapsed) {
      heat += ((lamp.lit ? 0.4 : 0) - heat) * Math.min(1, dt * 0.8);
      tripod.setHeat(heat);
      lamp.update(dt, elapsed);
      thermometer?.update(dt);
      bubbles.rate = boiling() ? 36 : lamp.lit && T > 75 ? ((T - 75) / 25) * 8 : 0;
      bubbles.update(dt);
      steam.config.rate = T > 70 ? (T - 70) * 1.1 : 0;
      steam.update(dt);
    },
    reset() {
      heat = 0;
      tripod.setHeat(0);
      bubbles.clear();
      steam.clear();
      lamp.setLit(o.lit ?? false);
      T = o.temperature ?? 25;
      thermometer?.setTemperature(T, true);
    },
  };
}
