import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createMetalMaterial, createPlasticMaterial } from '../materials/factories';
import { LAB_ACCENT, LAB_PALETTE } from '../materials/palette';
import type { Tracker } from '../types';

/**
 * A-MAY-DO-DUC: máy đo độ đục / mật độ quang để bàn (OD600) – thân nhựa, giếng cắm ống nghiệm Ø16 trên nóc, màn LCD nghiêng phía trước,
 * đèn báo đo. Ống cắm vào giếng bị thân máy che phần dưới. Gốc ở tâm đáy, mặt trước +z.
 */
export interface Densitometer {
  group: THREE.Group;
  /** Điểm đáy ống khi cắm vào giếng (cục bộ group). */
  well: THREE.Vector3;
  /** Miệng giếng (cục bộ group). */
  mouth: THREE.Vector3;
  /** Hiện số đo (null = "– – –"); `busy` = đang đo (đèn đỏ nhấp nháy). */
  show(value: number | null, note?: string): void;
  setBusy(on: boolean): void;
  update(dt: number): void;
}

export function createDensitometer(ctx: Tracker, o: { title?: string } = {}): Densitometer {
  const W = 1.5;
  const H = 0.8;
  const D = 1.1;
  const group = new THREE.Group();
  group.name = 'densitometer';
  const body = new THREE.Mesh(ctx.track(new RoundedBoxGeometry(W, H, D, 3, 0.06)), ctx.track(createPlasticMaterial(LAB_PALETTE.device, 0.42)));
  body.position.y = H / 2;
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const band = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(W + 0.004, 0.06, D + 0.004)), ctx.track(createPlasticMaterial(LAB_ACCENT.teal, 0.4)));
  band.position.y = 0.06;
  group.add(band);
  // Mặt LCD nghiêng phía trước.
  const face = new THREE.Mesh(ctx.track(new RoundedBoxGeometry(W * 0.9, 0.42, 0.12, 2, 0.03)), ctx.track(createPlasticMaterial(LAB_PALETTE.panel, 0.5)));
  face.position.set(0, H * 0.55, D / 2 + 0.02);
  face.rotation.x = -0.35;
  group.add(face);
  const { canvas, g } = makeCanvas(320, 120);
  const tex = ctx.track(canvasTexture(canvas));
  const lcd = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(W * 0.8, 0.3)), ctx.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  lcd.position.set(0, 0, 0.062);
  face.add(lcd);
  // Giếng: vành kim loại + lòng tối.
  const mouth = new THREE.Vector3(-W * 0.22, H, -D * 0.12);
  const rim = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(0.105, 0.018, 10, 32)), ctx.track(createMetalMaterial(0xb9bec4, 0.3, 0.9)));
  rim.rotation.x = Math.PI / 2;
  rim.position.copy(mouth);
  group.add(rim);
  const hole = new THREE.Mesh(ctx.track(new THREE.CircleGeometry(0.095, 28)), ctx.track(new THREE.MeshBasicMaterial({ color: 0x07080a })));
  hole.rotation.x = -Math.PI / 2;
  hole.position.copy(mouth).add(new THREE.Vector3(0, 0.003, 0));
  group.add(hole);
  const ledMat = ctx.track(new THREE.MeshBasicMaterial({ color: 0x3b0d0d, toneMapped: false }));
  const led = new THREE.Mesh(ctx.track(new THREE.SphereGeometry(0.03, 12, 8)), ledMat);
  led.position.set(W * 0.3, H + 0.005, -D * 0.12);
  group.add(led);
  const title = o.title ?? 'OD600';
  let busy = false;
  let blink = 0;
  const api: Densitometer = {
    group,
    well: mouth.clone().add(new THREE.Vector3(0, -H + 0.1, 0)),
    mouth,
    show(value, note) {
      g.fillStyle = '#c9d8b4';
      g.fillRect(0, 0, 320, 120);
      g.fillStyle = '#26301c';
      g.font = 'bold 20px monospace';
      g.textBaseline = 'top';
      g.fillText(title, 12, 8);
      if (note) g.fillText(note, 120, 8);
      g.font = 'bold 56px monospace';
      g.textAlign = 'right';
      g.fillText(value === null ? '– – –' : value.toFixed(3).replace('.', ','), 306, 46);
      g.textAlign = 'left';
      tex.needsUpdate = true;
    },
    setBusy(on) {
      busy = on;
      if (!on) ledMat.color.set(0x3b0d0d);
    },
    update(dt) {
      if (!busy) return;
      blink += dt;
      ledMat.color.set(Math.floor(blink * 4) % 2 ? 0xff3030 : 0x3b0d0d);
    },
  };
  api.show(null);
  return api;
}
