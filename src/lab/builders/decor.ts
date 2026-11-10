import * as THREE from 'three'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import { group, makeKit } from './helpers'
import { register } from './registry'

/**
 * Đồ trang trí bàn giáo viên theo ảnh mẫu: mô hình phân tử (quả cầu – que nối, màu CPK) và chồng sách.
 * Cầm lên xem được, không tham gia hóa học.
 */
const CPK: Record<string, number> = { H: 0xf4f4f4, C: 0x2b2b2b, O: 0xd8261f, N: 0x2f5fd0 }
const RADIUS: Record<string, number> = { H: 0.16, C: 0.24, O: 0.24, N: 0.24 }

function atomMat(ctx: Tracker, el: string): THREE.Material {
  return ctx.track(new THREE.MeshPhysicalMaterial({ color: CPK[el], roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.15 }))
}

/** Phân tử: nguyên tử trung tâm + các nguyên tử nối theo hướng cho trước (độ dài liên kết 0,6 dm). */
function molecule(ctx: Tracker, center: string, around: [string, THREE.Vector3][]) {
  const k = makeKit(ctx)
  const g = new THREE.Group()
  const c = k.sphere(RADIUS[center]!, atomMat(ctx, center))
  g.add(c)
  const stick = ctx.track(new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.4 }))
  for (const [el, dir] of around) {
    const d = dir.clone().normalize()
    const end = d.clone().multiplyScalar(0.6)
    const a = k.sphere(RADIUS[el]!, atomMat(ctx, el))
    a.position.copy(end)
    // Trụ của makeKit có gốc ở đáy: quay trục +y theo hướng liên kết, đặt gốc ở tâm nguyên tử giữa.
    const s = k.cyl(0.04, 0.04, 0.6, stick)
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)
    g.add(a, s)
  }
  return g
}

register('moleculeModel', 'apparatus', (ctx, p = {}) => {
  const kind = (p.molecule as string) ?? 'CH4'
  const t = 1 / Math.sqrt(3)
  const a = 0.91 // nửa góc H–O–H ≈ 104,5°
  const m =
    kind === 'H2O'
      ? molecule(ctx, 'O', [['H', new THREE.Vector3(Math.sin(a), -Math.cos(a), 0)], ['H', new THREE.Vector3(-Math.sin(a), -Math.cos(a), 0)]])
      : molecule(ctx, 'C', [['H', new THREE.Vector3(t, t, t)], ['H', new THREE.Vector3(-t, -t, t)], ['H', new THREE.Vector3(-t, t, -t)], ['H', new THREE.Vector3(t, -t, -t)]])
  // Nâng cho nguyên tử thấp nhất chạm mặt bàn (gốc nhóm ở tâm đáy như mọi vật khác).
  m.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(m)
  m.position.y = -box.min.y
  const name = kind === 'H2O' ? 'Mô hình phân tử H₂O' : 'Mô hình phân tử CH₄'
  return group('moleculeModel', { kind: 'moleculeModel', displayName: name, category: 'apparatus', grabbable: true, footprint: { w: 1.3, d: 1.3, h: 1.3 } }, m)
}, [{ molecule: 'CH4' }, { molecule: 'H2O' }])

register('bookStack', 'apparatus', (ctx) => {
  const k = makeKit(ctx)
  const g = new THREE.Group()
  const covers = [0xe2712d, 0x2f7d4f, 0x2c5aa0]
  let y = 0
  covers.forEach((c, i) => {
    const h = 0.32 + i * 0.04
    const cover = ctx.track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }))
    const book = k.box(2.1 - i * 0.1, h, 1.5 - i * 0.05, cover, 0, y, 0, 0.03)
    // Ruột sách (mép giấy trắng) lộ ở ba cạnh.
    const pages = k.box(2.04 - i * 0.1, h - 0.08, 1.44 - i * 0.05, 'paper', 0.04, y + 0.04, 0)
    book.rotation.y = pages.rotation.y = (i - 1) * 0.12
    g.add(book, pages)
    y += h
  })
  return group('bookStack', { kind: 'bookStack', displayName: 'Sách giáo khoa Hóa học', category: 'apparatus', grabbable: true, footprint: { w: 2.2, d: 1.6, h: y } }, g)
})
