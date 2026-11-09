/** Hàm thuần cho việc đặt đồ (có test): chọn bề mặt, kiểm chồng chéo, kẹp vào trong bề mặt, tìm ổ cắm gần nhất. */
export interface SurfaceLike { name: string; y: number; minX: number; maxX: number; minZ: number; maxZ: number }
export interface Disc { u: number; v: number; r: number }

/** Bề mặt chứa điểm (u, v) và nằm ngay dưới độ cao `y` (trong 2 dm) – gần nhất từ trên xuống. */
export function surfaceAt(surfaces: readonly SurfaceLike[], u: number, y: number, v: number, margin = 0.3): SurfaceLike | null {
  let best: SurfaceLike | null = null
  for (const s of surfaces) {
    if (u < s.minX - margin || u > s.maxX + margin || v < s.minZ - margin || v > s.maxZ + margin) continue
    if (y < s.y - 0.4 || y > s.y + 2) continue
    if (!best || Math.abs(y - s.y) < Math.abs(y - best.y)) best = s
  }
  return best
}

/** Kẹp tâm vật bán kính r vào trong bề mặt. */
export function clampInto(s: SurfaceLike, u: number, v: number, r: number): [number, number] {
  const cu = Math.min(Math.max(u, s.minX + r), s.maxX - r)
  const cv = Math.min(Math.max(v, s.minZ + r), s.maxZ - r)
  return [s.minX + r > s.maxX - r ? (s.minX + s.maxX) / 2 : cu, s.minZ + r > s.maxZ - r ? (s.minZ + s.maxZ) / 2 : cv]
}

/** Có chồng lên vật khác không (đĩa tròn trên mặt bàn, hở 0,05 dm). */
export function overlaps(d: Disc, others: readonly Disc[], gap = 0.05): boolean {
  return others.some((o) => Math.hypot(o.u - d.u, o.v - d.v) < o.r + d.r + gap)
}

/**
 * Tìm chỗ trống gần (u, v) nhất trên bề mặt: thử chính chỗ đó, rồi các vòng xoắn quanh nó (bước r).
 * Trả null nếu không có chỗ trong bán kính `search`.
 */
export function freeSpot(s: SurfaceLike, u: number, v: number, r: number, others: readonly Disc[], search = 3): [number, number] | null {
  const tryAt = (a: number, b: number): [number, number] | null => {
    const [cu, cv] = clampInto(s, a, b, r)
    return overlaps({ u: cu, v: cv, r }, others) ? null : [cu, cv]
  }
  const first = tryAt(u, v)
  if (first) return first
  const step = Math.max(0.2, r)
  for (let ring = 1; ring * step <= search; ring++) {
    const n = 8 * ring
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const hit = tryAt(u + Math.cos(a) * ring * step, v + Math.sin(a) * ring * step)
      if (hit) return hit
    }
  }
  return null
}

export interface SocketLike { key: string; x: number; y: number; z: number; radius: number; accepts: readonly string[]; occupied: boolean }

/** Ổ cắm nhận `kind` gần điểm (x, y, z) nhất trong tầm hút (ngang ≤ max(2r, 0,8 dm), dọc ≤ 3 dm). */
export function nearestSocket(sockets: readonly SocketLike[], kind: string, x: number, y: number, z: number): SocketLike | null {
  let best: SocketLike | null = null
  let bestD = Infinity
  for (const s of sockets) {
    if (s.occupied || !s.accepts.includes(kind)) continue
    const d = Math.hypot(s.x - x, s.z - z)
    if (d > Math.max(2 * s.radius, 0.8) || Math.abs(s.y - y) > 3) continue
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}
