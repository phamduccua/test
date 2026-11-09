import { describe, expect, it } from 'vitest'
import { periodicCell } from '../../src/lab/textures/posters'

describe('bảng tuần hoàn', () => {
  const cases: [number, number, number][] = [
    [1, 1, 1], [2, 18, 1], [3, 1, 2], [5, 13, 2], [10, 18, 2], [13, 13, 3], [21, 3, 4], [36, 18, 4], [56, 2, 6], [57, 3, 9], [71, 17, 9],
    [72, 4, 6], [79, 11, 6], [86, 18, 6], [88, 2, 7], [89, 3, 10], [103, 17, 10], [104, 4, 7], [118, 18, 7],
  ]
  for (const [z, col, row] of cases) it(`Z=${z}`, () => expect(periodicCell(z)).toEqual({ col, row }))
  it('không hai nguyên tố trùng ô', () => {
    const seen = new Set<string>()
    for (let z = 1; z <= 118; z++) {
      const { col, row } = periodicCell(z)
      const k = `${col},${row}`
      expect(seen.has(k), `Z=${z} ${k}`).toBe(false)
      seen.add(k)
    }
  })
})
