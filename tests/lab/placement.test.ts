import { describe, expect, it } from 'vitest'
import { blockedAt, clampInto, freeSpot, nearestSocket, overlaps, pushOutOfBlocked, socketOnRay, surfaceAt } from '../../src/lab/interact/placement'

const top = { name: 'top', y: 9, minX: -10, maxX: 10, minZ: -3, maxZ: 3 }
const shelf = { name: 'shelf0', y: 12.7, minX: -8, maxX: 8, minZ: -1.3, maxZ: 1.3 }

describe('đặt đồ', () => {
  it('chọn bề mặt theo độ cao điểm bấm', () => {
    expect(surfaceAt([top, shelf], 0, 9.1, 0)?.name).toBe('top')
    expect(surfaceAt([top, shelf], 0, 12.9, 0)?.name).toBe('shelf0')
    expect(surfaceAt([top, shelf], 15, 9, 0)).toBeNull()
  })
  it('kẹp vào trong bề mặt', () => {
    expect(clampInto(top, 12, 5, 1)).toEqual([9, 2])
  })
  it('chồng chéo', () => {
    expect(overlaps({ u: 0, v: 0, r: 0.5 }, [{ u: 0.8, v: 0, r: 0.5 }])).toBe(true)
    expect(overlaps({ u: 0, v: 0, r: 0.5 }, [{ u: 1.2, v: 0, r: 0.5 }])).toBe(false)
  })
  it('tìm chỗ trống gần nhất', () => {
    const spot = freeSpot(top, 0, 0, 0.5, [{ u: 0, v: 0, r: 0.5 }])!
    expect(Math.hypot(spot[0], spot[1])).toBeGreaterThanOrEqual(1.05 - 1e-9)
    expect(Math.hypot(spot[0], spot[1])).toBeLessThan(2.1)
    expect(freeSpot({ ...top, minX: -0.5, maxX: 0.5, minZ: -0.5, maxZ: 0.5 }, 0, 0, 0.5, [{ u: 0, v: 0, r: 0.5 }])).toBeNull()
  })
  it('ổ cắm gần nhất nhận đúng loại, bỏ ổ đã có vật', () => {
    const sockets = [
      { key: 'a', x: 0, y: 9.5, z: 0, radius: 0.12, accepts: ['testTube'], occupied: true },
      { key: 'b', x: 0.3, y: 9.5, z: 0, radius: 0.12, accepts: ['testTube'], occupied: false },
      { key: 'c', x: 0.1, y: 9.5, z: 0, radius: 0.4, accepts: ['beaker250'], occupied: false },
    ]
    expect(nearestSocket(sockets, 'testTube', 0, 9.6, 0)?.key).toBe('b')
    expect(nearestSocket(sockets, 'beaker250', 0, 9.6, 0)?.key).toBe('c')
    expect(nearestSocket(sockets, 'testTube', 5, 9.6, 0)).toBeNull()
  })
  it('vùng cấm (đế kệ giữa bàn đảo): không bao giờ đặt đồ vào trong', () => {
    const island = { name: 'top', y: 9, minX: -20, maxX: 20, minZ: -7, maxZ: 7, blocked: [{ minX: -20.3, maxX: 20.3, minZ: -1.9, maxZ: 1.9 }] }
    // Bấm thẳng vào vòi gas trên đế (z = 1,2), người đứng phía trước (z = +15): đẩy ra mép trước.
    const [u, v] = pushOutOfBlocked(island, 0, 1.2, 0.3, 0, 15)
    expect(v).toBeGreaterThanOrEqual(1.9 + 0.3)
    expect(blockedAt(island, u, v, 0.3)).toBeNull()
    // Người đứng phía sau: đẩy ra mép sau.
    expect(pushOutOfBlocked(island, 0, 1.2, 0.3, 0, -15)[1]).toBeLessThanOrEqual(-1.9 - 0.3)
    // Quét lưới: mọi chỗ freeSpot trả về đều nằm ngoài vùng cấm.
    for (let x = -20; x <= 20; x += 0.5)
      for (let z = -7; z <= 7; z += 0.5) {
        const [pu, pv] = pushOutOfBlocked(island, x, z, 0.3, x, 15)
        const spot = freeSpot(island, pu, pv, 0.3, [])
        expect(spot).not.toBeNull()
        expect(blockedAt(island, spot![0], spot![1], 0.3)).toBeNull()
      }
  })
  it('ổ cắm sát đường ngắm (tia xuyên qua vòng kẹp mảnh, trúng bàn phía sau)', () => {
    const clamp = { key: 'stand:clamp', x: 0, y: 12, z: 0, radius: 0.2, accepts: ['testTube'], occupied: false }
    // Mắt ở (0, 15, −10), tia đi qua gần kẹp rồi trúng mặt bàn ở (0, 9, 10).
    expect(socketOnRay([clamp], 'testTube', [0, 15, -10], [0, 9.2, 10])?.key).toBe('stand:clamp')
    expect(socketOnRay([clamp], 'beaker250', [0, 15, -10], [0, 9.2, 10])).toBeNull()
    expect(socketOnRay([clamp], 'testTube', [5, 15, -10], [5, 9, 10])).toBeNull()
  })
})
