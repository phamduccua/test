import { uiFont } from '../ui/tokens';

/** Vẽ đồ thị đường lên canvas 2D (thuần, không three) – dùng cho màn hình bộ thu số liệu / bảng HUD. */
export interface PlotSeries {
  label: string;
  color: string;
  x: number[];
  y: number[];
  dashed?: boolean;
}

export interface PlotStyle {
  title?: string;
  xLabel?: string;
  yLabel?: string;
  xMax: number;
  yMax: number;
  /** Gốc trục (mặc định 0) – vd. thang lg N 4…10, pH 2…12. */
  xMin?: number;
  yMin?: number;
  /** Số khoảng chia trục. */
  xDiv?: number;
  yDiv?: number;
  bg?: string;
  fg?: string;
  grid?: string;
  /** Định dạng số trên trục. */
  fmt?(v: number): string;
}

const niceFmt = (v: number) => (Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1).replace('.', ','));

export function drawPlot(g: CanvasRenderingContext2D, W: number, H: number, st: PlotStyle, series: PlotSeries[]): void {
  const fg = st.fg ?? '#e8eef6';
  const fmt = st.fmt ?? niceFmt;
  g.fillStyle = st.bg ?? '#101822';
  g.fillRect(0, 0, W, H);
  const L = W * 0.11;
  const R = W * 0.03;
  const T = H * (st.title ? 0.16 : 0.06);
  const B = H * 0.16;
  const pw = W - L - R;
  const ph = H - T - B;
  const x0 = st.xMin ?? 0;
  const y0 = st.yMin ?? 0;
  const X = (x: number) => L + ((Math.max(x0, Math.min(x, st.xMax)) - x0) / (st.xMax - x0)) * pw;
  const Y = (y: number) => T + ph - ((Math.max(y0, Math.min(y, st.yMax)) - y0) / (st.yMax - y0)) * ph;
  const xd = st.xDiv ?? 5;
  const yd = st.yDiv ?? 4;
  g.lineWidth = 1;
  g.font = uiFont(Math.round(H * 0.045));
  g.fillStyle = fg;
  for (let i = 0; i <= xd; i++) {
    const x = L + (pw * i) / xd;
    g.strokeStyle = st.grid ?? 'rgba(160,190,220,0.18)';
    g.beginPath();
    g.moveTo(x, T);
    g.lineTo(x, T + ph);
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(fmt(x0 + ((st.xMax - x0) * i) / xd), x, T + ph + H * 0.015);
  }
  for (let i = 0; i <= yd; i++) {
    const y = T + ph - (ph * i) / yd;
    g.beginPath();
    g.moveTo(L, y);
    g.lineTo(L + pw, y);
    g.stroke();
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillText(fmt(y0 + ((st.yMax - y0) * i) / yd), L - W * 0.012, y);
  }
  g.strokeStyle = fg;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(L, T);
  g.lineTo(L, T + ph);
  g.lineTo(L + pw, T + ph);
  g.stroke();
  g.font = uiFont(Math.round(H * 0.05), 500);
  if (st.xLabel) {
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    g.fillText(st.xLabel, L + pw, H - H * 0.01);
  }
  if (st.yLabel) {
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(st.yLabel, L + W * 0.01, T + H * 0.005);
  }
  if (st.title) {
    g.font = uiFont(Math.round(H * 0.062), 500);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(st.title, W * 0.03, T * 0.5);
  }
  // Chuỗi số liệu + chú giải.
  series.forEach((s, k) => {
    g.strokeStyle = s.color;
    g.lineWidth = Math.max(2, H * 0.008);
    g.setLineDash(s.dashed ? [H * 0.02, H * 0.015] : []);
    g.beginPath();
    for (let i = 0; i < s.x.length; i++) (i ? g.lineTo : g.moveTo).call(g, X(s.x[i]), Y(s.y[i]));
    g.stroke();
    g.setLineDash([]);
    const n = s.x.length;
    if (n) {
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(X(s.x[n - 1]), Y(s.y[n - 1]), H * 0.012, 0, Math.PI * 2);
      g.fill();
    }
    const lx = L + pw - W * 0.3;
    const ly = T + H * 0.04 + k * H * 0.065;
    g.fillStyle = s.color;
    g.fillRect(lx, ly - H * 0.006, W * 0.04, H * 0.012);
    g.fillStyle = fg;
    g.font = uiFont(Math.round(H * 0.048));
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(s.label, lx + W * 0.05, ly);
  });
}
