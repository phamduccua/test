import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { labMaterials } from '../materials/kit';
import { accentColor, LAB_PALETTE, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface ClockOptions {
  /** 'desk' = đồng hồ để bàn (chân đế, ngả ra sau), 'wall' = đồng hồ treo tường (gốc ở tâm mặt sau, mặt hướng +z). */
  kind?: 'desk' | 'wall';
  /** Đường kính mặt (mm). Mặc định 84 (để bàn) / 300 (treo tường). */
  size?: number;
  /** Màu vỏ (tên LAB_ACCENT hoặc mã). Mặc định 'blue' (để bàn) / trim (treo tường). */
  color?: LabAccent | string;
  /** Có kim giây (đỏ). Mặc định có. */
  seconds?: boolean;
  /** Kim giây nhảy từng giây (mặc định) hay quét mượt. */
  tick?: boolean;
  /** Chữ nhỏ trên mặt (dưới tâm), vd. 'Giờ ủ'. */
  label?: string;
}

export interface LabClock {
  group: THREE.Group;
  /** Tâm mặt đồng hồ (để đặt nhãn / camera). */
  face: THREE.Object3D;
  hands: { hour: THREE.Object3D; minute: THREE.Object3D; second: THREE.Object3D | null };
  /** Giờ trong ngày theo giây (kim giờ, phút, giây quay theo). */
  setTime(seconds: number): void;
  /** Tương thích TN-103-01: thời gian theo giờ tính từ 0:00. */
  setHours(h: number): void;
}

/** Vẽ mặt số: nền giấy ngà, vạch phút, số 1–12 đậm, chữ nhỏ tuỳ chọn. */
function drawDial(g: CanvasRenderingContext2D, S: number, label?: string) {
  const c = S / 2;
  // Mặt ngà (không trắng tinh) – mặt đồng hồ treo tường to, trắng sẽ loá trên máy chiếu.
  g.fillStyle = '#e9e1cc';
  g.beginPath();
  g.arc(c, c, c - 2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = LAB_PALETTE.trim;
  g.fillStyle = LAB_PALETTE.trim;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const major = i % 5 === 0;
    const r0 = c * (major ? 0.82 : 0.88);
    g.lineWidth = S * (major ? 0.022 : 0.008);
    g.beginPath();
    g.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0);
    g.lineTo(c + Math.sin(a) * c * 0.95, c - Math.cos(a) * c * 0.95);
    g.stroke();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(S * 0.12)}px system-ui, sans-serif`;
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillText(String(i), c + Math.sin(a) * c * 0.66, c - Math.cos(a) * c * 0.66 + S * 0.006);
  }
  if (label) {
    g.font = `600 ${Math.round(S * 0.055)}px system-ui, sans-serif`;
    g.fillStyle = '#4b5562';
    g.fillText(label, c, c + S * 0.2);
  }
}

/** A-DONG-HO: đồng hồ kim (để bàn / treo tường), kim chạy theo thời gian sim. Đơn vị dm, số đo theo mm. */
export function createClock(ctx: Tracker, o: ClockOptions = {}): LabClock {
  const mats = labMaterials(ctx);
  const wall = o.kind === 'wall';
  const D = mm(o.size ?? (wall ? 300 : 84));
  const R = D / 2;
  const depth = wall ? D * 0.13 : D * 0.32;
  const group = new THREE.Group();
  group.name = wall ? 'wall-clock' : 'desk-clock';
  const head = new THREE.Group();
  group.add(head);
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = head) => {
    const x = new THREE.Mesh(ctx.track(geo), m);
    x.castShadow = true;
    parent.add(x);
    return x;
  };
  const caseMat = o.color ? mats.plastic(accentColor(o.color)) : wall ? mats.trim() : mats.plastic('blue');
  // Vỏ trụ (trục z), vành mặt kính tối, mặt số canvas.
  mesh(new THREE.CylinderGeometry(R * 1.08, R * 1.08, depth, 56).rotateX(Math.PI / 2).translate(0, 0, -depth / 2), caseMat);
  mesh(new THREE.TorusGeometry(R * 1.04, R * 0.06, 10, 56), wall ? mats.steel() : mats.trim()).position.z = 0;
  const S = 512;
  const { canvas, g } = makeCanvas(S, S);
  drawDial(g, S, o.label);
  const dial = mesh(new THREE.CircleGeometry(R, 56), ctx.track(new THREE.MeshStandardMaterial({ map: ctx.track(canvasTexture(canvas)), roughness: 0.55 })));
  dial.position.z = mm(0.5);
  dial.castShadow = false;
  const face = new THREE.Object3D();
  face.position.z = mm(2);
  head.add(face);
  const hand = (len: number, w: number, m: THREE.Material, z: number, tail = 0.12) => {
    const pivot = new THREE.Group();
    pivot.position.z = z;
    face.add(pivot);
    const blade = mesh(new THREE.BoxGeometry(w, len * (1 + tail), Math.max(mm(0.8), w * 0.25)).translate(0, (len * (1 - tail)) / 2, 0), m, pivot);
    blade.castShadow = false;
    return pivot;
  };
  const hour = hand(R * 0.5, R * 0.075, mats.trim(), mm(0.6));
  const minute = hand(R * 0.78, R * 0.05, mats.trim(), mm(1.2));
  const second = o.seconds === false ? null : hand(R * 0.86, R * 0.018, mats.plastic('red'), mm(1.8), 0.22);
  mesh(new THREE.CylinderGeometry(R * 0.05, R * 0.05, mm(2.4), 16).rotateX(Math.PI / 2), mats.plastic('red'), face).position.z = mm(1.4);
  if (wall) {
    head.position.z = depth;
  } else {
    // Đứng trên hai chân, ngả ra sau 0,2 rad cho dễ đọc từ trên xuống.
    head.position.set(0, R * 1.08 + mm(8), depth / 2);
    head.rotation.x = -0.2;
    for (const s of [-1, 1]) {
      const foot = mesh(new THREE.CylinderGeometry(R * 0.12, R * 0.15, mm(10), 16), mats.trim(), group);
      foot.position.set(s * R * 0.62, mm(5), depth * 0.35);
    }
  }
  const api: LabClock = {
    group,
    face,
    hands: { hour, minute, second },
    setTime(sec) {
      const t = ((sec % 43200) + 43200) % 43200;
      hour.rotation.z = -(t / 43200) * Math.PI * 2;
      minute.rotation.z = -((t % 3600) / 3600) * Math.PI * 2;
      if (second) second.rotation.z = -(((o.tick === false ? t : Math.floor(t)) % 60) / 60) * Math.PI * 2;
    },
    setHours(h) {
      api.setTime(h * 3600);
    },
  };
  api.setTime(10 * 3600 + 10 * 60 + 30);
  return api;
}
