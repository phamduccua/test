import { labText } from '../../text';
/**
 * Hàm sóng nguyên tử kiểu hydrogen (thuần, không three): ψ_nlm thực = R_nl(r)·Y_lm(θ, φ).
 * Đơn vị độ dài: bán kính Bohr a₀ (chia cho Z nếu nhân hiệu dụng). Toạ độ HOÁ HỌC (x, y, z – z là trục chính).
 * Y_lm thực không kèm pha Condon–Shortley ⇒ px dương theo +x, py theo +y, dxy dương ở góc phần tư x, y > 0.
 */

export interface OrbitalQN {
  n: number;
  l: number;
  /** m thực: m > 0 ↔ cos(mφ), m < 0 ↔ sin(|m|φ), m = 0 ↔ đối xứng trục z. */
  m: number;
  /** Điện tích hạt nhân (hiệu dụng), mặc định 1. */
  Z?: number;
}

export type Psi = (x: number, y: number, z: number) => number;

const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));

export function validQN({ n, l, m }: OrbitalQN): boolean {
  return Number.isInteger(n) && n >= 1 && Number.isInteger(l) && l >= 0 && l < n && Number.isInteger(m) && Math.abs(m) <= l;
}

/** Đa thức Laguerre suy rộng L_k^α(x) (truy hồi). */
export function laguerre(k: number, alpha: number, x: number): number {
  if (k === 0) return 1;
  let a = 1;
  let b = 1 + alpha - x;
  for (let i = 1; i < k; i++) {
    const c = ((2 * i + 1 + alpha - x) * b - (i + alpha) * a) / (i + 1);
    a = b;
    b = c;
  }
  return b;
}

/** Hàm bán kính chuẩn hoá R_nl(r): ∫R²r²dr = 1. */
export function radial(n: number, l: number, Z = 1): (r: number) => number {
  const norm = Math.sqrt(((2 * Z) / n) ** 3 * (fact(n - l - 1) / (2 * n * fact(n + l))));
  return (r) => {
    const rho = (2 * Z * r) / n;
    return norm * rho ** l * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho);
  };
}

/** P_l^|m|(t) / sin^|m|θ (không pha Condon–Shortley). */
function legendreQ(l: number, am: number, t: number): number {
  let pmm = 1;
  for (let i = 1; i <= am; i++) pmm *= 2 * i - 1;
  if (l === am) return pmm;
  let pm1 = t * (2 * am + 1) * pmm;
  for (let k = am + 2; k <= l; k++) {
    const pk = ((2 * k - 1) * t * pm1 - (k + am - 1) * pmm) / (k - am);
    pmm = pm1;
    pm1 = pk;
  }
  return pm1;
}

/** Điều hoà cầu thực Y_lm(x, y, z) (chuẩn hoá trên mặt cầu đơn vị). */
export function realYlm(l: number, m: number): Psi {
  const am = Math.abs(m);
  const N = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (fact(l - am) / fact(l + am))) * (m === 0 ? 1 : Math.SQRT2);
  return (x, y, z) => {
    const r = Math.hypot(x, y, z) || 1e-12;
    // Re/Im((x + iy)/r)^|m| = sin^|m|θ · cos/sin(|m|φ)
    let re = 1;
    let im = 0;
    const cx = x / r;
    const cy = y / r;
    for (let i = 0; i < am; i++) {
      const t = re * cx - im * cy;
      im = re * cy + im * cx;
      re = t;
    }
    return N * legendreQ(l, am, z / r) * (m >= 0 ? re : im);
  };
}

/** ψ_nlm thực (đơn vị a₀^(−3/2)); |ψ|² là mật độ xác suất. */
export function orbitalPsi(q: OrbitalQN): Psi {
  if (!validQN(q)) throw new Error(`${labText('t_ca65b8332b71')}${q.n}, l=${q.l}, m=${q.m}`);
  const R = radial(q.n, q.l, q.Z ?? 1);
  const Y = realYlm(q.l, q.m);
  return (x, y, z) => R(Math.hypot(x, y, z)) * Y(x, y, z);
}

/** Bán kính r (a₀) mà xác suất tìm thấy electron trong quả cầu bán kính r đạt `p` (0…1). */
export function radiusEnclosing(n: number, l: number, p: number, Z = 1): number {
  const R = radial(n, l, Z);
  const dr = 0.01 / Z;
  let acc = 0;
  let r = 0;
  while (acc < p && r < (200 * n * n) / Z) {
    const rm = r + dr / 2;
    acc += R(rm) ** 2 * rm * rm * dr;
    r += dr;
  }
  return r;
}

/** Số mặt nút: tổng n − 1, gồm l mặt nút góc và n − l − 1 mặt nút cầu. */
export const nodeCounts = (n: number, l: number) => ({ radial: n - l - 1, angular: l, total: n - 1 });
