import * as THREE from 'three'
import { setLabMaterialLook } from '../vendor/lab3d/lab/materials/look'
import { LAB_LOOKS } from '../vendor/lab3d/lab/room/lightingPresets'
import type { SimContext } from '../vendor/lab3d/sim/types'
import { ROOM } from './layout'

export interface RoomLighting {
  /** Vẽ lại bóng đổ tĩnh (gọi khi đồ vật đổi chỗ). */
  invalidateShadows(): void
}

/** Gọi TRƯỚC khi dựng đồ: vật liệu kính/dung dịch của kit đọc "giao diện" lúc tạo. */
export function prepareMaterialLook(ctx: SimContext): void {
  setLabMaterialLook(ctx, { ...LAB_LOOKS.bench.materials, whiteBody: '#dfe2e6' })
}

/**
 * Ánh sáng phòng: env phòng sáng của Engine (yếu), tone mapping Neutral (màu dung dịch đúng), bán cầu trời/sàn dịu,
 * đèn trần đặt dưới trần (bóng mềm dưới đồ vật), nắng chéo qua lỗ cửa sổ (mảng sáng + bóng khung cửa), đèn bổ trợ yếu.
 * Bóng tĩnh (chỉ vẽ lại khi cần); theo chất lượng: high 2048, medium 1024, low tắt.
 */
export function createRoomLighting(ctx: SimContext): RoomLighting {
  const { scene, renderer, quality } = ctx
  // Môi trường phòng sáng mặc định của Engine (RoomEnvironment). Không dùng 'lab-studio' (phòng tối + softbox) của kit:
  // hợp cảnh cận một bàn nhưng làm mọi kim loại trong phòng lớn phản chiếu màu tối.
  scene.environmentIntensity = 0.32
  scene.background = new THREE.Color(0xdfe5ec)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.0

  // Ánh sáng nền dịu (trời/sàn) – thấp để còn vùng tối, tương phản như ảnh mẫu.
  const hemi = new THREE.HemisphereLight(0xeef3ff, 0x9c978e, 0.62)
  // Đèn trần: đặt ngay DƯỚI trần (y 29,5) nên mặt trần không chắn; cho bóng mềm dưới ghế, dụng cụ.
  const ceiling = new THREE.DirectionalLight(0xf2f6ff, 1.05)
  ceiling.position.set(6, 29.5, 10)
  ceiling.target.position.set(0, 0, 0)
  // Nắng: chiếu chéo từ ngoài cửa sổ (+Z) xuống; tường cửa sổ có lỗ + trần đổ bóng → chỉ mảng nắng lọt vào phòng.
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.1)
  sun.position.set(-30, 75, 120)
  sun.target.position.set(0, 0, 10)
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.22)
  fill.position.set(30, 40, -60)
  scene.add(hemi, ceiling, ceiling.target, sun, sun.target, fill)

  const shadows = quality !== 'low'
  renderer.shadowMap.enabled = shadows
  if (shadows) {
    const big = quality === 'high' ? 2048 : 1024
    const half = Math.max(ROOM.maxX, ROOM.maxZ) + 8
    const setup = (l: THREE.DirectionalLight, size: number, near: number, far: number, radius: number) => {
      l.castShadow = true
      l.shadow.mapSize.set(size, size)
      Object.assign(l.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near, far })
      l.shadow.camera.updateProjectionMatrix()
      l.shadow.bias = -0.0004
      l.shadow.normalBias = 0.04
      l.shadow.radius = radius
    }
    setup(sun, big, 40, 300, 2)
    setup(ceiling, Math.max(1024, big / 2), 0.1, 45, 6)
    // Phòng tĩnh: không vẽ lại bản đồ bóng mỗi khung.
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = true
    ctx.track(() => {
      renderer.shadowMap.autoUpdate = true
    })
  }
  return {
    invalidateShadows() {
      if (shadows) renderer.shadowMap.needsUpdate = true
    },
  }
}

/** Tường, trần, sàn, đèn trần không đổ bóng (đèn chính chiếu từ ngoài phòng). */
export function tuneShadowCasters(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const big = m.geometry.boundingSphere ?? (m.geometry.computeBoundingSphere(), m.geometry.boundingSphere)
    // Mặt phẳng lớn (tường, sàn, trần, khung trần) và vật trong suốt: không đổ bóng.
    const mat = m.material as THREE.Material
    if (m.userData.shadowCaster) return
    if ((big && big.radius > 30) || mat.transparent || (mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) m.castShadow = false
  })
}
