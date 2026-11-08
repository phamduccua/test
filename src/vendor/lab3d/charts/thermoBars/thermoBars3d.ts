import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import './thermoBars.css';

export interface ThermoBarItem {
  label: string;
  tm: number;
  tb: number;
  color: THREE.ColorRepresentation;
}

export interface ThermoBarsOptions {
  tMin?: number;
  tMax?: number;
  /** Chiều cao trục (đv cảnh) cho khoảng tMin…tMax. */
  height?: number;
  barWidth?: number;
  gap?: number;
  /** Bước vạch chia (°C). */
  step?: number;
  title?: string;
  format?(v: number): string;
}

export interface ThermoBars3d {
  /** Gốc: chân trục (tMin) ở giữa chiều rộng; cột xếp theo +x, mặt trước hướng +z. */
  group: THREE.Group;
  width: number;
  height: number;
  /** Toạ độ y (cục bộ) của nhiệt độ T. */
  yOf(T: number): number;
  /** Kim/mặt phẳng nhiệt độ hiện tại (đỏ) cắt ngang mọi cột. */
  setTemperature(T: number): void;
  setHighlight(i: number | null): void;
  /** Đổi số liệu một cột (vd. giả định ngoại suy) – cột co giãn mượt; `ghost` = vẽ mờ, viền đứt. */
  setItem(i: number, tm: number, tb: number, ghost?: boolean): void;
  update(dt: number): void;
}

const PHASE_COLORS = { solid: 0xbfe0ff, liquid: 0x7cc7f0, gas: 0xffe2bf };

/**
 * Biểu đồ "nhiệt kế cột" 3D cho nhiều chất: cột t°s mọc lên/xuống từ mặt phẳng 0 °C, vạch ngang t°nc,
 * dải pha nền (rắn – lỏng – khí) sau mỗi cột và mặt phẳng nhiệt độ hiện tại – nhìn là biết chất nào đang ở thể nào.
 */
export function createThermoBars3d(ctx: SimContext, items: ThermoBarItem[], o: ThermoBarsOptions = {}): ThermoBars3d {
  const tMin = o.tMin ?? -200, tMax = o.tMax ?? 120;
  const H = o.height ?? 3, bw = o.barWidth ?? 0.3, gap = o.gap ?? 0.22;
  const fmt = o.format ?? ((v: number) => String(v).replace('.', ',').replace('-', '−'));
  const n = items.length;
  const W = n * bw + (n + 1) * gap;
  const yOf = (T: number) => ((Math.min(tMax, Math.max(tMin, T)) - tMin) / (tMax - tMin)) * H;
  const group = new THREE.Group();
  group.name = 'thermo-bars';
  const box = (w: number, h: number, d: number, mat: THREE.Material) => new THREE.Mesh(ctx.track(new THREE.BoxGeometry(w, h, d)), mat);
  const basic = (color: THREE.ColorRepresentation, opacity = 1) =>
    ctx.track(new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));
  const back = box(W + 0.5, H + 0.2, 0.03, ctx.track(new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.8 })));
  back.position.set(0.25, H / 2, -bw / 2 - 0.04);
  group.add(back);
  const x0 = -W / 2;
  // Vạch chia + nhãn trục bên trái.
  const tickMat = basic(0x5d6b80);
  for (let t = Math.ceil(tMin / (o.step ?? 50)) * (o.step ?? 50); t <= tMax; t += o.step ?? 50) {
    const tick = box(W + 0.5, t === 0 ? 0.018 : 0.006, 0.005, t === 0 ? basic(0xe8eef6) : tickMat);
    tick.position.set(0.25, yOf(t), back.position.z + 0.02);
    const a = new THREE.Object3D();
    a.position.set(x0 - 0.05, yOf(t), back.position.z);
    group.add(tick, a);
    ctx.labels.add(a, `${fmt(t)}${t === 0 ? ' °C' : ''}`, { className: 'tbars-tick' });
  }
  if (o.title) {
    const a = new THREE.Object3D();
    a.position.set(0.25, H + 0.22, back.position.z);
    group.add(a);
    ctx.labels.add(a, o.title, { variant: 'small', className: 'tbars-title' });
  }
  const unitGeo = ctx.track(new THREE.BoxGeometry(1, 1, 1));
  const bars = items.map((it, i) => {
    const x = x0 + gap + bw / 2 + i * (bw + gap);
    const mat = ctx.track(new THREE.MeshPhysicalMaterial({ color: it.color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2, transparent: true }));
    const bar = new THREE.Mesh(unitGeo, mat);
    bar.castShadow = true;
    const tmMark = box(bw * 1.35, 0.022, bw * 1.35, basic(0xeaf6ff));
    const strips = (['solid', 'liquid', 'gas'] as const).map((k) => {
      const m = new THREE.Mesh(unitGeo, basic(PHASE_COLORS[k], 0.28));
      m.position.z = back.position.z + 0.03;
      return m;
    });
    const name = new THREE.Object3D();
    name.position.set(x, -0.16, 0.1);
    const tbA = new THREE.Object3D();
    const tmA = new THREE.Object3D();
    group.add(bar, tmMark, ...strips, name, tbA, tmA);
    const nameL = ctx.labels.add(name, it.label, { className: 'tbars-name' });
    const tbL = ctx.labels.add(tbA, '', { className: 'tbars-val' });
    const tmL = ctx.labels.add(tmA, '', { className: 'tbars-val tbars-val--tm' });
    return { x, bar, mat, tmMark, strips, nameL, tbL, tmL, tbA, tmA, tm: it.tm, tb: it.tb, sTm: it.tm, sTb: it.tb, ghost: false };
  });
  const needle = box(W + 0.7, 0.014, 0.02, basic(0xff3b30));
  const needlePlane = box(W + 0.7, 0.003, bw * 1.8, basic(0xff3b30, 0.22));
  needlePlane.scale.y = 1;
  const nA = new THREE.Object3D();
  group.add(needle, needlePlane, nA);
  const nL = ctx.labels.add(nA, '', { className: 'tbars-needle' });
  let T = 25, shownT = 25;
  const layout = (b: (typeof bars)[number]) => {
    const y0 = yOf(0), y1 = yOf(b.sTb);
    b.bar.scale.set(bw, Math.max(0.004, Math.abs(y1 - y0)), bw);
    b.bar.position.set(b.x, (y0 + y1) / 2, 0);
    b.tmMark.position.set(b.x, yOf(b.sTm), 0);
    const cuts = [0, yOf(b.sTm), y1, H];
    b.strips.forEach((s, k) => {
      s.scale.set(bw + gap * 0.8, Math.max(0.001, cuts[k + 1] - cuts[k]), 0.004);
      s.position.set(b.x, (cuts[k] + cuts[k + 1]) / 2, s.position.z);
    });
    b.tbA.position.set(b.x, y1 + (b.sTb >= 0 ? 0.13 : -0.13), bw / 2 + 0.02);
    b.tmA.position.set(b.x + bw * 0.5, yOf(b.sTm), bw / 2 + 0.05);
  };
  const api: ThermoBars3d = {
    group, width: W, height: H, yOf,
    setTemperature(t) {
      T = t;
    },
    setHighlight(h) {
      bars.forEach((b, i) => {
        b.nameL.element.classList.toggle('is-active', i === h);
        b.mat.emissive.set(i === h ? 0x333333 : 0x000000);
      });
    },
    setItem(i, tm, tb, ghost = false) {
      const b = bars[i];
      if (!b) return;
      b.tm = tm;
      b.tb = tb;
      b.ghost = ghost;
    },
    update(dt) {
      const k = Math.min(1, dt * 5);
      shownT += (T - shownT) * k;
      const y = yOf(shownT);
      needle.position.set(0.25, y, bw / 2 + 0.03);
      needlePlane.position.set(0.25, y, 0);
      nA.position.set(x0 + W + 0.45, y, 0);
      const txt = `${fmt(Math.round(T))} °C`;
      if (nL.element.textContent !== txt) nL.element.textContent = txt;
      for (const b of bars) {
        b.sTm += (b.tm - b.sTm) * k;
        b.sTb += (b.tb - b.sTb) * k;
        b.mat.opacity = b.ghost ? 0.45 : 1;
        layout(b);
        const tbt = `t°s ${fmt(b.tb)}`, tmt = `t°nc ${fmt(b.tm)}`;
        if (b.tbL.element.textContent !== tbt) b.tbL.element.textContent = tbt;
        if (b.tmL.element.textContent !== tmt) b.tmL.element.textContent = tmt;
        b.tbL.element.classList.toggle('is-ghost', b.ghost);
      }
    },
  };
  bars.forEach(layout);
  api.update(1);
  return api;
}
