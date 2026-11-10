import { describe, expect, it } from 'vitest'
import { blockedAt, decidePlace, type Disc, type PlaceInput, type SocketLike, type SurfaceLike } from '../../src/lab/interact/placement'

/**
 * Ma trận "cầm X, bấm Y" trên mô hình rút gọn của bàn đảo (toạ độ bàn = toạ độ thế giới):
 * mặt bàn y 9 có đế kệ giữa là vùng cấm, kệ trên y 12,7, giá ống nghiệm, kẹp giá đỡ, ngọn lửa đèn cồn, kiềng của bộ đun.
 * Mỗi kết quả phải là một trong: cắm ổ nhận đúng loại, đặt lên bề mặt ở chỗ hợp lệ, từ chối có lý do.
 */
const top: SurfaceLike = { name: 'top', y: 9, minX: -19.7, maxX: 19.7, minZ: -7.2, maxZ: 7.2, blocked: [{ minX: -20.3, maxX: 20.3, minZ: -1.9, maxZ: 1.9 }] }
const shelf: SurfaceLike = { name: 'shelf0', y: 12.7, minX: -20, maxX: 20, minZ: -1.3, maxZ: 1.3 }
const SURFACES = [top, shelf]
const sock = (key: string, x: number, y: number, z: number, radius: number, accepts: string[], occupied = false): SocketLike => ({ key, x, y, z, radius, accepts, occupied })
const SOCKETS: SocketLike[] = [
  sock('rack:slot0', -12, 9.6, -4.5, 0.12, ['testTube']),
  sock('rack:slot1', -11.7, 9.6, -4.5, 0.12, ['testTube'], true),
  sock('stand:clamp', -19, 12, -4.6, 0.2, ['testTube', 'burette', 'thermometer', 'erlenmeyer250']),
  sock('lamp:flame', -1.5, 10.5, -5.2, 0.3, ['testTube', 'crucible', 'evaporatingDish']),
  sock('heat:top', 5, 10.8, -5, 0.4, ['beaker100', 'beaker250', 'beaker500', 'erlenmeyer250', 'roundFlask', 'evaporatingDish']),
]
const KINDS: [string, number][] = [
  ['testTube', 0.25], ['beaker250', 0.4], ['erlenmeyer250', 0.45], ['reagentBottle', 0.3], ['nail', 0.25], ['thermometer', 0.25], ['deliveryTube', 0.4],
]
const EYES: [number, number, number][] = [[0, 15, -16], [0, 15, 16], [-25, 14, 0]]

function input(kind: string, r: number, point: [number, number, number], eye: [number, number, number], discs: Disc[] = []): PlaceInput {
  return { kind, r, point, eye, sockets: SOCKETS, localPoint: point, localEye: eye, surfaces: SURFACES, discs: () => discs }
}

describe('cầm X, bấm Y', () => {
  it('mọi kết quả hợp lệ trên toàn bàn (lưới 0,5 dm × 3 độ cao bấm × 3 chỗ đứng × 7 loại đồ)', () => {
    let n = 0
    for (const [kind, r] of KINDS)
      for (const eye of EYES)
        for (let x = -20; x <= 20; x += 0.5)
          for (let z = -7.5; z <= 7.5; z += 0.5)
            for (const y of [9, 10.5, 12.8]) {
              const d = decidePlace(input(kind, r, [x, y, z], eye))
              n++
              if (d.type === 'socket') {
                expect(d.socket.accepts, `${kind} → ${d.socket.key}`).toContain(kind)
                expect(d.socket.occupied).toBe(false)
              } else if (d.type === 'surface') {
                const s = d.surface
                expect(d.u).toBeGreaterThanOrEqual(s.minX + r - 1e-9)
                expect(d.u).toBeLessThanOrEqual(s.maxX - r + 1e-9)
                expect(d.v).toBeGreaterThanOrEqual(s.minZ + r - 1e-9)
                expect(d.v).toBeLessThanOrEqual(s.maxZ - r + 1e-9)
                expect(blockedAt(s, d.u, d.v, r), `${kind} tại (${x}, ${y}, ${z}) → (${d.u}, ${d.v})`).toBeNull()
              } else expect(['noSurface', 'full']).toContain(d.reason)
            }
    expect(n).toBeGreaterThan(10000)
  }, 30000)

  it('bấm vòi gas trên đế kệ: đặt ở mép đế phía người đứng', () => {
    const front = decidePlace(input('testTube', 0.25, [-16, 10.5, 1.2], [-16, 15, 16]))
    expect(front.type).toBe('surface')
    if (front.type === 'surface') expect(front.v).toBeGreaterThan(1.9)
    const back = decidePlace(input('testTube', 0.25, [-16, 10.5, -1.2], [-16, 15, -16]))
    if (back.type === 'surface') expect(back.v).toBeLessThan(-1.9)
  })

  it('ống nghiệm: cắm giá, kẹp giá đỡ, lên lửa; ổ đã có vật bị bỏ qua', () => {
    expect(decidePlace(input('testTube', 0.25, [-12, 9.7, -4.5], [-12, 15, -16]))).toMatchObject({ type: 'socket', socket: { key: 'rack:slot0' } })
    expect(decidePlace(input('testTube', 0.25, [-11.7, 9.7, -4.5], [-12, 15, -16]))).toMatchObject({ type: 'socket', socket: { key: 'rack:slot0' } })
    expect(decidePlace(input('testTube', 0.25, [-1.5, 10.6, -5.2], [-1.5, 15, -16]))).toMatchObject({ type: 'socket', socket: { key: 'lamp:flame' } })
    // Tia xuyên qua vòng kẹp mảnh, trúng mặt bàn phía sau.
    // Mắt (−19; 14; −16), kẹp (−19; 12; −4,6): đường ngắm đi qua kẹp rồi chạm mặt phẳng y 9 ở z = 12,5 (phía sau kẹp).
    const eye: [number, number, number] = [-19, 14, -16]
    const behind: [number, number, number] = [-19, 9, -16 + 2.5 * (-4.6 + 16)]
    expect(decidePlace(input('testTube', 0.25, behind, eye))).toMatchObject({ type: 'socket', socket: { key: 'stand:clamp' } })
  })

  it('đồ không hợp ổ thì đặt lên bàn, không bị "hút" vào ổ', () => {
    const d = decidePlace(input('reagentBottle', 0.3, [-12, 9.05, -4.5], [-12, 15, -16]))
    expect(d.type).toBe('surface')
    const b = decidePlace(input('beaker250', 0.4, [-1.5, 10.6, -5.2], [-1.5, 15, -16]))
    expect(b.type).not.toBe('socket')
    expect(decidePlace(input('beaker250', 0.4, [5, 10.9, -5], [5, 15, -16]))).toMatchObject({ type: 'socket', socket: { key: 'heat:top' } })
  })

  it('từ chối có lý do: ngoài bề mặt, chỗ đã kín', () => {
    expect(decidePlace(input('beaker250', 0.4, [0, 20, -5], [0, 25, -16]))).toEqual({ type: 'reject', reason: 'noSurface' })
    const crowd: Disc[] = []
    for (let x = -19.7; x <= 19.7; x += 0.3) for (let z = -7.2; z <= 7.2; z += 0.3) crowd.push({ u: x, v: z, r: 0.3 })
    expect(decidePlace(input('beaker250', 0.4, [0, 9.05, -5], [0, 15, -16], crowd))).toEqual({ type: 'reject', reason: 'full' })
  })
})
