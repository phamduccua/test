import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createParticles } from '../effects/particles';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createMetalMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import type { LabAccent } from '../materials/palette';
import type { Tracker } from '../types';

/**
 * A-BE-ON-NHIET: bể ổn nhiệt điện (thùng inox, nước, tấm giá ống có lỗ, hộp điều khiển LED phía trước).
 * Nước là vật liệu `transparent` (không transmission) để ống nghiệm transmission cắm trong vẫn thấy; hơi nước bốc khi > 45 °C,
 * bọt sôi khi ≥ 98 °C. Vỏ xám xanh (LAB_PALETTE.device), hộp điều khiển tối, núm màu nhận diện. Gốc ở tâm đáy ngoài, mặt trước +z.
 */
export interface WaterBathOptions {
  width?: number;
  depth?: number;
  height?: number;
  slots?: number;
  /** Màu núm + dải chân vỏ (mặc định đỏ). */
  accent?: LabAccent | string;
}

export interface WaterBath {
  group: THREE.Group;
  /** Đáy ống nghiệm ở mỗi lỗ (cục bộ group). */
  slots: THREE.Vector3[];
  /** Độ cao mặt nước (cục bộ). */
  waterY: number;
  /** Núm đặt nhiệt (xoay quanh y cục bộ theo nhiệt độ). */
  knob: THREE.Mesh;
  /** Miệng lỗ giá ống (cục bộ) – vùng thả ống. */
  mouths: THREE.Vector3[];
  setTemperature(T: number): void;
  update(dt: number): void;
}

export function createWaterBath(ctx: Tracker, o: WaterBathOptions = {}): WaterBath {
  const W = o.width ?? 2.6;
  const D = o.depth ?? 1.6;
  const H = o.height ?? 1.3;
  const n = o.slots ?? 4;
  const t = 0.07;
  const group = new THREE.Group();
  group.name = 'water-bath';
  const steel = ctx.track(createMetalMaterial(0xc4c9cf, 0.28, 0.9));
  const mats = labMaterials(ctx);
  const shell = mats.device();
  const accent = mats.plastic(o.accent ?? 'red');
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
    const mesh = new THREE.Mesh(ctx.track(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.02, w / 4, h / 4, d / 4))), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  // Thùng: vỏ nhựa ngoài, lòng inox (đáy + 4 vách mỏng, miệng hở).
  box(W, t, D, 0, t / 2, 0, shell);
  box(t, H, D, -W / 2 + t / 2, H / 2, 0, shell);
  box(t, H, D, W / 2 - t / 2, H / 2, 0, shell);
  box(W, H, t, 0, H / 2, -D / 2 + t / 2, shell);
  box(W, H, t, 0, H / 2, D / 2 - t / 2, shell);
  box(W - 2 * t, 0.01, D - 2 * t, 0, t + 0.005, 0, steel);
  for (const s of [-1, 1]) {
    box(0.01, H - t, D - 2 * t, s * (W / 2 - t - 0.005), (H + t) / 2, 0, steel);
    box(W - 2 * t, H - t, 0.01, 0, (H + t) / 2, s * (D / 2 - t - 0.005), steel);
  }
  // Hộp điều khiển chìa ra trước.
  box(W * 0.9, H * 0.55, 0.32, 0, H * 0.3, D / 2 + 0.16, mats.panel());
  box(W + 0.005, 0.06, D + 0.005, 0, 0.05, 0, accent);
  const { canvas, g } = makeCanvas(256, 64);
  const tex = ctx.track(canvasTexture(canvas));
  const lcd = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(0.9, 0.225)), ctx.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  lcd.position.set(-W * 0.18, H * 0.34, D / 2 + 0.322);
  group.add(lcd);
  const knob = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.09, 0.1, 0.07, 24)), accent);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(W * 0.28, H * 0.34, D / 2 + 0.35);
  group.add(knob);

  const waterY = H * 0.78;
  const water = new THREE.Mesh(
    ctx.track(new THREE.PlaneGeometry(W - 2 * t - 0.02, D - 2 * t - 0.02)),
    ctx.track(new THREE.MeshPhysicalMaterial({ color: 0x9fc9e2, roughness: 0.06, transparent: true, opacity: 0.32, depthWrite: false, envMapIntensity: 0.8 })),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = waterY;
  water.renderOrder = 4;
  group.add(water);
  // Tấm giá ống: thanh inox ngang ở 2/3 chiều cao, lỗ = vòng xuyến.
  const plateY = H * 0.62;
  box(W - 2 * t - 0.04, 0.02, 0.05, 0, plateY, -0.14, steel);
  box(W - 2 * t - 0.04, 0.02, 0.05, 0, plateY, 0.14, steel);
  const ringGeo = ctx.track(new THREE.TorusGeometry(0.095, 0.012, 8, 24));
  const slots: THREE.Vector3[] = [];
  const mouths: THREE.Vector3[] = [];
  const pitch = Math.min(0.5, (W - 0.5) / n);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * pitch;
    const ring = new THREE.Mesh(ringGeo, steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, plateY, 0);
    group.add(ring);
    slots.push(new THREE.Vector3(x, t + 0.12, 0));
    mouths.push(new THREE.Vector3(x, plateY, 0));
  }

  const steam = createParticles(ctx, {
    preset: 'steam',
    origin: new THREE.Vector3(0, waterY + 0.05, 0),
    config: { rate: 0, emitRadius: W * 0.3, velocity: [0, 0.18, 0], opacity: 0.25, size: [0.08, 0.5], maxCount: 120 },
  });
  group.add(steam.points);
  const bubbleGeo = ctx.track(new THREE.SphereGeometry(0.018, 8, 6));
  const bubbles = new THREE.InstancedMesh(bubbleGeo, ctx.track(new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.15, metalness: 0.4 })), 40);
  bubbles.count = 0;
  bubbles.frustumCulled = false;
  group.add(bubbles);
  const bub = Array.from({ length: 40 }, () => ({ x: (Math.random() - 0.5) * (W - 0.4), z: (Math.random() - 0.5) * (D - 0.4), y: Math.random() }));
  const m = new THREE.Matrix4();
  let T = 25;
  const api: WaterBath = {
    group,
    slots,
    waterY,
    knob,
    mouths,
    setTemperature(v) {
      T = v;
      g.fillStyle = '#10140f';
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#ff6a4d';
      g.font = 'bold 36px monospace';
      g.textBaseline = 'middle';
      g.fillText(`${v.toFixed(1).replace('.', ',')}°C`, 14, 33);
      tex.needsUpdate = true;
      knob.rotation.y = -((v - 20) / 80) * 4;
    },
    update(dt) {
      steam.config.rate = T > 45 ? (T - 45) * 0.7 : 0;
      steam.update(dt);
      const boil = T >= 98;
      bubbles.count = boil ? bub.length : 0;
      if (!boil) return;
      bub.forEach((b, i) => {
        b.y += dt * (0.9 + (i % 5) * 0.15);
        if (b.y > 1) b.y = 0;
        m.makeTranslation(b.x, t + 0.02 + b.y * (waterY - t - 0.04), b.z);
        bubbles.setMatrixAt(i, m);
      });
      bubbles.instanceMatrix.needsUpdate = true;
    },
  };
  api.setTemperature(T);
  return api;
}
