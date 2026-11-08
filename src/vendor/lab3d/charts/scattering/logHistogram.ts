import type { Tracker } from '../../lab/types';
import { collapsible } from '../../ui/collapse';
import { uiFont } from '../../ui/tokens';
import { labText } from '../../text';

/** Đường so sánh (step) vẽ chồng lên cột đếm. */
export interface HistSeries {
  values: number[];
  color: string;
  label: string;
  dashed?: boolean;
}

export interface LogHistogramData {
  /** Số đếm mỗi bin (cột). */
  counts: number[];
  series?: HistSeries[];
  /** Chú thích góc trên phải (vd. tổng số hạt). */
  note?: string;
}

export interface LogHistogramOptions {
  title: string;
  /** Nhãn chip khi thu gọn (mặc định `title`) – nên ngắn, 1–2 từ. */
  chip?: string;
  /** Khoảng trục x và vạch chia (vd. 0…180°, mỗi 30°). */
  xMax: number;
  xStep: number;
  xUnit?: string;
  barColor?: string;
  barLabel?: string;
  /** Vạch dọc đánh dấu (vd. 90° = bật ngược). */
  marker?: { x: number; label: string };
  /** Số bậc thập phân dưới 1 trên trục log (vd. 2 → trục bắt đầu từ 0,01; hữu ích cho đường lý thuyết < 1). */
  floor?: number;
  width?: number;
  height?: number;
}

export interface LogHistogram {
  el: HTMLDivElement;
  draw(d: LogHistogramData): void;
  setVisible(v: boolean): void;
}

/** Biểu đồ cột thang log (HTML canvas, góc dưới trái khung 3D) – tự gỡ khi huỷ mô phỏng. */
export function createLogHistogram(ctx: Tracker, host: HTMLElement, o: LogHistogramOptions): LogHistogram {
  const W = o.width ?? 320;
  const H = o.height ?? 178;
  const el = document.createElement('div');
  // Bảng xám đậm theo token (canvas vẽ cho nền tối); đồ thị không thao tác → thu gọn mặc định thành chip.
  el.className = 'ui-panel ui-dark';
  Object.assign(el.style, {
    position: 'absolute', left: 'var(--ui-edge)', bottom: '112px', zIndex: '3', padding: '8px 10px 6px', pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>);
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr;
  cv.height = H * dpr;
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  el.appendChild(cv);
  host.appendChild(el);
  collapsible(el, { id: `hist:${o.title}`, label: o.chip ?? o.title, icon: 'gauge' });
  ctx.track(() => el.remove());
  const g = cv.getContext('2d');
  const pad = { l: 34, r: 8, t: 34, b: 20 };
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const font = (px: number, w: 400 | 500 | 700 = 400) => uiFont(px, w);

  return {
    el,
    setVisible(v) {
      el.style.display = v ? '' : 'none';
    },
    draw(d) {
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const n = d.counts.length;
      const all = [...d.counts, ...(d.series ?? []).flatMap((s) => s.values)];
      const top = Math.max(1, Math.ceil(Math.log10(Math.max(10, ...all))));
      const lo = o.floor ?? 0;
      const y = (v: number) => pad.t + ph * (1 - Math.max(0, Math.log10(Math.max(v, 1e-12)) + lo) / (top + lo));
      const x = (v: number) => pad.l + (pw * v) / o.xMax;
      g.fillStyle = '#e6edf7';
      g.font = font(12, 700);
      g.fillText(o.title, 8, 14);
      if (d.note) {
        g.font = font(10.5);
        g.fillStyle = '#9fb0c8';
        g.textAlign = 'right';
        // Chừa nút ⌃ (thu gọn) ở góc phải trên của bảng mở: 24 px + lề 4 px, tính từ mép canvas (đệm phải 10 px).
        g.fillText(d.note, W - 26, 14);
        g.textAlign = 'left';
      }
      // Lưới log.
      g.font = font(9.5);
      for (let e = -lo; e <= top; e++) {
        const yy = y(10 ** e);
        g.strokeStyle = 'rgba(255,255,255,0.08)';
        g.beginPath();
        g.moveTo(pad.l, yy);
        g.lineTo(pad.l + pw, yy);
        g.stroke();
        g.fillStyle = '#7d8ca3';
        g.textAlign = 'right';
        g.fillText(e <= 0 ? (10 ** e).toLocaleString('vi-VN') : `10${'⁰¹²³⁴⁵⁶⁷⁸⁹'[e] ?? ''}`, pad.l - 4, yy + 3);
      }
      g.textAlign = 'center';
      for (let v = 0; v <= o.xMax; v += o.xStep) g.fillText(`${v}${o.xUnit ?? ''}`, x(v), H - 6);
      g.textAlign = 'left';
      if (o.marker) {
        g.strokeStyle = 'rgba(255,120,120,0.45)';
        g.setLineDash([2, 3]);
        g.beginPath();
        g.moveTo(x(o.marker.x), pad.t - 4);
        g.lineTo(x(o.marker.x), pad.t + ph);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = '#ff9a9a';
        g.fillText(o.marker.label, x(o.marker.x) + 3, pad.t + 6);
      }
      const bw = pw / n;
      const bar = o.barColor ?? '#f3b04a';
      d.counts.forEach((c, i) => {
        if (c <= 0) return;
        const yy = y(c);
        const grd = g.createLinearGradient(0, yy, 0, pad.t + ph);
        grd.addColorStop(0, bar);
        grd.addColorStop(1, 'rgba(243,176,74,0.25)');
        g.fillStyle = grd;
        g.fillRect(pad.l + i * bw + 1, yy, bw - 2, pad.t + ph - yy);
      });
      // Đường so sánh dạng bậc thang.
      const legend: [string, string, boolean][] = [[bar, o.barLabel ?? labText('t_db90ad78156a'), false]];
      for (const s of d.series ?? []) {
        g.strokeStyle = s.color;
        g.lineWidth = 2;
        g.setLineDash(s.dashed ? [4, 3] : []);
        g.beginPath();
        let open = false;
        s.values.forEach((v, i) => {
          if (v < 10 ** -lo) return void (open = false);
          const yy = y(v);
          if (!open) g.moveTo(pad.l + i * bw, yy);
          else g.lineTo(pad.l + i * bw, yy);
          g.lineTo(pad.l + (i + 1) * bw, yy);
          open = true;
        });
        g.stroke();
        g.setLineDash([]);
        g.lineWidth = 1;
        legend.push([s.color, s.label, !!s.dashed]);
      }
      g.font = font(10);
      let lx = 8;
      for (const [c, label] of legend) {
        g.fillStyle = c;
        g.fillRect(lx, 22, 10, 4);
        g.fillStyle = '#c9d4e3';
        g.fillText(label, lx + 13, 27);
        lx += 17 + g.measureText(label).width;
      }
    },
  };
}
