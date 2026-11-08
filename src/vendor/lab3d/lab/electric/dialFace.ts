/** Vẽ mặt đồng hồ kim (thuần canvas 2D): cung chia vạch, số, đơn vị, kí hiệu. Kim quay quanh (cx, cy). */
export interface DialFaceSpec {
  max: number;
  /** Bước vạch chính (có số) và vạch phụ. */
  major: number;
  minor: number;
  unit: string;
  /** Kí hiệu khoanh tròn (A, V, mA…). */
  symbol: string;
  /** Nửa góc quét (rad). */
  sweep: number;
}

export const DIAL_W = 512;
export const DIAL_H = 340;
export const DIAL_PIVOT = { x: 256, y: 300 };
export const DIAL_R = 236;

export function drawDialFace(g: CanvasRenderingContext2D, s: DialFaceSpec): void {
  const { x: cx, y: cy } = DIAL_PIVOT;
  g.fillStyle = '#20242a';
  g.fillRect(0, 0, DIAL_W, DIAL_H);
  const face = g.createLinearGradient(0, 0, 0, DIAL_H);
  face.addColorStop(0, '#fbfaf5');
  face.addColorStop(1, '#ebe7dc');
  g.fillStyle = face;
  g.beginPath();
  g.roundRect(14, 14, DIAL_W - 28, DIAL_H - 28, 18);
  g.fill();
  const ang = (v: number) => -s.sweep + (2 * s.sweep * v) / s.max;
  const at = (a: number, r: number): [number, number] => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  // Cung + dải gương (chống thị sai).
  g.strokeStyle = '#1b1e22';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(cx, cy, DIAL_R - 4, -Math.PI / 2 - s.sweep, -Math.PI / 2 + s.sweep);
  g.stroke();
  g.strokeStyle = 'rgba(150,165,180,0.55)';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(cx, cy, DIAL_R - 52, -Math.PI / 2 - s.sweep, -Math.PI / 2 + s.sweep);
  g.stroke();
  g.fillStyle = '#1b1e22';
  g.strokeStyle = '#1b1e22';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 26px sans-serif';
  const n = Math.round(s.max / s.minor);
  for (let i = 0; i <= n; i++) {
    const v = i * s.minor;
    const isMajor = Math.abs(v / s.major - Math.round(v / s.major)) < 1e-6;
    const half = !isMajor && Math.abs((2 * v) / s.major - Math.round((2 * v) / s.major)) < 1e-6;
    const a = ang(v);
    const [x0, y0] = at(a, DIAL_R - 4);
    const [x1, y1] = at(a, DIAL_R - (isMajor ? 30 : half ? 22 : 15));
    g.lineWidth = isMajor ? 3 : 1.6;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    if (isMajor) {
      const [tx, ty] = at(a, DIAL_R - 76);
      g.fillText(String(Math.round(v)), tx, ty);
    }
  }
  g.font = 'bold 30px sans-serif';
  g.fillText(s.unit, cx, cy - 92);
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(cx - 170, cy - 30, 22, 0, Math.PI * 2);
  g.stroke();
  g.font = 'bold 26px serif';
  g.fillText(s.symbol, cx - 170, cy - 29);
  g.font = '16px sans-serif';
  g.fillStyle = '#5a6068';
  g.fillText('DC  ═', cx + 168, cy - 30);
}
