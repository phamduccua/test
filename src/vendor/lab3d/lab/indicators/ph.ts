import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { mm } from '../units';
import type { SimContext } from '../../sim/types';
import { labText } from '../../text';

/** Màu giấy chỉ thị vạn năng theo pH (thang 1–10 hay dùng: đỏ → cam → vàng → lục). */
const STOPS: [number, string][] = [[1, '#d7263d'], [3, '#f26b2a'], [4, '#f59a23'], [5, '#f5c223'], [6, '#d9d22a'], [7, '#7fbf3f'], [8, '#2e9e6a'], [10, '#2b5fa8']];

export function phColor(pH: number): THREE.Color {
  const c = new THREE.Color();
  for (let i = 1; i < STOPS.length; i++) {
    if (pH <= STOPS[i][0] || i === STOPS.length - 1) {
      const [a, ca] = STOPS[i - 1];
      const [b, cb] = STOPS[i];
      return c.set(ca).lerp(new THREE.Color(cb), THREE.MathUtils.clamp((pH - a) / (b - a), 0, 1));
    }
  }
  return c;
}

/** A-GIAY-PH: thẻ thang màu 1–10 + mẩu giấy pH (ô màu đổi theo pH dịch dưa). Gốc ở mặt bàn. */
export function createPhCard(ctx: SimContext) {
  const { canvas, g } = makeCanvas(512, 192);
  g.fillStyle = '#fbfaf6';
  g.fillRect(0, 0, 512, 192);
  g.fillStyle = '#333';
  g.font = 'bold 30px system-ui';
  g.fillText(labText('t_401ef4054599'), 16, 38);
  for (let p = 1; p <= 10; p++) {
    const x = 16 + (p - 1) * 48;
    g.fillStyle = `#${phColor(p).getHexString()}`;
    g.fillRect(x, 60, 42, 70);
    g.fillStyle = '#333';
    g.font = '26px system-ui';
    g.fillText(String(p), x + 13, 168);
  }
  const card = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(120), mm(1), mm(45))), [
    ...Array(2).fill(ctx.track(new THREE.MeshStandardMaterial({ color: 0xf2f0ea }))),
    ctx.track(new THREE.MeshStandardMaterial({ map: ctx.track(canvasTexture(canvas)), roughness: 0.8 })),
    ...Array(3).fill(ctx.track(new THREE.MeshStandardMaterial({ color: 0xf2f0ea }))),
  ]);
  card.position.y = mm(0.5);
  card.receiveShadow = true;
  const strip = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(70), mm(0.6), mm(7))), ctx.track(new THREE.MeshStandardMaterial({ color: 0xf6f3e6, roughness: 0.9 })));
  strip.position.set(0, mm(0.3), mm(38));
  const padMat = ctx.track(new THREE.MeshStandardMaterial({ color: phColor(7), roughness: 0.9 }));
  const pad = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(10), mm(0.8), mm(7.2))), padMat);
  pad.position.set(mm(30), mm(0.4), mm(38));
  const group = new THREE.Group();
  group.name = 'giay-ph';
  group.add(card, strip, pad);
  return {
    group,
    /** null = giấy chưa nhúng (màu vàng nhạt của giấy). */
    set(pH: number | null) {
      padMat.color.copy(pH === null ? new THREE.Color(0xe9d98a) : phColor(pH));
    },
  };
}
