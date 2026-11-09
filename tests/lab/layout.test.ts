import { describe, expect, it } from 'vitest'
import { overlaps, resolveCircleAABB, resolveCollisions } from '../../src/lab/collision'
import { BODY_RADIUS, boxOf, getColliders, LAYOUT, ROOM, SPAWN, STANDING_SPOTS } from '../../src/lab/layout'

describe('layout', () => {
  it('id không trùng', () => {
    const ids = LAYOUT.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('mọi vật (trừ tường) nằm trong phòng', () => {
    for (const i of LAYOUT.filter((i) => i.kind !== 'wall')) {
      const b = boxOf(i)
      expect(b.minX, i.id).toBeGreaterThanOrEqual(ROOM.minX - 1e-9)
      expect(b.maxX, i.id).toBeLessThanOrEqual(ROOM.maxX + 1e-9)
      expect(b.minZ, i.id).toBeGreaterThanOrEqual(ROOM.minZ - 1e-9)
      expect(b.maxZ, i.id).toBeLessThanOrEqual(ROOM.maxZ + 1e-9)
      expect((i.y ?? 0) + i.h, i.id).toBeLessThanOrEqual(ROOM.height + 1e-9)
    }
  })
  it('đủ 14 ghế, 4 tường, các bàn chính có va chạm', () => {
    expect(LAYOUT.filter((i) => i.kind === 'stool')).toHaveLength(14)
    const ids = getColliders().map((b) => b.id)
    for (const id of ['wall_teach', 'wall_window', 'wall_safety', 'wall_store', 'bench_teacher', 'bench_island_1', 'bench_island_2', 'bench_wall_window', 'fume_cupboard'])
      expect(ids).toContain(id)
  })
  it('đồ có va chạm (trừ ghế với bàn đảo) không chồng nhau', () => {
    const boxes = getColliders().filter((b) => !b.id.startsWith('wall'))
    for (const a of boxes) for (const b of boxes) {
      if (a.id >= b.id || a.id.startsWith('stool') || b.id.startsWith('stool')) continue
      const hit = a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ
      expect(hit, `${a.id} × ${b.id}`).toBe(false)
    }
  })
  it('chỗ xuất phát và mọi chỗ đứng đều trống', () => {
    const boxes = getColliders()
    expect(overlaps(SPAWN.x, SPAWN.z, BODY_RADIUS, boxes)).toBe(false)
    for (const s of STANDING_SPOTS) expect(overlaps(s.x, s.z, BODY_RADIUS, boxes), s.id).toBe(false)
  })
  it('từ cửa đi tới được mọi chỗ đứng (lưới 0,5 dm)', () => {
    const boxes = getColliders()
    const step = 0.5
    const nx = Math.round((ROOM.maxX - ROOM.minX) / step)
    const nz = Math.round((ROOM.maxZ - ROOM.minZ) / step)
    const key = (i: number, j: number) => i * (nz + 1) + j
    const free = (i: number, j: number) => !overlaps(ROOM.minX + i * step, ROOM.minZ + j * step, BODY_RADIUS, boxes)
    const toIdx = (x: number, z: number) => [Math.round((x - ROOM.minX) / step), Math.round((z - ROOM.minZ) / step)] as const
    const seen = new Set<number>()
    const [si, sj] = toIdx(SPAWN.x, SPAWN.z)
    const queue: [number, number][] = [[si, sj]]
    seen.add(key(si, sj))
    while (queue.length) {
      const [i, j] = queue.shift()!
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di!
        const b = j + dj!
        if (a < 0 || b < 0 || a > nx || b > nz || seen.has(key(a, b)) || !free(a, b)) continue
        seen.add(key(a, b))
        queue.push([a, b])
      }
    }
    for (const s of STANDING_SPOTS) {
      const [i, j] = toIdx(s.x, s.z)
      expect(seen.has(key(i, j)), s.id).toBe(true)
    }
  })
  it('lối giữa hai bàn đảo (giữa hai hàng ghế) rộng ≥ 6 dm', () => {
    const rowA = LAYOUT.find((i) => i.id === 'stool_05')!
    const rowB = LAYOUT.find((i) => i.id === 'stool_08')!
    expect(rowB.z - rowB.d / 2 - (rowA.z + rowA.d / 2)).toBeGreaterThanOrEqual(6)
  })
})

describe('va chạm', () => {
  const box = { id: 'b', minX: 0, maxX: 10, minZ: 0, maxZ: 4 }
  it('ở xa không đổi', () => expect(resolveCircleAABB(-5, 2, 2.5, box)).toEqual([-5, 2]))
  it('chạm cạnh trái bị đẩy ra', () => {
    const [x, z] = resolveCircleAABB(-1, 2, 2.5, box)
    expect(x).toBeCloseTo(-2.5)
    expect(z).toBeCloseTo(2)
  })
  it('tâm trong hộp ra cạnh gần nhất', () => {
    const [x, z] = resolveCircleAABB(5, 3.5, 2.5, box)
    expect(x).toBeCloseTo(5)
    expect(z).toBeCloseTo(6.5)
  })
  it('đi chéo vào góc tường không kẹt', () => {
    const walls = [{ id: 'w1', minX: -10, maxX: 10, minZ: 10, maxZ: 12 }, { id: 'w2', minX: 10, maxX: 12, minZ: -10, maxZ: 12 }]
    let x = 5
    let z = 5
    for (let i = 0; i < 50; i++) [x, z] = resolveCollisions(x + 0.3, z + 0.3, 2.5, walls)
    expect(overlaps(x, z, 2.5, walls)).toBe(false)
    expect(x).toBeCloseTo(7.5, 5)
    expect(z).toBeCloseTo(7.5, 5)
  })
  it('trượt dọc tường', () => {
    const wall = [{ id: 'w', minX: -50, maxX: 50, minZ: 10, maxZ: 12 }]
    let x = 0
    let z = 7.5
    for (let i = 0; i < 10; i++) [x, z] = resolveCollisions(x + 0.5, z + 0.5, 2.5, wall)
    expect(x).toBeCloseTo(5)
    expect(z).toBeCloseTo(7.5)
  })
})
