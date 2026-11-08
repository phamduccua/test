import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, labMaterials, makeCanvas, mm, type Tracker } from '../lab';
import { drawPlot, type PlotSeries, type PlotStyle } from './plotCanvas';

export interface PlotPanel {
  /** Gốc ở đáy chân đế; màn hình hướng +z. */
  group: THREE.Group;
  style: PlotStyle;
  series: PlotSeries[];
  /** Vẽ lại (gọi thưa, vd. 4 lần/giây). */
  redraw(): void;
}

/**
 * Màn hình bộ thu số liệu (data logger) đứng trên bàn: khung nhựa tối + màn LCD hiện đồ thị đường (CanvasTexture).
 * Dùng cho V(khí)–t, T–t, độ đục–t…
 */
export function createPlotPanel(
  ctx: Tracker,
  o: { width?: number; aspect?: number; style: PlotStyle; series: Omit<PlotSeries, 'x' | 'y'>[]; tilt?: number },
): PlotPanel {
  const w = o.width ?? mm(220);
  const h = w / (o.aspect ?? 1.6);
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'plot-panel';
  const frame = new THREE.Mesh(new RoundedBoxGeometry(w + mm(14), h + mm(14), mm(12), 3, mm(4)), mats.darkPlastic());
  frame.castShadow = true;
  const { canvas, g } = makeCanvas(1024, Math.round(1024 / (o.aspect ?? 1.6)));
  const tex = ctx.track(canvasTexture(canvas));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    ctx.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })),
  );
  screen.position.z = mm(6.2);
  const face = new THREE.Group();
  face.add(frame, screen);
  face.rotation.x = -(o.tilt ?? 0.18);
  face.position.y = mm(30) + (h + mm(14)) / 2;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, mm(8), mm(70)), mats.darkPlastic());
  foot.position.set(0, mm(4), -mm(10));
  const post = new THREE.Mesh(new THREE.BoxGeometry(mm(26), mm(34), mm(10)), mats.darkPlastic());
  post.position.set(0, mm(22), -mm(8));
  foot.castShadow = post.castShadow = true;
  group.add(foot, post, face);
  const series: PlotSeries[] = o.series.map((s) => ({ ...s, x: [], y: [] }));
  const panel: PlotPanel = {
    group,
    style: o.style,
    series,
    redraw() {
      drawPlot(g, canvas.width, canvas.height, panel.style, panel.series);
      tex.needsUpdate = true;
    },
  };
  panel.redraw();
  return panel;
}
