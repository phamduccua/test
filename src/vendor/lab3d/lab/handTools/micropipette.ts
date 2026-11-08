import * as THREE from 'three';
import { latheFromProfile } from '../glassware/vessel';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createPlasticMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import { accentColor, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, part, type HandTool } from './common';

/** Dải thể tích (µL) – quyết định cỡ tip, màu tip mặc định và giới hạn số trên cửa sổ. */
export type MicropipetteRange = 10 | 20 | 200 | 1000;
const RANGE = {
  10: { min: 0.5, tipLen: 32, tipR: 2.1, tip: '#cdd6dc', color: 'teal' },
  20: { min: 2, tipLen: 46, tipR: 2.6, tip: '#cdd6dc', color: 'orange' },
  200: { min: 20, tipLen: 52, tipR: 3, tip: '#ead27a', color: 'yellow' },
  1000: { min: 100, tipLen: 72, tipR: 4.2, tip: '#5f93d8', color: 'blue' },
} as const;

export interface MicropipetteOptions {
  /** Dải 10 / 20 (mặc định) / 200 / 1000 µL. */
  range?: MicropipetteRange;
  /** Màu nút bấm + vòng nhận diện (mặc định theo dải; TN-038/082 dùng 'blue'). */
  color?: LabAccent | (string & {});
  /** Màu tip rỗng (mặc định: 10/20 µL trong xám, 200 µL vàng, 1000 µL xanh). */
  tipColor?: string;
  /** Thể tích đặt sẵn trên cửa sổ số (µL), mặc định = dải tối đa. */
  volume?: number;
}

export interface Micropipette extends HandTool {
  /** Nút piston (con của group, trục +y) – kéo/ấn bằng `press`. */
  plunger: THREE.Object3D;
  /** Đầu côn gắn tip (con của group). */
  nose: THREE.Object3D;
  /** Dịch trong tip (màu) hay rỗng (null); `fill` 0…1 phần tip có dịch (mặc định 0,45). */
  setLoad(color: THREE.ColorRepresentation | null, fill?: number): void;
  /** Tương thích TN-038-01: on = dịch xanh thuốc nhuộm. */
  setLoaded(on: boolean): void;
  /** Ấn piston 0 (nhả) … 1 (nấc 1) … 1,4 (nấc 2 – thổi hết). */
  press(k: number): void;
  setTip(on: boolean): void;
  readonly hasTip: boolean;
  /** Đặt thể tích (µL, kẹp trong dải) – cửa sổ số hiện 3–4 chữ số. */
  setVolume(ul: number): void;
  readonly volume: number;
  readonly range: MicropipetteRange;
}

const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) });

/**
 * A-MICROPIPET – micropipette 1 kênh: thân cầm ngà (LAB_PALETTE.instrument), móc tì ngón TRIM, vòng + nút piston màu theo dải,
 * cửa sổ số thể tích, tip nhựa thay được. Gốc ở MŨI TIP (khi gắn tip), trục +y – dùng làm `tool` của createDropperGesture.
 * `tip` = mũi tip (gốc), `nose` = đầu côn, `grip` = giữa thân cầm, `plunger` = nút bấm.
 */
export function createMicropipette(ctx: Tracker, o: MicropipetteOptions = {}): Micropipette {
  const range = o.range ?? 20;
  const R = RANGE[range];
  const tl = R.tipLen;
  const group = new THREE.Group();
  group.name = 'micropipette';
  const m = labMaterials(ctx);
  const accent = m.plastic(accentColor(o.color ?? R.color));
  // Tip: nhựa đục (nhúng được vào ống nghiệm transmission mà vẫn thấy).
  const tipColor = new THREE.Color(o.tipColor ?? R.tip);
  const tipMat = ctx.track(createPlasticMaterial(tipColor, 0.32));
  const tipMM: [number, number][] = [[0, 0], [0.45, 0.3], [R.tipR * 0.78, tl * 0.78], [R.tipR, tl], [0, tl]];
  const tipMesh = part(ctx, group, latheFromProfile(tipMM.map(([r, y]) => P(r, y)), 18), tipMat);
  // Dịch trong tip: lớp màu ôm sát mặt ngoài phần dưới tip.
  const loadMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0x3355cc, roughness: 0.3 }));
  /** Bán kính ngoài tip (mm) tại độ cao y (mm) – nội suy theo profile tip. */
  const tipR = (y: number) => {
    for (let i = 1; i < tipMM.length - 1; i++) {
      const [ar, ay] = tipMM[i - 1];
      const [br, by] = tipMM[i];
      if (y <= by) return ar + ((br - ar) * (y - ay)) / Math.max(1e-6, by - ay);
    }
    return R.tipR;
  };
  const loadGeo = (f: number) => {
    const h = Math.max(1.5, f * tl);
    const pts = [P(0, 0.2), P(0.55, 0.5)];
    if (h > tl * 0.78) pts.push(P(tipR(tl * 0.78) * 1.05, tl * 0.78));
    pts.push(P(tipR(h) * 1.05, h), P(0, h));
    return ctx.track(latheFromProfile(pts, 18));
  };
  const load = part(ctx, group, loadGeo(0.45), loadMat);
  load.visible = false;
  let loadFill = 0.45;
  // Thân: đầu côn thép/nhựa → thân cầm.
  const y0 = tl - 4;
  part(ctx, group, latheFromProfile([P(0, y0), P(R.tipR * 0.72, y0), P(R.tipR + 0.6, y0 + 36), P(6.5, y0 + 52), P(0, y0 + 52)], 20), m.device());
  const shaft = [P(0, y0 + 50), P(7, y0 + 50), P(10.5, y0 + 64), P(11, y0 + 150), P(9.5, y0 + 166), P(0, y0 + 166)];
  part(ctx, group, latheFromProfile(shaft, 28), m.instrument());
  const band = part(ctx, group, new THREE.CylinderGeometry(mm(11.4), mm(11.4), mm(14), 28), accent, 0, mm(y0 + 138));
  band.name = 'range-band';
  // Móc tì ngón.
  const hook = part(ctx, group, new THREE.BoxGeometry(mm(9), mm(30), mm(12)), m.trim(), mm(13), mm(y0 + 150));
  hook.rotation.z = -0.4;
  // Cửa sổ số thể tích (mặt +z).
  const { canvas, g } = makeCanvas(128, 48);
  const tex = ctx.track(canvasTexture(canvas));
  const win = part(ctx, group, new THREE.PlaneGeometry(mm(12), mm(4.5)), ctx.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })), 0, mm(y0 + 108), mm(11.05));
  win.castShadow = false;
  part(ctx, group, new THREE.BoxGeometry(mm(14), mm(6.5), mm(1)), m.trim(), 0, mm(y0 + 108), mm(10.5));
  // Piston: cần + nút bấm màu.
  const plunger = new THREE.Group();
  plunger.name = 'plunger';
  const top = mm(y0 + 164);
  plunger.position.y = top;
  part(ctx, plunger, new THREE.CylinderGeometry(mm(2.6), mm(2.6), mm(22), 12), m.instrument(), 0, mm(11));
  part(ctx, plunger, new THREE.CylinderGeometry(mm(7.5), mm(7), mm(9), 24), accent, 0, mm(24));
  group.add(plunger);
  const tip = anchor(group, 'tip', 0);
  const nose = anchor(group, 'nose', 0, mm(tl));
  const grip = anchor(group, 'grip', 0, mm(y0 + 120));
  let vol: number = o.volume ?? range;
  const draw = () => {
    g.fillStyle = '#1e242b';
    g.fillRect(0, 0, 128, 48);
    g.fillStyle = '#f2f2ea';
    g.font = 'bold 34px ui-monospace, monospace';
    g.textAlign = 'center';
    g.fillText(range >= 200 ? Math.round(vol).toString().padStart(4, '0') : vol.toFixed(1).padStart(4, '0'), 64, 37);
    tex.needsUpdate = true;
  };
  draw();
  const api: Micropipette = {
    group,
    tip,
    nose,
    grip,
    plunger,
    range,
    get volume() {
      return vol;
    },
    get hasTip() {
      return tipMesh.visible;
    },
    setVolume(ul) {
      vol = THREE.MathUtils.clamp(ul, R.min, range);
      draw();
    },
    setTip(on) {
      tipMesh.visible = on;
      if (!on) load.visible = false;
    },
    setLoad(c, fill = 0.45) {
      load.visible = c !== null && tipMesh.visible;
      if (c !== null) loadMat.color.set(c);
      const f = THREE.MathUtils.clamp(fill, 0.05, 0.95);
      if (Math.abs(f - loadFill) > 0.01) {
        load.geometry.dispose();
        load.geometry = loadGeo(f);
        loadFill = f;
      }
    },
    setLoaded: (on) => api.setLoad(on ? '#4a5fd0' : null),
    press(k) {
      plunger.position.y = top - mm(8) * THREE.MathUtils.clamp(k, 0, 1.4);
    },
  };
  return api;
}
