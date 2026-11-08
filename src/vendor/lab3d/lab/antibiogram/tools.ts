import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createMetalMaterial, createPlasticMaterial } from '../materials/factories';
import { toolSteel } from '../handTools/common';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

/** A-TAM-BONG: tăm bông vô trùng 150 mm (que gỗ Ø2,5 + đầu bông Ø5 × 14). Gốc ở đầu bông, que theo +y. `setWet` = bông thấm dịch. */
export function createSwab(ctx: Tracker): { group: THREE.Group; setWet(k: number): void } {
  const group = new THREE.Group();
  group.name = 'swab';
  const stick = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(1.25), mm(1.25), mm(140), 10)), labMaterials(ctx).wood());
  stick.position.y = mm(75);
  stick.castShadow = true;
  const cottonMat = ctx.track(new THREE.MeshStandardMaterial({ color: '#ece6d6', roughness: 1 }));
  const tip = new THREE.Mesh(ctx.track(new THREE.CapsuleGeometry(mm(2.6), mm(9), 6, 14)), cottonMat);
  tip.position.y = mm(7);
  tip.castShadow = true;
  group.add(stick, tip);
  const dry = new THREE.Color('#ece6d6');
  const wet = new THREE.Color('#d6cbb0');
  return { group, setWet: (k) => void cottonMat.color.copy(dry).lerp(wet, Math.min(1, Math.max(0, k))) };
}

/** A-KEP: kẹp gắp inox 120 mm, hai càng khép ở mũi. Gốc ở mũi kẹp, thân theo +y. */
export function createForceps(ctx: Tracker): THREE.Group {
  const group = new THREE.Group();
  group.name = 'forceps';
  const steel = toolSteel(ctx);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(1.4), mm(120), mm(4))), steel);
    arm.geometry.translate(0, mm(60), 0);
    arm.position.x = s * mm(0.8);
    arm.rotation.z = -s * 0.035;
    arm.castShadow = true;
    group.add(arm);
  }
  return group;
}

/** A-THUOC: thước nhựa vàng kem 150 × 22 mm (bản đầy đủ: createLabRuler), vạch mm/5 mm/cm in đen. Gốc ở vạch 0 (cạnh vạch, −z), thước theo +x, nằm ngang. */
export function createRuler(ctx: Tracker, lengthMM = 150): THREE.Group {
  const W = 1024;
  const H = Math.round((W * 22) / (lengthMM + 10));
  const { canvas, g } = makeCanvas(W, H);
  const k = W / (lengthMM + 10);
  g.fillStyle = '#e9d58c';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1a1d22';
  g.font = `bold ${Math.round(k * 3.2)}px system-ui`;
  g.textAlign = 'center';
  for (let i = 0; i <= lengthMM; i++) {
    const x = (i + 5) * k;
    const len = i % 10 === 0 ? 7 : i % 5 === 0 ? 5 : 3;
    g.fillRect(x - 0.9, 0, 1.8, len * k);
    if (i % 10 === 0) g.fillText(String(i / 10), x, 10.5 * k);
  }
  g.font = `${Math.round(k * 2.4)}px system-ui`;
  g.fillText('mm', W - 6 * k, 18 * k);
  const mat = ctx.track(new THREE.MeshPhysicalMaterial({ map: ctx.track(canvasTexture(canvas)), roughness: 0.25, clearcoat: 0.6 }));
  const side = ctx.track(createPlasticMaterial('#a8995f', 0.4));
  const geo = ctx.track(new THREE.BoxGeometry(mm(lengthMM + 10), mm(1.5), mm(22)));
  const m = new THREE.Mesh(geo, [side, side, mat, side, side, side]);
  m.position.set(mm(lengthMM / 2), mm(0.75), mm(11));
  m.castShadow = true;
  const group = new THREE.Group();
  group.name = 'ruler';
  group.add(m);
  return group;
}

/** A-TU-AM: tủ ấm mini 300 × 320 × 280 mm, cửa kính mở quanh bản lề trái, 2 khay, màn LED. Gốc ở đáy giữa, cửa hướng +z. */
export interface Incubator {
  group: THREE.Group;
  /** Mặt khay dưới (toạ độ group). */
  shelf: THREE.Vector3;
  setDoor(k: number): void;
  setDisplay(lines: string[]): void;
}

export function createIncubator(ctx: Tracker): Incubator {
  const group = new THREE.Group();
  group.name = 'incubator';
  const [w, h, d, t] = [mm(300), mm(320), mm(280), mm(16)];
  const shell = ctx.track(createPlasticMaterial('#eef0f2', 0.45));
  const inner = ctx.track(createMetalMaterial(0xb9bec5, 0.4, 0.8));
  const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material) => {
    const b = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(sx, sy, sz)), m);
    b.position.set(x, y, z);
    b.castShadow = b.receiveShadow = true;
    group.add(b);
    return b;
  };
  box(w, t, d, 0, t / 2, 0, shell);
  box(w, t * 3, d, 0, h - t * 1.5, 0, shell);
  box(t, h, d, -w / 2 + t / 2, h / 2, 0, shell);
  box(t, h, d, w / 2 - t / 2, h / 2, 0, shell);
  box(w, h, t, 0, h / 2, -d / 2 + t / 2, inner);
  const shelfY = mm(90);
  box(w - 2 * t, mm(3), d - t, 0, shelfY, mm(4), inner);
  box(w - 2 * t, mm(3), d - t, 0, mm(195), mm(4), inner);
  const { canvas, g } = makeCanvas(256, 64);
  const tex = ctx.track(canvasTexture(canvas));
  const lcd = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(mm(130), mm(32))), ctx.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  lcd.position.set(0, h - t * 1.5, d / 2 + mm(0.6));
  group.add(lcd);
  const hinge = new THREE.Group();
  hinge.position.set(-w / 2, 0, d / 2 + mm(3));
  group.add(hinge);
  const glass = ctx.track(new THREE.MeshPhysicalMaterial({ color: '#cfe3ea', roughness: 0.08, transparent: true, opacity: 0.22, depthWrite: false }));
  const pane = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(w - mm(10), h - t * 4, mm(4))), glass);
  pane.position.set(w / 2, t + (h - t * 4) / 2, 0);
  pane.renderOrder = 3;
  const frame = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(14), h - t * 4, mm(8))), shell);
  frame.position.set(w - mm(8), t + (h - t * 4) / 2, 0);
  hinge.add(pane, frame);
  return {
    group,
    shelf: new THREE.Vector3(0, shelfY + mm(1.5), mm(10)),
    setDoor: (k) => void (hinge.rotation.y = -1.9 * Math.min(1, Math.max(0, k))),
    setDisplay(lines) {
      g.fillStyle = '#0b1a12';
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#6dff9c';
      g.font = 'bold 24px monospace';
      g.textAlign = 'center';
      g.fillText(lines[0] ?? '', 128, 27);
      g.font = '18px monospace';
      g.fillText(lines[1] ?? '', 128, 53);
      tex.needsUpdate = true;
    },
  };
}
