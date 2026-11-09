/**
 * Bố cục phòng lab – nguồn sự thật duy nhất về vị trí và kích thước. Đơn vị dm (1 đơn vị = 1 dm, như kit lab3d).
 * Gốc ở tâm sàn, Y hướng lên. Tường Z− giảng dạy (cửa vào), Z+ cửa sổ, X− an toàn, X+ kho.
 * Kích thước: w theo X, h theo Y, d theo Z (đã theo hướng đặt trong phòng). Tâm là tâm ĐÁY (y = đáy).
 */
export type LayoutKind =
  | 'floor' | 'ceiling' | 'wall' | 'door' | 'window' | 'bench' | 'shelf' | 'fume' | 'cabinet' | 'cart' | 'stool'
  | 'board' | 'poster' | 'sign' | 'safety' | 'bin' | 'light' | 'vent' | 'striping' | 'clock' | 'hooks' | 'pegboard'

export type Facing = '+x' | '-x' | '+z' | '-z'

export interface LayoutItem {
  id: string
  kind: LayoutKind
  x: number
  /** Độ cao đáy (mặc định 0). */
  y?: number
  z: number
  w: number
  h: number
  d: number
  /** Mặt trước hướng về đâu (để dựng vật thể ở chặng 3). */
  facing?: Facing
  collider?: boolean
  label?: string
}

export const ROOM = { minX: -48, maxX: 48, minZ: -42, maxZ: 42, height: 30, worktopY: 9, eyeY: 16.5 } as const
/** Bán kính thân người chơi (dm) khi va chạm. */
export const BODY_RADIUS = 2.5

export interface Pose { x: number; z: number; yawDeg: number; y?: number; pitchDeg?: number }
/** Đứng trong cửa ra vào, nhìn vào phòng (+Z). */
export const SPAWN: Pose = { x: -35, z: -37, yawDeg: 0 }

const T = 2 // bề dày tường
const items: LayoutItem[] = [
  { id: 'floor', kind: 'floor', x: 0, z: 0, w: 96, h: 0, d: 84 },
  { id: 'ceiling', kind: 'ceiling', x: 0, y: 30, z: 0, w: 96, h: 0, d: 84 },
  { id: 'wall_teach', kind: 'wall', x: 0, z: -42 - T / 2, w: 96 + 2 * T, h: 30, d: T, collider: true },
  { id: 'wall_window', kind: 'wall', x: 0, z: 42 + T / 2, w: 96 + 2 * T, h: 30, d: T, collider: true },
  { id: 'wall_safety', kind: 'wall', x: -48 - T / 2, z: 0, w: T, h: 30, d: 84, collider: true },
  { id: 'wall_store', kind: 'wall', x: 48 + T / 2, z: 0, w: T, h: 30, d: 84, collider: true },
  { id: 'door', kind: 'door', x: -35, z: -41.75, w: 9, h: 21, d: 0.5, facing: '+z' },
  ...[-33, -11, 11, 33].map((x, i): LayoutItem => ({ id: `window_${i + 1}`, kind: 'window', x, y: 13, z: 41.75, w: 16, h: 12, d: 0.5, facing: '-z' })),

  // Bàn: lối đi theo Z (từ tường giảng dạy): 6 · bàn GV 7 · 7 · ghế 3 · đảo 1 15 · ghế 3 · 8 · ghế 3 · đảo 2 15 · ghế 3 · 7,5 · bàn tường 6,5
  { id: 'bench_teacher', kind: 'bench', x: 0, z: -32.5, w: 30, h: 9, d: 7, facing: '+z', collider: true, label: 'Bàn giáo viên' },
  { id: 'bench_island_1', kind: 'bench', x: 0, z: -11.5, w: 48, h: 9, d: 15, collider: true, label: 'Bàn đảo 1' },
  { id: 'bench_island_2', kind: 'bench', x: 0, z: 17.5, w: 48, h: 9, d: 15, collider: true, label: 'Bàn đảo 2' },
  { id: 'shelf_spine_1', kind: 'shelf', x: 0, y: 9, z: -11.5, w: 40, h: 8.5, d: 3 },
  { id: 'shelf_spine_2', kind: 'shelf', x: 0, y: 9, z: 17.5, w: 40, h: 8.5, d: 3 },
  { id: 'bench_wall_window', kind: 'bench', x: -1.75, z: 38.75, w: 86.5, h: 9, d: 6.5, facing: '-z', collider: true, label: 'Bàn tường cửa sổ' },
  { id: 'bench_wall_store', kind: 'bench', x: 44.75, z: 31, w: 6.5, h: 9, d: 22, facing: '-x', collider: true, label: 'Bàn tường kho' },
  { id: 'fume_cupboard', kind: 'fume', x: 43.5, z: -26, w: 9, h: 24, d: 15, facing: '-x', collider: true, label: 'Tủ hút' },
  { id: 'cabinet_flammables', kind: 'cabinet', x: 45.5, z: -13, w: 5, h: 18, d: 9, facing: '-x', collider: true, label: 'Tủ chất dễ cháy' },
  { id: 'cupboard_glazed_1', kind: 'cabinet', x: 45.75, z: 0, w: 4.5, h: 20, d: 10, facing: '-x', collider: true, label: 'Tủ kính 1' },
  { id: 'cupboard_glazed_2', kind: 'cabinet', x: 45.75, z: 10, w: 4.5, h: 20, d: 10, facing: '-x', collider: true, label: 'Tủ kính 2' },
  { id: 'cart', kind: 'cart', x: -41, z: -30, w: 8, h: 9, d: 5, collider: true, label: 'Xe đẩy' },

  // Tường giảng dạy (mặt trong z = −42)
  { id: 'whiteboard', kind: 'board', x: 6, y: 9.5, z: -41.8, w: 24, h: 12, d: 0.4, facing: '+z', label: 'Bảng trắng' },
  { id: 'clock', kind: 'clock', x: 6, y: 22.5, z: -41.8, w: 3, h: 3, d: 0.4, facing: '+z' },
  { id: 'poster_hazard', kind: 'poster', x: -19, y: 13.5, z: -41.9, w: 6, h: 8.5, d: 0.2, facing: '+z', label: 'Biểu tượng nguy hiểm' },
  { id: 'poster_rules', kind: 'poster', x: -12, y: 13.5, z: -41.9, w: 6, h: 8.5, d: 0.2, facing: '+z', label: 'Nội quy an toàn' },
  { id: 'pinboard', kind: 'board', x: 24, y: 11, z: -41.8, w: 12, h: 9, d: 0.4, facing: '+z', label: 'Bảng ghim' },
  { id: 'coat_hooks', kind: 'hooks', x: -26, y: 17, z: -41.6, w: 6, h: 1, d: 0.8, facing: '+z', label: 'Móc áo blouse' },
  { id: 'exit_sign', kind: 'sign', x: -35, y: 22.5, z: -41.9, w: 3, h: 1.5, d: 0.2, facing: '+z', label: 'Lối ra' },
  // Tường kho, tường cửa sổ
  { id: 'poster_periodic', kind: 'poster', x: 47.9, y: 13, z: -38, w: 0.2, h: 10, d: 7, facing: '-x', label: 'Bảng tuần hoàn' },
  { id: 'pegboard', kind: 'pegboard', x: 43, y: 13, z: 41.8, w: 8, h: 8, d: 0.4, facing: '-z', label: 'Giá phơi dụng cụ' },

  // Trạm an toàn (tường X−)
  { id: 'shower_eyewash', kind: 'safety', x: -45, z: -10, w: 2, h: 23, d: 2, collider: true, label: 'Vòi sen khẩn cấp + rửa mắt' },
  { id: 'floor_striping', kind: 'striping', x: -42, y: 0.01, z: -10, w: 12, h: 0.02, d: 12 },
  { id: 'first_aid', kind: 'safety', x: -47.4, y: 15.5, z: -23, w: 1.2, h: 3, d: 3, facing: '+x', label: 'Tủ sơ cứu' },
  { id: 'fire_blanket', kind: 'safety', x: -47.5, y: 14.5, z: -19, w: 1, h: 3, d: 3, facing: '+x', label: 'Chăn chữa cháy' },
  { id: 'extinguisher', kind: 'safety', x: -46.5, y: 8, z: -16, w: 1.6, h: 5.5, d: 1.6, label: 'Bình cứu hỏa' },
  ...[-23, -19, -16, -10].map((z, i): LayoutItem => ({ id: `sign_safety_${i + 1}`, kind: 'sign', x: -47.9, y: 21, z, w: 0.2, h: 3, d: 2.5, facing: '+x' })),
  { id: 'bin_steel', kind: 'bin', x: -44, z: 5, w: 4, h: 6, d: 4, collider: true, label: 'Thùng rác' },
  { id: 'bin_sharps', kind: 'bin', x: -45.5, z: 10, w: 2.5, h: 4, d: 2.5, collider: true, label: 'Thùng mảnh vỡ' },

  // Trần
  ...[-36, -12, 12, 36].flatMap((x) => [-30, -10, 10, 30].map((z): LayoutItem => ({ id: `light_${x}_${z}`, kind: 'light', x, y: 29.5, z, w: 12, h: 0.5, d: 6 }))),
  { id: 'vent_1', kind: 'vent', x: -24, y: 29.8, z: 0, w: 6, h: 0.2, d: 6 },
  { id: 'vent_2', kind: 'vent', x: 24, y: 29.8, z: 0, w: 6, h: 0.2, d: 6 },
]

/** Ghế đẩu: 4 ghế phía Z− mỗi bàn đảo, 3 ghế phía Z+. */
const STOOL = 3
const stoolRows: [number, number[]][] = [
  [-20.5, [-18, -6, 6, 18]],
  [-2.5, [-12, 0, 12]],
  [8.5, [-18, -6, 6, 18]],
  [26.5, [-12, 0, 12]],
]
let n = 0
for (const [z, xs] of stoolRows) for (const x of xs) items.push({ id: `stool_${String(++n).padStart(2, '0')}`, kind: 'stool', x, z, w: STOOL, h: 6.5, d: STOOL, collider: true })

export const LAYOUT: readonly LayoutItem[] = items

export interface Box2 { id: string; minX: number; maxX: number; minZ: number; maxZ: number }

export function boxOf(i: LayoutItem): Box2 {
  return { id: i.id, minX: i.x - i.w / 2, maxX: i.x + i.w / 2, minZ: i.z - i.d / 2, maxZ: i.z + i.d / 2 }
}

/** Hộp va chạm trên mặt sàn (XZ). */
export function getColliders(layout: readonly LayoutItem[] = LAYOUT): Box2[] {
  return layout.filter((i) => i.collider).map(boxOf)
}

/** Điểm nhìn nhanh (phím F5). */
export const VIEWPOINTS: { id: string; label: string; pose: Pose }[] = [
  { id: 'door', label: 'Cửa ra vào', pose: SPAWN },
  { id: 'teacher', label: 'Bàn giáo viên', pose: { x: 0, z: -39, yawDeg: 0 } },
  { id: 'safety', label: 'Trạm an toàn', pose: { x: -30, z: -10, yawDeg: -90, pitchDeg: -5 } },
  { id: 'fume', label: 'Tủ hút', pose: { x: 30, z: -26, yawDeg: 90 } },
  { id: 'aisle', label: 'Giữa hai bàn đảo', pose: { x: -20, z: 3, yawDeg: 90 } },
  { id: 'window', label: 'Bàn tường cửa sổ', pose: { x: 0, z: 31, yawDeg: 0, pitchDeg: -15 } },
  { id: 'top', label: 'Toàn cảnh từ trên', pose: { x: 0, y: 120, z: -0.01, yawDeg: 180, pitchDeg: -89.9 } },
]

/** Chỗ người chơi cần đứng được (test kiểm tra đi tới được từ SPAWN). */
export const STANDING_SPOTS: { id: string; x: number; z: number }[] = [
  { id: 'behind_teacher', x: 0, z: -39 },
  { id: 'island1_front', x: -12, z: -26 },
  { id: 'island1_back_aisle', x: -18, z: 3 },
  { id: 'island2_back', x: 6, z: 31.5 },
  { id: 'wall_bench_front', x: -30, z: 31.5 },
  { id: 'fume_front', x: 34, z: -26 },
  { id: 'flammables_front', x: 38, z: -13 },
  { id: 'glazed_front', x: 38, z: 5 },
  { id: 'store_bench_front', x: 36, z: 31 },
  { id: 'safety_station', x: -38, z: -10 },
  { id: 'cart', x: -34, z: -30 },
]
