import { describe, expect, it } from 'vitest'
import '../../src/lab/builders/furniture'
import '../../src/lab/builders/fixtures'
import '../../src/lab/builders/safety'
import '../../src/lab/builders/kitItems'
import '../../src/lab/builders/glasswareExtra'
import '../../src/lab/builders/composites'
import { listKinds } from '../../src/lab/builders/registry'
import { LAYOUT } from '../../src/lab/layout'
import { POPULATION } from '../../src/lab/room/population'
import { findSpecies } from '../../src/chem/index'

/** Bề mặt mà builder của vật cha khai báo (theo loại layout). */
const SURFACES: Record<string, string[]> = {
  bench_island_1: ['top', 'shelf0', 'shelf1'], bench_island_2: ['top', 'shelf0', 'shelf1'], bench_teacher: ['top'], bench_wall_window: ['top'],
  bench_wall_store: ['top'], fume_cupboard: ['hood'], cupboard_glazed_1: ['shelf0', 'shelf1', 'shelf2'], cupboard_glazed_2: ['shelf0', 'shelf1', 'shelf2'],
  cart: ['tier0', 'tier1'],
}

describe('danh sách bày đồ', () => {
  const kinds = new Set(listKinds().map((e) => e.kind))
  it('id không trùng, không trùng id layout', () => {
    const ids = [...LAYOUT.map((i) => i.id), ...POPULATION.map((p) => p.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('loại vật đã đăng ký', () => {
    for (const p of POPULATION) expect(kinds.has(p.kind), `${p.id}: ${p.kind}`).toBe(true)
  })
  it('vật cha có trong layout và có bề mặt được chọn', () => {
    for (const p of POPULATION) {
      expect(SURFACES[p.on], `${p.id}: ${p.on}`).toBeTruthy()
      if (!p.socket) expect(SURFACES[p.on], `${p.id}: ${p.surface ?? 'top'}`).toContain(p.surface ?? 'top')
    }
  })
  it('chai thuốc thử dùng chất có trong bộ máy hóa học', () => {
    for (const p of POPULATION.filter((x) => x.kind === 'reagentBottle')) expect(findSpecies(String(p.params?.species)), p.id).toBeTruthy()
  })
  it('đủ chai/lọ hóa chất (59: 41 dung dịch kể cả 3 axit đặc, 6 chỉ thị, 12 chất rắn)', () => {
    expect(POPULATION.filter((x) => x.kind === 'reagentBottle' || x.kind === 'dropperBottle').length).toBeGreaterThanOrEqual(55)
  })
})
