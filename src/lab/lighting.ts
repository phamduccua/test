import * as THREE from 'three'
import { setLabMaterialLook } from '../vendor/lab3d/lab/materials/look'
import { LAB_LOOKS } from '../vendor/lab3d/lab/room/lightingPresets'
import type { SimContext } from '../vendor/lab3d/sim/types'
import { ROOM } from './layout'

export interface RoomLighting {
  /** Vẽ lại bóng đổ tĩnh (gọi khi đồ vật đổi chỗ). */
  invalidateShadows(): void
  /** Mỗi khung: vùng bóng nắng bám theo người chơi (vẽ lại khi đi quá 5 dm). */
  frame(eye: THREE.Vector3): void
  /** Chụp chính căn phòng làm ánh sáng môi trường (gọi một lần sau khi dựng xong đồ). */
  bakeEnvironment(): void
  /** Đã gắn lightmap: ánh sáng nền (bán cầu) giảm vì ánh dội đã có trong lightmap. */
  useLightmap(): void
}

/** Nửa cạnh vùng bóng nắng quanh người chơi (dm) và bước dời vùng. */
const SUN_HALF = 30
const SUN_STEP = 5
const SUN_OFFSET = new THREE.Vector3(-30, 75, 110)

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
  scene.environmentIntensity = 0.45
  scene.background = new THREE.Color(0xdfe5ec)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 0.95

  // Ánh sáng nền dịu (trời/sàn) – thấp để còn vùng tối, tương phản như ảnh mẫu.
  const hemi = new THREE.HemisphereLight(0xeef3ff, 0x9c978e, 0.5)
  // Đèn trần: đặt ngay DƯỚI trần (y 29,5) nên mặt trần không chắn; cho bóng mềm dưới ghế, dụng cụ.
  const ceiling = new THREE.DirectionalLight(0xf2f6ff, 1.05)
  ceiling.position.set(6, 29.5, 10)
  ceiling.target.position.set(0, 0, 0)
  // Nắng: chiếu chéo từ ngoài cửa sổ (+Z) xuống; tường cửa sổ có lỗ + trần đổ bóng → chỉ mảng nắng lọt vào phòng.
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.1)
  sun.target.position.set(0, 0, 10)
  sun.position.copy(sun.target.position).add(SUN_OFFSET)
  const fill = new THREE.DirectionalLight(0xe8f0ff, 0.22)
  fill.position.set(30, 40, -60)
  scene.add(hemi, ceiling, ceiling.target, sun, sun.target, fill)

  const shadows = quality !== 'low'
  renderer.shadowMap.enabled = shadows
  if (shadows) {
    const big = quality === 'high' ? 4096 : 1024
    const half = Math.max(ROOM.maxX, ROOM.maxZ) + 8
    const setup = (l: THREE.DirectionalLight, size: number, near: number, far: number, radius: number) => {
      l.castShadow = true
      l.shadow.mapSize.set(size, size)
      Object.assign(l.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near, far })
      l.shadow.camera.updateProjectionMatrix()
      // Nắng chiếu xiên lên tường: bias nhỏ để lại sọc ngang (shadow acne) – normalBias lớn hơn đẩy điểm lấy mẫu ra khỏi mặt.
      l.shadow.bias = -0.0005
      l.shadow.normalBias = 0.12
      l.shadow.radius = radius
    }
    setup(sun, big, 40, 300, 2)
    // Nắng: chỉ ±30 dm quanh người chơi → cùng bản đồ bóng mà mỗi điểm ảnh bóng nhỏ hơn ~3,5 lần (bóng khung cửa, chân ghế sắc nét).
    Object.assign(sun.shadow.camera, { left: -SUN_HALF, right: SUN_HALF, top: SUN_HALF, bottom: -SUN_HALF })
    sun.shadow.camera.updateProjectionMatrix()
    setup(ceiling, Math.max(1024, big / 2), 0.1, 45, 6)
    // Phòng tĩnh: không vẽ lại bản đồ bóng mỗi khung.
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = true
    ctx.track(() => {
      renderer.shadowMap.autoUpdate = true
    })
  }
  const snapped = new THREE.Vector3(Infinity, 0, Infinity)
  return {
    invalidateShadows() {
      if (shadows) renderer.shadowMap.needsUpdate = true
    },
    frame(eye) {
      if (!shadows) return
      const x = Math.round(eye.x / SUN_STEP) * SUN_STEP
      const z = Math.round(eye.z / SUN_STEP) * SUN_STEP
      if (x === snapped.x && z === snapped.z) return
      snapped.set(x, 0, z)
      sun.target.position.set(x, 0, z)
      sun.position.copy(sun.target.position).add(SUN_OFFSET)
      sun.target.updateMatrixWorld()
      renderer.shadowMap.needsUpdate = true
    },
    useLightmap() {
      hemi.intensity = 0.15
      if (shadows) renderer.shadowMap.needsUpdate = true
    },
    bakeEnvironment() {
      if (quality === 'low') return
      // Chụp cảnh từ giữa phòng, ngang tầm mắt: phản chiếu trên inox, kính, mặt bàn là chính căn lab (đèn trần, cửa sổ, tủ).
      const pmrem = new THREE.PMREMGenerator(renderer)
      const rt = pmrem.fromScene(scene, 0.02, 0.5, 300, { size: quality === 'high' ? 256 : 128, position: new THREE.Vector3(0, 15, 0) })
      pmrem.dispose()
      ctx.track(rt)
      scene.environment = rt.texture
      // Môi trường thật đã gồm đèn trần sáng → cường độ thấp hơn RoomEnvironment chung.
      scene.environmentIntensity = 0.55
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

/** Lọc bất đẳng hướng tối đa (cao: theo GPU, ≤ 16; vừa: 8) cho mọi texture: nhãn chai, biển, poster nhìn xiên vẫn rõ. */
export function maxAnisotropy(root: THREE.Object3D, renderer: THREE.WebGLRenderer, quality: string): void {
  const a = quality === 'high' ? Math.min(16, renderer.capabilities.getMaxAnisotropy()) : quality === 'medium' ? 8 : 1
  const seen = new Set<THREE.Texture>()
  root.traverse((o) => {
    const mats = (o as THREE.Mesh).material
    if (!mats) return
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      for (const v of Object.values(m)) {
        const t = v as THREE.Texture
        if (!t?.isTexture || seen.has(t) || (t as THREE.Texture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture) continue
        seen.add(t)
        if (t.anisotropy !== a) {
          t.anisotropy = a
          t.needsUpdate = true
        }
      }
    }
  })
}
