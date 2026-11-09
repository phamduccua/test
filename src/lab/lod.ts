import * as THREE from 'three'
import type { Tracker } from '../vendor/lab3d/lab/types'

/**
 * Mức chi tiết theo khoảng cách cho đồ trong phòng.
 * Thủy tinh của kit (LatheGeometry 64 lát, đường viền rất mịn) đẹp khi cận cảnh nhưng 20–65 nghìn tam giác mỗi vật;
 * phòng có ~150 vật. Bản xa: đường viền rút còn ≤ 28 điểm, 16 lát; kính khúc xạ (transmission) thay bằng kính trong suốt thường.
 * Bản gần giữ nguyên đối tượng của kit (mọi tham chiếu của kit vẫn đúng).
 */
const NEAR = 9 // dm – trong tầm tay và hơn một chút

const geoCache = new WeakMap<Tracker, Map<string, THREE.BufferGeometry>>()
const matCache = new WeakMap<Tracker, Map<THREE.Material, THREE.Material>>()

function decimate(points: THREE.Vector2[], max: number): THREE.Vector2[] {
  if (points.length <= max) return points
  const step = (points.length - 1) / (max - 1)
  const out: THREE.Vector2[] = []
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]!)
  return out
}

/** Số tam giác (hình học rỗng – vd. chất lỏng chưa có thể tích – trả 0). */
const triCount = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3

function lowGeometry(ctx: Tracker, g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!(g instanceof THREE.LatheGeometry) || triCount(g) < 1500) return g
  const { points, segments, phiStart, phiLength } = g.parameters
  const pts = decimate(points as THREE.Vector2[], 28)
  const key = `${pts.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(';')}|${phiStart}|${phiLength}|${Math.min(16, segments)}`
  let m = geoCache.get(ctx)
  if (!m) geoCache.set(ctx, (m = new Map()))
  let low = m.get(key)
  if (!low) m.set(key, (low = ctx.track(new THREE.LatheGeometry(pts, Math.min(16, segments), phiStart, phiLength))))
  return low
}

function lowMaterial(ctx: Tracker, mat: THREE.Material): THREE.Material {
  const phys = mat as THREE.MeshPhysicalMaterial
  if (!phys.isMeshPhysicalMaterial || !(phys.transmission > 0)) return mat
  let m = matCache.get(ctx)
  if (!m) matCache.set(ctx, (m = new Map()))
  let low = m.get(mat)
  if (!low) {
    low = ctx.track(new THREE.MeshStandardMaterial({
      color: phys.color, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false, side: phys.side,
    }))
    m.set(mat, low)
  }
  return low
}

/** Bọc `content` (nhóm do kit dựng) trong THREE.LOD: gần = nguyên bản, xa = bản rút gọn dùng chung hình học. */
export function withLod(ctx: Tracker, content: THREE.Object3D): THREE.LOD | null {
  let heavy = 0
  content.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) heavy += triCount((o as THREE.Mesh).geometry)
  })
  if (heavy < 4000) return null
  const low = content.clone(true)
  low.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry = lowGeometry(ctx, mesh.geometry)
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((x) => lowMaterial(ctx, x)) : lowMaterial(ctx, mesh.material)
    mesh.castShadow = false
  })
  const lod = new THREE.LOD()
  lod.name = 'lod'
  lod.addLevel(content, 0)
  lod.addLevel(low, NEAR)
  return lod
}

/** Áp LOD cho các con trực tiếp của nhóm vật (nhóm bọc của builder). */
export function applyLod(ctx: Tracker, wrapper: THREE.Object3D): void {
  for (const child of [...wrapper.children]) {
    if (child instanceof THREE.LOD) continue
    const lod = withLod(ctx, child)
    if (!lod) continue
    wrapper.remove(child)
    wrapper.add(lod)
  }
}
