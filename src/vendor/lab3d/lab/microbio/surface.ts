import { makeCanvas } from '../materials/canvas';
import type { AgarSurface } from './agarPlate';
import type { P2, PlateGrid } from './streak';
import { cellCenter } from './streak';

/**
 * Vẽ lên mặt thạch: vệt que ria (vết ướt bóng, nhạt dần khi khô) và thảm vi khuẩn (ô lưới dày tế bào).
 * Lưu danh sách nét để vẽ lại khi thảm đổi; vẽ thưa (sim gọi `redraw` khi cần).
 */
export interface SurfacePainter {
  /** Thêm một đoạn vệt que (mm toạ độ đĩa). */
  segment(a: P2, b: P2): void;
  /** Độ đậm vệt ướt (1 = vừa ria, 0 = đã khô hẳn). */
  setTrace(k: number): void;
  /** Thảm: mật độ ô (tế bào/mm²) → độ phủ 0…1. */
  setLawn(grid: PlateGrid | null, lawn: Float32Array | null, cover: (density: number) => number, color?: string): void;
  /** Vết tròn khoét trong thảm (vòng vô khuẩn / vết tan) – bán kính mm, `clear` 0…1. */
  setHoles(holes: { u: number; v: number; r: number; clear: number }[]): void;
  clear(): void;
  redraw(): void;
}

export function createSurfacePainter(s: AgarSurface, o: { traceColor?: string; traceWidth?: number } = {}): SurfacePainter {
  const segs: [P2, P2][] = [];
  let trace = 1;
  let lawn: { grid: PlateGrid; dens: Float32Array; cover: (d: number) => number; color: string } | null = null;
  let holes: { u: number; v: number; r: number; clear: number }[] = [];
  const g = s.g;
  const { canvas: layer, g: l } = makeCanvas(s.size, s.size);
  const tw = s.px(o.traceWidth ?? 1.1);
  const strokeSeg = (a: P2, b: P2) => {
    const [x0, y0] = s.at(a.u, a.v);
    const [x1, y1] = s.at(b.u, b.v);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  const traceStyle = () => {
    g.lineCap = 'round';
    g.lineWidth = tw;
    g.strokeStyle = o.traceColor ?? `rgba(255,236,236,${0.06 + 0.28 * trace})`;
  };
  const api: SurfacePainter = {
    segment(a, b) {
      segs.push([a, b]);
      traceStyle();
      strokeSeg(a, b);
      s.touch();
    },
    setTrace(k) {
      trace = Math.max(0, Math.min(1, k));
    },
    setLawn(grid, dens, cover, color = '#f3eee0') {
      lawn = grid && dens ? { grid, dens, cover, color } : null;
    },
    setHoles(h) {
      holes = h;
    },
    clear() {
      segs.length = 0;
      lawn = null;
      holes = [];
      trace = 1;
      s.clear();
      s.touch();
    },
    redraw() {
      s.clear();
      traceStyle();
      segs.forEach(([a, b]) => strokeSeg(a, b));
      if (lawn) {
        // Thảm vẽ ở lớp riêng rồi khoét các vết trong (destination-out) trước khi ghép lên thạch.
        const { grid, dens, cover, color } = lawn;
        const r = s.px(grid.cell * 0.85);
        l.clearRect(0, 0, s.size, s.size);
        l.fillStyle = color;
        dens.forEach((d, k) => {
          if (d <= 0) return;
          const a = cover(d);
          if (a < 0.02) return;
          const c = cellCenter(grid, k);
          const [x, y] = s.at(c.u, c.v);
          l.globalAlpha = Math.min(1, a);
          l.beginPath();
          l.arc(x, y, r, 0, Math.PI * 2);
          l.fill();
        });
        l.globalCompositeOperation = 'destination-out';
        holes.forEach((h) => {
          const [x, y] = s.at(h.u, h.v);
          l.globalAlpha = h.clear;
          l.beginPath();
          l.arc(x, y, s.px(h.r), 0, Math.PI * 2);
          l.fill();
        });
        l.globalCompositeOperation = 'source-over';
        l.globalAlpha = 1;
        g.drawImage(layer, 0, 0);
      }
      s.touch();
    },
  };
  return api;
}
