/** Hàm thuần cho việc đặt đồ (có test): chọn bề mặt, kiểm chồng chéo, kẹp vào trong bề mặt, tìm ổ cắm gần nhất. */
export interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }
export interface SurfaceLike extends Rect { name: string; y: number; blocked?: readonly Rect[] }

/** Vùng cấm (đế kệ, vòi gas, bồn…) mà đĩa tâm (u, v) bán kính r chạm vào, nếu có. */
export function blockedAt(s: SurfaceLike, u: number, v: number, r = 0): Rect | null {
  for (const b of s.blocked ?? []) if (u > b.minX - r && u < b.maxX + r && v > b.minZ - r && v < b.maxZ + r) return b
  return null
}

/**
 * Điểm bấm rơi vào vùng cấm → đẩy ra mép vùng gần phía người nhìn (toward = vị trí camera, toạ độ bề mặt), cách mép r.
 * Không trong vùng cấm → trả nguyên.
 */
export function pushOutOfBlocked(s: SurfaceLike, u: number, v: number, r: number, towardU: number, towardV: number): [number, number] {
  const b = blockedAt(s, u, v, r)
  if (!b) return [u, v]
  const exits: [number, number][] = [[b.minX - r - 0.01, v], [b.maxX + r + 0.01, v], [u, b.minZ - r - 0.01], [u, b.maxZ + r + 0.01]]
  let best = exits[0]!
  let bestD = Infinity
  for (const e of exits) {
    if (e[0] < s.minX + r - 1e-6 || e[0] > s.maxX - r + 1e-6 || e[1] < s.minZ + r - 1e-6 || e[1] > s.maxZ - r + 1e-6) continue
    const d = Math.hypot(e[0] - towardU, e[1] - towardV)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}
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
    return overlaps({ u: cu, v: cv, r }, others) || blockedAt(s, cu, cv, r) ? null : [cu, cv]
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

/**
 * Ổ cắm nhận `kind` nằm sát đường ngắm từ mắt (ox, oy, oz) tới điểm bấm (px, py, pz): khoảng cách tới đoạn ngắm ≤ max(2r, 0,6 dm).
 * Dùng khi tia xuyên qua vật mảnh (vòng kẹp, giá) và trúng mặt bàn phía sau. Ưu tiên ổ gần mắt nhất trong số ổ đủ gần.
 */
export function socketOnRay(sockets: readonly SocketLike[], kind: string, o: readonly [number, number, number], p: readonly [number, number, number]): SocketLike | null {
  const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]
  const len2 = d[0]! ** 2 + d[1]! ** 2 + d[2]! ** 2
  if (len2 < 1e-9) return null
  let best: SocketLike | null = null
  let bestT = Infinity
  for (const s of sockets) {
    if (s.occupied || !s.accepts.includes(kind)) continue
    const t = ((s.x - o[0]) * d[0]! + (s.y - o[1]) * d[1]! + (s.z - o[2]) * d[2]!) / len2
    if (t <= 0 || t > 1.05) continue
    const dist = Math.hypot(o[0] + d[0]! * t - s.x, o[1] + d[1]! * t - s.y, o[2] + d[2]! * t - s.z)
    if (dist > Math.max(2 * s.radius, 0.6)) continue
    if (t < bestT) {
      bestT = t
      best = s
    }
  }
  return best
}

export type V3T = readonly [number, number, number]

/** Kết quả "đặt vật đang cầm khi bấm vào đây" – dùng chung cho thao tác và dòng gợi ý, nên gợi ý luôn đúng điều sẽ xảy ra. */
export type PlaceDecision =
  | { type: 'socket'; socket: SocketLike }
  | { type: 'surface'; surface: SurfaceLike; u: number; v: number }
  | { type: 'reject'; reason: 'noSurface' | 'full' }

export interface PlaceInput {
  kind: string
  /** Bán kính chiếm chỗ của vật đang cầm. */
  r: number
  /** Điểm bấm và mắt – toạ độ thế giới (cho ổ cắm). */
  point: V3T
  eye: V3T
  sockets: readonly SocketLike[]
  /** Điểm bấm và mắt – toạ độ cục bộ của vật được bấm (cho bề mặt). */
  localPoint: V3T
  localEye: V3T
  surfaces: readonly SurfaceLike[]
  /** Đồ đang chiếm chỗ trên từng bề mặt (theo tên bề mặt). */
  discs: (s: SurfaceLike) => readonly Disc[]
}

/**
 * Quyết định chỗ đặt: ổ cắm gần điểm bấm → ổ cắm sát đường ngắm → bề mặt dưới điểm bấm (đẩy ra khỏi vùng cấm phía người đứng,
 * tìm chỗ trống) → từ chối kèm lý do.
 */
export function decidePlace(i: PlaceInput): PlaceDecision {
  const [x, y, z] = i.point
  const sock = nearestSocket(i.sockets, i.kind, x, y, z) ?? socketOnRay(i.sockets, i.kind, i.eye, i.point)
  if (sock) return { type: 'socket', socket: sock }
  const [lx, ly, lz] = i.localPoint
  const s = surfaceAt(i.surfaces, lx, ly, lz)
  if (!s) return { type: 'reject', reason: 'noSurface' }
  const [pu, pv] = pushOutOfBlocked(s, lx, lz, i.r, i.localEye[0], i.localEye[2])
  const spot = freeSpot(s, pu, pv, i.r, i.discs(s))
  if (!spot) return { type: 'reject', reason: 'full' }
  return { type: 'surface', surface: s, u: spot[0], v: spot[1] }
}
