import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { labMaterials } from '../materials/kit';
import type { SimContext } from '../../sim/types';

/**
 * A-DEN-UV: đèn tử ngoại cầm tay (≈ 26 × 7 × 6 cm), ống đèn nằm dọc trục x ở mặt dưới, có quai cầm.
 * Gốc ở giữa mặt cửa sổ đèn (mặt dưới); chùm tia chiếu xuống −y dài `beam` (đv). Chùm là vật trong suốt cộng màu:
 * chỉ đặt phía trên dụng cụ thuỷ tinh, không lồng vào trong kính.
 */
export interface UvLamp {
  group: THREE.Group;
  readonly on: boolean;
  /** Công tắc trượt trên thân (gốc đèn): tắt ở `switchOff`, bật ở `switchOn` – gắn `createHandle` để gạt bằng tay. */
  switch: THREE.Mesh;
  switchOff: THREE.Vector3;
  switchOn: THREE.Vector3;
  setOn(on: boolean): void;
  update(dt: number): void;
}

export function createUvLamp(ctx: SimContext, o: { beam?: number; label?: string } = {}): UvLamp {
  const mats = labMaterials(ctx);
  const g = new THREE.Group();
  g.name = 'uv-lamp';
  const shell = mats.cabinet();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(ctx.track(geo), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  add(new RoundedBoxGeometry(2.6, 0.5, 0.7, 4, 0.1), shell, 0, 0.27, 0);
  // Cửa sổ lọc tím + ống đèn.
  const tubeMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#2c2340', emissive: '#9d6bff', emissiveIntensity: 0, roughness: 0.2 }));
  add(new THREE.BoxGeometry(2.2, 0.03, 0.46), tubeMat, 0, 0.015, 0);
  add(new THREE.CylinderGeometry(0.07, 0.07, 2.05, 16).rotateZ(Math.PI / 2), tubeMat, 0, 0.09, 0);
  // Quai cầm + công tắc.
  const handle = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(0.75, 0.07, 10, 32, Math.PI)), mats.darkPlastic());
  handle.scale.y = 0.55;
  handle.position.y = 0.5;
  g.add(handle);
  const sw = add(new THREE.BoxGeometry(0.22, 0.06, 0.14), mats.bluePlastic(), 0.64, 0.54, 0);
  const switchOff = new THREE.Vector3(0.64, 0.54, 0);
  const switchOn = new THREE.Vector3(0.76, 0.54, 0);
  const label = o.label ?? 'UV 254 nm';
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 48;
  const c2 = cv.getContext('2d')!;
  c2.fillStyle = '#f2f0ea';
  c2.font = 'bold 30px system-ui';
  c2.textBaseline = 'middle';
  c2.fillText(label, 10, 26);
  const tag = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(1.0, 0.19)), ctx.track(new THREE.MeshBasicMaterial({ map: ctx.track(new THREE.CanvasTexture(cv)), transparent: true })));
  tag.position.set(-0.55, 0.3, 0.352);
  g.add(tag);

  // Chùm tia: nón cụt cộng màu, mờ dần xuống dưới.
  const L = o.beam ?? 1.2;
  const beamGeo = ctx.track(new THREE.CylinderGeometry(1.1, 1.4, L, 32, 6, true).translate(0, -L / 2, 0));
  const pos = beamGeo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = 1 + pos.getY(i) / L; // 1 ở cửa sổ, 0 ở đáy
    colors.set([0.55 * k, 0.35 * k, 1 * k], i * 3);
  }
  beamGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const beamMat = ctx.track(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.scale.set(1, 1, 0.42);
  beam.renderOrder = 5;
  g.add(beam);
  const light = new THREE.PointLight('#a77bff', 0, 3, 1.5);
  light.position.y = -0.3;
  g.add(light);
  let on = false;
  let level = 0;
  let t = 0;
  return {
    group: g,
    get on() {
      return on;
    },
    switch: sw,
    switchOff,
    switchOn,
    setOn(v) {
      on = v;
      sw.position.copy(v ? switchOn : switchOff);
    },
    update(dt) {
      t += dt;
      level += ((on ? 1 : 0) - level) * (1 - Math.exp(-dt * 10));
      const fl = 1 + 0.04 * Math.sin(t * 60);
      tubeMat.emissiveIntensity = 2.2 * level * fl;
      beamMat.opacity = 0.32 * level * fl;
      beam.visible = level > 0.01;
      light.intensity = 1.6 * level;
    },
  };
}
