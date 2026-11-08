import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createPlasticMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';
import { createBindingPost, electricMat, POLE_COLORS } from './parts';
import { labText } from '../../text';

export interface PowerSupply {
  group: THREE.Group;
  plus: THREE.Vector3;
  minus: THREE.Vector3;
  voltage: number;
  /** Cập nhật màn LCD (V, A) và đèn báo. */
  setReading(volts: number, amps: number, on?: boolean): void;
}

/** Bộ nguồn một chiều để bàn: vỏ xám, màn LCD 2 dòng (V/A), núm chỉnh, công tắc, cọc đỏ/đen ở mặt trước (+z). */
/** `body`: màu vỏ (mặc định xám nhạt 0xc9ccd0) – bàn trắng nên dùng LAB_PALETTE.cabinet. */
export function createPowerSupply(ctx: Tracker, o: { voltage?: number; title?: string; body?: string } = {}): PowerSupply {
  const group = new THREE.Group();
  group.name = 'power-supply';
  const W = mm(150);
  const H = mm(80);
  const D = mm(110);
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 3, mm(5)), electricMat(ctx, `psu:${o.body ?? ''}`, () => createPlasticMaterial(o.body ?? 0xc9ccd0, 0.5)));
  body.position.y = H / 2;
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const { canvas, g } = makeCanvas(512, 256);
  const tex = ctx.track(canvasTexture(canvas));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.92, H * 0.86), ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissiveMap: tex, emissive: 0x333333 })));
  panel.position.set(0, H / 2, D / 2 + mm(0.3));
  group.add(panel);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(mm(9), mm(10), mm(10), 24), electricMat(ctx, 'knob', () => createPlasticMaterial(0x1a1c20, 0.4)));
  knob.rotation.x = Math.PI / 2;
  knob.position.set(W * 0.27, H * 0.62, D / 2 + mm(5));
  knob.castShadow = true;
  group.add(knob);
  const posts = [POLE_COLORS.minus, POLE_COLORS.plus].map((c, k) => {
    const p = createBindingPost(ctx, c);
    p.group.rotation.x = Math.PI / 2;
    p.group.position.set(W * (k ? 0.36 : 0.18), H * 0.24, D / 2);
    group.add(p.group);
    return p.group.position.clone().add(new THREE.Vector3(0, 0, p.wirePoint.y));
  });
  const ps: PowerSupply = {
    group, minus: posts[0], plus: posts[1], voltage: o.voltage ?? 3,
    setReading(volts, amps, on = true) {
      g.fillStyle = '#3a3f46';
      g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#e8eaec';
      g.font = 'bold 22px sans-serif';
      g.fillText(o.title ?? labText('t_465c5a613c9f'), 22, 34);
      g.fillStyle = on ? '#0d1a10' : '#141618';
      g.fillRect(22, 52, 250, 170);
      g.fillStyle = on ? '#7dff9a' : '#2a3a2e';
      // Cỡ chữ co theo bề rộng màn (230 px) để số dài không tràn mép.
      const fit = (t: string) => {
        let f = 58;
        g.font = `bold ${f}px monospace`;
        while (f > 24 && g.measureText(t).width > 226) g.font = `bold ${(f -= 2)}px monospace`;
      };
      fit(`${volts.toFixed(2)}V`);
      g.fillText(`${volts.toFixed(2)}V`, 34, 120);
      g.fillStyle = on ? '#ffcf6b' : '#3a3328';
      fit(`${amps.toFixed(3)}A`);
      g.fillText(`${amps.toFixed(3)}A`, 34, 200);
      g.fillStyle = on ? '#ff3b30' : '#552222';
      g.beginPath();
      g.arc(470, 40, 10, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e8eaec';
      g.font = '20px sans-serif';
      g.fillText('−', 330, 236);
      g.fillText('+', 428, 236);
      tex.needsUpdate = true;
    },
  };
  ps.setReading(ps.voltage, 0, true);
  return ps;
}
