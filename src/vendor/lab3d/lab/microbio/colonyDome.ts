import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface ColonyDomeOptions {
  /** Độ cao đỉnh khi bán kính đạt `fullRadius` (mm). */
  height?: number;
  fullRadius?: number;
  /** Số nếp nhăn toả tia và biên độ (0–1) – khuẩn lạc xạ khuẩn/nấm mốc nhăn, khuẩn lạc vi khuẩn trơn thì 0. */
  ridges?: number;
  ridge?: number;
  /** Vẽ mặt khuẩn lạc nhìn từ trên (canvas S×S, tâm ở giữa, mép ở bán kính S/2). */
  draw(g: CanvasRenderingContext2D, S: number): void;
  seed?: number;
}

/** A-KHUAN-LAC – một khuẩn lạc to vồng lên mặt thạch (lưới cực, mép thoải, nếp nhăn toả tia, mép lượn sóng); `setRadius(mm)` cho khuẩn lạc mọc lan. */
export interface ColonyDome {
  mesh: THREE.Mesh;
  setRadius(rMM: number): void;
  /** Vẽ lại mặt (vd. đổi loài). */
  redraw(draw: ColonyDomeOptions['draw']): void;
}

const NR = 22;
const NS = 96;

export function createColonyDome(ctx: Tracker, o: ColonyDomeOptions): ColonyDome {
  const H = o.height ?? 1.6;
  const full = o.fullRadius ?? 10;
  const nRidge = o.ridges ?? 0;
  const amp = o.ridge ?? 0;
  let s = o.seed ?? 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const wobble = Array.from({ length: 7 }, () => [rnd() * 0.05, rnd() * Math.PI * 2] as const);
  const pos: number[] = [0, H, 0];
  const uv: number[] = [0.5, 0.5];
  for (let i = 1; i <= NR; i++) {
    const rho = i / NR;
    for (let j = 0; j < NS; j++) {
      const th = (j / NS) * Math.PI * 2;
      const edge = 1 + wobble.reduce((a, [w, ph], k) => a + w * Math.sin((k + 3) * th + ph), 0);
      const r = rho * edge;
      const ridge = 1 + amp * rho * (0.6 * Math.sin(nRidge * th) + 0.4 * Math.sin(nRidge * 1.7 * th + 1.3));
      const h = H * Math.pow(Math.max(0, 1 - rho * rho), 0.55) * ridge;
      pos.push(r * Math.cos(th), h, -r * Math.sin(th));
      uv.push(0.5 + 0.5 * r * Math.cos(th), 0.5 + 0.5 * r * Math.sin(th));
    }
  }
  const idx: number[] = [];
  const at = (i: number, j: number) => (i === 0 ? 0 : 1 + (i - 1) * NS + (j % NS));
  for (let i = 0; i < NR; i++)
    for (let j = 0; j < NS; j++) {
      if (i === 0) idx.push(0, at(1, j), at(1, j + 1));
      else idx.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
    }
  const geo = ctx.track(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const S = 512;
  const { canvas, g } = makeCanvas(S, S);
  const tex = ctx.track(canvasTexture(canvas));
  const mat = ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'colony-dome';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const redraw = (draw: ColonyDomeOptions['draw']) => {
    g.clearRect(0, 0, S, S);
    draw(g, S);
    tex.needsUpdate = true;
  };
  redraw(o.draw);
  return {
    mesh,
    setRadius(rMM) {
      const r = Math.max(0.01, rMM);
      // Khuẩn lạc nhỏ thì thấp hơn (vồng dần lên khi lớn).
      const k = Math.min(1, r / full);
      mesh.scale.set(mm(r), mm(1) * (0.35 + 0.65 * k), mm(r));
      mesh.visible = rMM > 0.15;
    },
    redraw,
  };
}
