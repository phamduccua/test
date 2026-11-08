/**
 * Va chạm hạt – bề mặt chất rắn (thuần, không three). Chất rắn = các khối ô lập phương cạnh `a` (mỗi ô một ion),
 * xếp trên lưới chung. Hạt trong dung dịch bay ngẫu nhiên trong hộp, nảy khỏi ô còn tồn tại – chỉ ô lộ ra ngoài
 * mới bị chạm, nên số va chạm ∝ diện tích bề mặt. Va chạm "hiệu quả" với xác suất `pEff` (hạt phản ứng).
 */
export interface BlockSpec {
  /** Góc ô nhỏ nhất (bội của a). */
  origin: [number, number, number];
  n: [number, number, number];
}

export interface Cell {
  x: number;
  y: number;
  z: number;
  /** Loại ion (xen kẽ 0/1 theo chẵn lẻ i+j+k). */
  kind: 0 | 1;
  block: number;
  alive: boolean;
}

export interface SurfaceSimOptions {
  a: number;
  blocks: BlockSpec[];
  center: [number, number, number];
  half: [number, number, number];
  /** Số hạt; `reactive[i]` = hạt có thể phản ứng (H⁺), còn lại là ion khán giả (Cl⁻). */
  count: number;
  reactive?: (i: number) => boolean;
  speed?: number;
  radius?: number;
  pEff?: number;
  seed?: number;
}

export interface Hit {
  particle: number;
  cell: number;
  effective: boolean;
  /** Điểm chạm. */
  x: number;
  y: number;
  z: number;
}

export interface SurfaceSim {
  cells: Cell[];
  pos: Float32Array;
  vel: Float32Array;
  readonly count: number;
  reactive: boolean[];
  pEff: number;
  speed: number;
  /** Bước thời gian, trả về các va chạm trong bước. */
  step(dt: number): Hit[];
  /** Số mặt ô lộ ra (đơn vị a²) – theo khối hoặc toàn bộ. */
  exposedFaces(block?: number): number;
  isExposed(cell: number): boolean;
  remove(cell: number): void;
  restore(): void;
  aliveCount(): number;
  /** Đặt lại hạt i ở chỗ trống ngẫu nhiên. */
  scatter(i: number): void;
}

const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export function createSurfaceSim(o: SurfaceSimOptions): SurfaceSim {
  let s = o.seed ?? 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const a = o.a;
  const rp = o.radius ?? a * 0.35;
  const key = (i: number, j: number, k: number) => `${i},${j},${k}`;
  const grid = new Map<string, number>();
  const cells: Cell[] = [];
  const ijk: [number, number, number][] = [];
  o.blocks.forEach((b, bi) => {
    const [i0, j0, k0] = b.origin.map((v) => Math.round(v / a));
    for (let i = 0; i < b.n[0]; i++)
      for (let j = 0; j < b.n[1]; j++)
        for (let k = 0; k < b.n[2]; k++) {
          const g: [number, number, number] = [i0 + i, j0 + j, k0 + k];
          grid.set(key(...g), cells.length);
          ijk.push(g);
          cells.push({ x: (g[0] + 0.5) * a, y: (g[1] + 0.5) * a, z: (g[2] + 0.5) * a, kind: ((g[0] + g[1] + g[2]) & 1) as 0 | 1, block: bi, alive: true });
        }
  });
  const at = (i: number, j: number, k: number) => {
    const c = grid.get(key(i, j, k));
    return c !== undefined && cells[c].alive ? c : -1;
  };
  const n = o.count;
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const [cx, cy, cz] = o.center;
  const [hx, hy, hz] = o.half;
  const inside = (x: number, y: number, z: number) => at(Math.floor(x / a), Math.floor(y / a), Math.floor(z / a)) >= 0;
  const sim: SurfaceSim = {
    cells, pos, vel, count: n,
    reactive: Array.from({ length: n }, (_, i) => (o.reactive ? o.reactive(i) : true)),
    pEff: o.pEff ?? 0.3,
    speed: o.speed ?? 2,
    scatter(i) {
      let x = 0, y = 0, z = 0;
      for (let t = 0; t < 40; t++) {
        x = cx + (rnd() * 2 - 1) * (hx - rp);
        y = cy + (rnd() * 2 - 1) * (hy - rp);
        z = cz + (rnd() * 2 - 1) * (hz - rp);
        if (!inside(x, y, z) && !inside(x + rp, y, z) && !inside(x - rp, y, z)) break;
      }
      pos.set([x, y, z], i * 3);
      const th = rnd() * Math.PI * 2;
      const u = rnd() * 2 - 1;
      const v = sim.speed * (0.6 + 0.8 * rnd());
      const q = Math.sqrt(1 - u * u);
      vel.set([v * q * Math.cos(th), v * u, v * q * Math.sin(th)], i * 3);
    },
    isExposed(c) {
      const [i, j, k] = ijk[c];
      return cells[c].alive && N6.some(([di, dj, dk]) => at(i + di, j + dj, k + dk) < 0);
    },
    exposedFaces(block) {
      let f = 0;
      cells.forEach((c, ci) => {
        if (!c.alive || (block !== undefined && c.block !== block)) return;
        const [i, j, k] = ijk[ci];
        for (const [di, dj, dk] of N6) if (at(i + di, j + dj, k + dk) < 0) f++;
      });
      return f;
    },
    remove(c) {
      cells[c].alive = false;
    },
    restore() {
      cells.forEach((c) => (c.alive = true));
    },
    aliveCount: () => cells.reduce((m, c) => m + (c.alive ? 1 : 0), 0),
    step(dt) {
      const hits: Hit[] = [];
      for (let p = 0; p < n; p++) {
        const b = p * 3;
        // Chuyển động hỗn loạn: lệch hướng nhỏ ngẫu nhiên, giữ tốc độ.
        const sp = Math.hypot(vel[b], vel[b + 1], vel[b + 2]) || 1;
        for (let d = 0; d < 3; d++) vel[b + d] += (rnd() - 0.5) * sp * 3 * dt;
        const k2 = sp / (Math.hypot(vel[b], vel[b + 1], vel[b + 2]) || 1);
        for (let d = 0; d < 3; d++) {
          vel[b + d] *= k2;
          pos[b + d] += vel[b + d] * dt;
        }
        const lo = [cx - hx + rp, cy - hy + rp, cz - hz + rp];
        const hi = [cx + hx - rp, cy + hy - rp, cz + hz - rp];
        for (let d = 0; d < 3; d++) {
          if (pos[b + d] < lo[d]) (pos[b + d] = lo[d]), (vel[b + d] = Math.abs(vel[b + d]));
          if (pos[b + d] > hi[d]) (pos[b + d] = hi[d]), (vel[b + d] = -Math.abs(vel[b + d]));
        }
        // Va chạm với ô lân cận (cầu – hộp).
        const gi = Math.floor(pos[b] / a), gj = Math.floor(pos[b + 1] / a), gk = Math.floor(pos[b + 2] / a);
        let best = -1, bd = rp, nx = 0, ny = 0, nz = 0, qx = 0, qy = 0, qz = 0;
        for (let i = gi - 1; i <= gi + 1; i++)
          for (let j = gj - 1; j <= gj + 1; j++)
            for (let k = gk - 1; k <= gk + 1; k++) {
              const c = at(i, j, k);
              if (c < 0) continue;
              const px = Math.min(Math.max(pos[b], i * a), (i + 1) * a);
              const py = Math.min(Math.max(pos[b + 1], j * a), (j + 1) * a);
              const pz = Math.min(Math.max(pos[b + 2], k * a), (k + 1) * a);
              const dd = Math.hypot(pos[b] - px, pos[b + 1] - py, pos[b + 2] - pz);
              if (dd < bd) [best, bd, qx, qy, qz] = [c, dd, px, py, pz];
            }
        if (best < 0) continue;
        if (bd > 1e-6) [nx, ny, nz] = [(pos[b] - qx) / bd, (pos[b + 1] - qy) / bd, (pos[b + 2] - qz) / bd];
        else [nx, ny, nz] = [0, 1, 0];
        const vn = vel[b] * nx + vel[b + 1] * ny + vel[b + 2] * nz;
        if (vn < 0) for (let d = 0; d < 3; d++) vel[b + d] -= 2 * vn * [nx, ny, nz][d];
        pos[b] = qx + nx * rp * 1.01;
        pos[b + 1] = qy + ny * rp * 1.01;
        pos[b + 2] = qz + nz * rp * 1.01;
        if (vn < 0) hits.push({ particle: p, cell: best, effective: sim.reactive[p] && rnd() < sim.pEff, x: qx, y: qy, z: qz });
      }
      return hits;
    },
  };
  for (let i = 0; i < n; i++) sim.scatter(i);
  return sim;
}
