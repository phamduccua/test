import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';
import { boxAdder, createLcd, type Lcd } from './parts';

/**
 * A-MAY-LAC: máy lắc tròn ổn nhiệt để bàn (đơn vị dm, gốc = giữa đáy, mặt trước +z): thân máy + bảng LCD và núm tốc độ ở mặt trước,
 * mâm thép phủ thảm cao su lắc theo quỹ đạo tròn biên độ `orbit`. Đặt đĩa / bình lên `deck` (con của mâm), hoặc để vật đứng riêng rồi
 * cộng `offset` mỗi frame (vật do createGrabbable quản lí). Núm `knob` xoay quanh z cục bộ (mặt núm +z) – dùng với createKnob
 * (`axis: 'z'`, `angles: SHAKER_KNOB_ANGLES`).
 */
export interface OrbitalShaker {
  group: THREE.Group;
  /** Mâm lắc (gốc ở mặt thảm cao su, giữa mâm). */
  deck: THREE.Group;
  /** Độ cao mặt thảm (cục bộ group) khi đứng yên. */
  deckY: number;
  knob: THREE.Group;
  lcd: Lcd;
  /** Độ dời mâm khỏi chỗ đứng yên lúc này (cục bộ group). */
  readonly offset: THREE.Vector3;
  /** Vòng/phút thật (biên độ hình ảnh tăng/giảm dần). */
  setSpeed(rpm: number): void;
  readonly speed: number;
  /** Màn: tốc độ, nhiệt độ, dòng phụ (giờ hẹn…). */
  setDisplay(rpm: number, tempC: number, sub?: string): void;
  update(dt: number): void;
}

export interface OrbitalShakerOptions {
  width?: number;
  depth?: number;
  height?: number;
  /** Biên độ quỹ đạo (dm, mặc định 10 mm). */
  orbit?: number;
  accent?: LabAccent | (string & {});
}

/** Góc núm (rad quanh z cục bộ) ở min / max: vặn theo chiều kim đồng hồ để tăng. */
export const SHAKER_KNOB_ANGLES: [number, number] = [Math.PI * 0.75, -Math.PI * 0.75];

export function createOrbitalShaker(ctx: Tracker, o: OrbitalShakerOptions = {}): OrbitalShaker {
  const W = o.width ?? 2.4;
  const D = o.depth ?? 1.4;
  const H = o.height ?? 0.46;
  const orbit = o.orbit ?? mm(10);
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'orbital-shaker';
  const box = boxAdder(ctx, group, 0.05);
  box(W, H, D, 0, H / 2, 0, mats.device());
  box(W + 0.02, 0.06, D + 0.02, 0, 0.03, 0, mats.plastic(o.accent ?? 'teal'));
  // Bảng điều khiển nghiêng nhẹ ở mặt trước: LCD bên trái, núm bên phải.
  const panel = new THREE.Group();
  panel.position.set(0, H * 0.52, D / 2 + 0.004);
  group.add(panel);
  box(W * 0.62, H * 0.62, 0.02, 0, 0, 0, mats.panel(), panel);
  const lcd = createLcd(ctx, W * 0.3, H * 0.4, 256);
  lcd.mesh.position.set(-W * 0.12, 0, 0.012);
  panel.add(lcd.mesh);
  const knob = new THREE.Group();
  knob.position.set(W * 0.2, 0, 0.012);
  panel.add(knob);
  const r = Math.min(0.13, H * 0.26);
  const body = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(r, r * 1.08, 0.08, 28)), mats.trim());
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.04;
  const mark = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(r * 0.2, r * 0.8, 0.012)), ctx.track(new THREE.MeshBasicMaterial({ color: 0xffc94d, toneMapped: false })));
  mark.position.set(0, r * 0.45, 0.082);
  knob.add(body, mark);
  knob.traverse((m) => (m.castShadow = true));
  const tickMat = ctx.track(new THREE.MeshBasicMaterial({ color: 0xc9d3dc, toneMapped: false }));
  const tickGeo = ctx.track(new THREE.PlaneGeometry(0.01, 0.035));
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI / 2 + THREE.MathUtils.lerp(SHAKER_KNOB_ANGLES[0], SHAKER_KNOB_ANGLES[1], i / 6);
    const t = new THREE.Mesh(tickGeo, tickMat);
    t.position.set(knob.position.x + Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45, 0.012);
    t.rotation.z = a - Math.PI / 2;
    panel.add(t);
  }
  // Mâm: thép + thảm cao su sẫm (vật đặt lên không trượt), bốn chân đỡ trên trục lệch tâm (ẩn trong thân).
  const deckY = H + 0.07;
  const deck = new THREE.Group();
  deck.position.y = deckY;
  group.add(deck);
  box(W - 0.12, 0.04, D - 0.12, 0, -0.05, 0, mats.steel(), deck);
  box(W - 0.2, 0.02, D - 0.2, 0, -0.02, 0, mats.blackRubber(), deck);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.08, 0.06, 0.08, sx * (W / 2 - 0.3), -0.09, sz * (D / 2 - 0.3), mats.trim(), group);
  let rpm = 0;
  let amp = 0;
  let phase = 0;
  const offset = new THREE.Vector3();
  const api: OrbitalShaker = {
    group,
    deck,
    deckY,
    knob,
    lcd,
    offset,
    setSpeed(v) {
      rpm = Math.max(0, v);
    },
    get speed() {
      return rpm;
    },
    setDisplay(v, T, sub = '') {
      lcd.draw((g, w, h) => {
        g.fillStyle = '#0b1a12';
        g.fillRect(0, 0, w, h);
        g.textBaseline = 'middle';
        g.fillStyle = '#5dff9a';
        g.font = `bold ${Math.round(h * 0.42)}px monospace`;
        g.fillText(`${Math.round(v)} rpm`, 8, h * 0.32);
        g.font = `bold ${Math.round(h * 0.3)}px monospace`;
        g.fillStyle = '#ffd36b';
        g.fillText(`${T.toFixed(1).replace('.', ',')}°C ${sub}`, 8, h * 0.76);
      });
    },
    update(dt) {
      amp += ((rpm > 0.5 ? 1 : 0) - amp) * Math.min(1, dt * 2.5);
      // Quỹ đạo hình ảnh tối đa 1,2 vòng/s (máy thật 40 vòng/phút ≈ 0,7 vòng/s).
      phase += dt * Math.min(rpm / 60, 1.2) * Math.PI * 2;
      offset.set(Math.cos(phase) * orbit * amp, 0, Math.sin(phase) * orbit * amp);
      deck.position.set(offset.x, deckY, offset.z);
    },
  };
  api.setDisplay(0, 25);
  return api;
}
