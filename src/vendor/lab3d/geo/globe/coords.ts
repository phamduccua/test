import { labText } from '../../text';
/**
 * Toạ độ địa lí thuần (không three). Quy ước khung "Trái Đất cố định" của kit:
 *   y = trục Bắc (cực Bắc +y), kinh tuyến gốc (0°, 0°) → +z, 90°Đ → +x.
 *   x = cos φ · sin λ, y = sin φ, z = cos φ · cos λ   (φ vĩ độ, λ kinh độ; độ, Đông/Bắc dương)
 * Quay quanh +y một góc dương = quay từ tây sang đông (đúng chiều tự quay của Trái Đất).
 */
export const DEG = Math.PI / 180;
export const EARTH_RADIUS_KM = 6371;

export type Vec3Tuple = [number, number, number];
export interface LatLon {
  lat: number;
  lon: number;
}

/** Đưa kinh độ về (−180, 180]. */
export function wrapLon(lon: number): number {
  const l = ((((lon + 180) % 360) + 360) % 360) - 180;
  return l === -180 ? 180 : l;
}

/** Vĩ độ/kinh độ (độ) → điểm trên cầu bán kính r. */
export function latLonToXYZ(lat: number, lon: number, r = 1): Vec3Tuple {
  const p = lat * DEG;
  const l = lon * DEG;
  const c = Math.cos(p);
  return [r * c * Math.sin(l), r * Math.sin(p), r * c * Math.cos(l)];
}

/** Điểm (bất kì bán kính) → vĩ độ/kinh độ (độ). */
export function xyzToLatLon(x: number, y: number, z: number): LatLon {
  const r = Math.hypot(x, y, z) || 1;
  return { lat: Math.asin(Math.max(-1, Math.min(1, y / r))) / DEG, lon: Math.atan2(x, z) / DEG };
}

/** Khoảng cách cung lớn (km) theo công thức haversine. */
export function haversineKm(a: LatLon, b: LatLon, radiusKm = EARTH_RADIUS_KM): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Góc ở tâm (rad) giữa hai điểm. */
export function centralAngle(a: LatLon, b: LatLon): number {
  return haversineKm(a, b, 1);
}

/** Phương vị ban đầu (độ, 0 = Bắc, theo chiều kim đồng hồ) đi từ a tới b theo cung lớn. */
export function initialBearing(a: LatLon, b: LatLon): number {
  const p1 = a.lat * DEG;
  const p2 = b.lat * DEG;
  const dl = (b.lon - a.lon) * DEG;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) / DEG) + 360) % 360;
}

/** Nội suy cung lớn (slerp) – `n + 1` điểm từ a tới b (gồm hai đầu). */
export function greatCircle(a: LatLon, b: LatLon, n = 64): LatLon[] {
  const pa = latLonToXYZ(a.lat, a.lon);
  const pb = latLonToXYZ(b.lat, b.lon);
  const w = centralAngle(a, b);
  const out: LatLon[] = [];
  const s = Math.sin(w);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ka = s < 1e-9 ? 1 - t : Math.sin((1 - t) * w) / s;
    const kb = s < 1e-9 ? t : Math.sin(t * w) / s;
    out.push(xyzToLatLon(ka * pa[0] + kb * pb[0], ka * pa[1] + kb * pb[1], ka * pa[2] + kb * pb[2]));
  }
  return out;
}

/** Đổi độ thập phân → [độ, phút, giây] (giá trị tuyệt đối). */
export function toDMS(v: number): [number, number, number] {
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = Math.floor((a - d) * 60);
  let s = Math.round(((a - d) * 60 - m) * 60);
  if (s === 60) [s, m] = [0, m + 1];
  if (m === 60) [m, d] = [0, d + 1];
  return [d, m, s];
}

/** "105°52′Đ" / "21°02′B" (kiểu SGK; `seconds` = thêm giây). */
export function formatLon(lon: number, seconds = false): string {
  const l = wrapLon(lon);
  const [d, m, s] = toDMS(l);
  const hemi = Math.abs(l) < 1e-9 || Math.abs(l) === 180 ? '' : l > 0 ? labText('t_e1191b5206eb') : 'T';
  return `${d}°${String(m).padStart(2, '0')}′${seconds ? `${String(s).padStart(2, '0')}″` : ''}${hemi}`;
}

export function formatLat(lat: number, seconds = false): string {
  const [d, m, s] = toDMS(lat);
  const hemi = Math.abs(lat) < 1e-9 ? '' : lat > 0 ? 'B' : 'N';
  return `${d}°${String(m).padStart(2, '0')}′${seconds ? `${String(s).padStart(2, '0')}″` : ''}${hemi}`;
}
