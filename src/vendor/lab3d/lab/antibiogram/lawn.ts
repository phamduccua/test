import { rng } from '../materials/canvas';
import type { AgarPlate } from './agarPlate';

/**
 * Vẽ mặt thạch kháng sinh đồ lên canvas của `AgarPlate`: nền thạch, vệt tăm bông ướt (3 hướng + vòng mép),
 * thảm vi khuẩn mọc dần (đục kem, có hạt) với các lỗ tròn = vòng vô khuẩn (bờ mềm ~0,6 mm), màu giả nồng độ kháng sinh.
 */
export interface LawnHole {
  u: number;
  v: number;
  /** Bán kính vòng (mm). */
  r: number;
}

export interface LawnState {
  /** Tiến độ trải tăm bông 0…4 (3 hướng + vòng mép); vệt ướt mờ dần khi thảm mọc. */
  swab: number;
  /** Độ phủ thảm 0…1. */
  cover: number;
  holes: LawnHole[];
  /** Thảm thưa (huyễn dịch quá loãng): vẽ thành khuẩn lạc riêng rẽ. */
  sparse?: boolean;
  /** C/MIC tại (u, v) mm – có thì tô màu giả (xanh < MIC < đỏ). */
  heat?: (u: number, v: number) => number;
}

export function createLawnPainter(plate: AgarPlate, o: { agar: string; lawn: string; seed?: number }) {
  const S = plate.size;
  const R = plate.radius;
  const k = S / (2 * R);
  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return { c, g: c.getContext('2d')! };
  };
  // Họa tiết thảm dày và thảm thưa (khuẩn lạc rời), vẽ một lần.
  const dense = make();
  const sparse = make();
  const rnd = rng(o.seed ?? 11);
  dense.g.fillStyle = o.lawn;
  dense.g.fillRect(0, 0, S, S);
  for (let i = 0; i < 3000; i++) {
    dense.g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(120,100,60,0.05)';
    dense.g.beginPath();
    dense.g.arc(rnd() * S, rnd() * S, (0.3 + rnd() * 0.6) * k, 0, Math.PI * 2);
    dense.g.fill();
  }
  for (let i = 0; i < 1400; i++) {
    sparse.g.fillStyle = o.lawn;
    sparse.g.beginPath();
    sparse.g.arc(rnd() * S, rnd() * S, (0.5 + rnd() * 0.7) * k, 0, Math.PI * 2);
    sparse.g.fill();
  }
  const layer = make();
  const heatLayer = make();
  const g = plate.g;

  const strokes = (n: number) => {
    // 3 lượt trải, mỗi lượt xoay 60°, các vệt ziczac sát nhau; lượt 4 = vòng quanh mép.
    g.save();
    // Vệt rộng bằng khoảng cách hàng → các lượt phủ kín thành lớp dịch ướt đều, chỉ còn gợn nhẹ.
    g.strokeStyle = 'rgba(255,248,230,0.09)';
    g.lineWidth = 6 * k;
    g.lineCap = 'round';
    for (let pass = 0; pass < Math.min(3, Math.ceil(n)); pass++) {
      const part = Math.min(1, n - pass);
      const a = (pass * Math.PI) / 3;
      const [ca, sa] = [Math.cos(a), Math.sin(a)];
      const rows = 16;
      g.beginPath();
      for (let j = 0; j < Math.floor(rows * part); j++) {
        const y = -R + ((j + 0.5) / rows) * 2 * R;
        const x = Math.sqrt(Math.max(0, R * R - y * y)) * 0.96;
        const [x0, x1] = j % 2 ? [x, -x] : [-x, x];
        const P = (px: number, py: number) => plate.px(px * ca - py * sa, px * sa + py * ca);
        const [ax, ay] = P(x0, y);
        const [bx, by] = P(x1, y);
        if (j === 0) g.moveTo(ax, ay);
        else g.lineTo(ax, ay);
        g.lineTo(bx, by);
      }
      g.stroke();
    }
    if (n > 3) {
      g.beginPath();
      g.arc(S / 2, S / 2, (R - 1.5) * k, 0, Math.PI * 2 * Math.min(1, n - 3));
      g.stroke();
    }
    g.restore();
  };

  return {
    draw(st: LawnState) {
      g.fillStyle = o.agar;
      g.fillRect(0, 0, S, S);
      if (st.heat) {
        const h = heatLayer.g;
        const img = h.createImageData(S / 4, S / 4);
        for (let y = 0; y < S / 4; y++)
          for (let x = 0; x < S / 4; x++) {
            const u = ((x * 4 + 2) / S) * 2 * R - R;
            const v = R - ((y * 4 + 2) / S) * 2 * R;
            const c = st.heat(u, v);
            const t = Math.min(1, Math.log10(1 + c) / 1.3);
            const i = (y * (S / 4) + x) * 4;
            const above = c >= 1;
            img.data[i] = above ? 230 : 70;
            img.data[i + 1] = above ? 70 + 80 * (1 - t) : 120;
            img.data[i + 2] = above ? 60 : 230;
            img.data[i + 3] = c > 0.05 ? 40 + 150 * t : 0;
          }
        h.clearRect(0, 0, S, S);
        h.putImageData(img, 0, 0);
        g.imageSmoothingEnabled = true;
        g.drawImage(heatLayer.c, 0, 0, S / 4, S / 4, 0, 0, S, S);
      }
      if (st.swab > 0 && st.cover < 0.6) {
        g.globalAlpha = 1 - st.cover / 0.6;
        strokes(st.swab);
        g.globalAlpha = 1;
      }
      if (st.cover <= 0.001) return plate.commit();
      const L = layer.g;
      L.globalCompositeOperation = 'source-over';
      L.clearRect(0, 0, S, S);
      L.drawImage(st.sparse ? sparse.c : dense.c, 0, 0);
      L.globalCompositeOperation = 'destination-out';
      for (const hole of st.holes) {
        const [x, y] = plate.px(hole.u, hole.v);
        const r = hole.r * k;
        const grd = L.createRadialGradient(x, y, Math.max(0, r - 0.6 * k), x, y, r + 0.6 * k);
        grd.addColorStop(0, 'rgba(0,0,0,1)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        L.fillStyle = grd;
        L.beginPath();
        L.arc(x, y, r + 0.6 * k, 0, Math.PI * 2);
        L.fill();
      }
      g.globalAlpha = Math.min(1, st.cover);
      g.drawImage(layer.c, 0, 0);
      g.globalAlpha = 1;
      plate.commit();
    },
  };
}
