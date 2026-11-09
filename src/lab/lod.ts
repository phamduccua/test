import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Tracker } from '../vendor/lab3d/lab/types'
import { mergeVertexColored } from './optimize'

/**
 * Mức chi tiết theo khoảng cách cho đồ trong phòng.
 * Thủy tinh của kit (LatheGeometry 64 lát, đường viền rất mịn) đẹp khi cận cảnh nhưng 20–65 nghìn tam giác mỗi vật; phòng có ~150 vật.
 * - < 9 dm: nguyên bản kit (mọi tham chiếu của kit vẫn đúng).
 * - 9–25 dm: hình học rút gọn (≤ 28 điểm × 16 lát); kính + dung dịch gộp một mesh trong suốt tô màu đỉnh (RGBA); phần đục gộp một mesh; nhãn giữ.
 * - > 25 dm: như trên nhưng nhãn thành mảng giấy trơn (gộp vào phần đục).
 * `refreshLod(obj)` dựng lại hai bản xa (chặng 7 gọi khi dung dịch đổi màu/mực).
 */
const NEAR = 9
const FAR = 25

const geoCache = new WeakMap<Tracker, Map<string, THREE.BufferGeometry>>()
const shared = new WeakMap<Tracker, { glass: THREE.Material; paper: THREE.Material }>()

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

function sharedMaterials(ctx: Tracker) {
  let s = shared.get(ctx)
  if (!s) {
    s = {
      glass: ctx.track(new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.15, side: THREE.DoubleSide })),
      paper: ctx.track(new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.9 })),
    }
    shared.set(ctx, s)
  }
  return s
}

const isClear = (m: THREE.Material) => m.transparent || ((m as THREE.MeshPhysicalMaterial).transmission ?? 0) > 0

/** Gộp kính + dung dịch thành một mesh RGBA trong suốt (kính α 0,22; dung dịch α theo độ đậm của nó). */
function mergeClear(ctx: Tracker, root: THREE.Object3D, meshes: THREE.Mesh[]) {
  if (!meshes.length) return
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const geos: THREE.BufferGeometry[] = []
  for (const m of meshes) {
    const mat = m.material as THREE.MeshPhysicalMaterial
    const src = m.geometry
    if (!src.attributes.position || src.attributes.position.count === 0) continue
    const g = src.index ? src.toNonIndexed() : src.clone()
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name)
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
    const liquid = m.name === 'liquid'
    // Màu kính hổ phách / dung dịch của kit nằm ở attenuationColor (transmission); kính thường để trắng ở đó.
    const att = mat.attenuationColor
    const tinted = att && att.r + att.g + att.b < 2.9
    const c = (tinted ? att : mat.color) ?? new THREE.Color(0xffffff)
    const a = liquid ? Math.min(0.85, 0.35 + (mat.opacity ?? 0.5) * 0.5) : tinted ? 0.55 : 0.22
    const n = g.attributes.position!.count
    const arr = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b, a], i * 4)
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 4))
    g.groups = []
    geos.push(g)
  }
  const merged = geos.length ? mergeGeometries(geos, false) : null
  geos.forEach((g) => g.dispose())
  meshes.forEach((m) => m.removeFromParent())
  if (!merged) return
  const mesh = new THREE.Mesh(ctx.track(merged), sharedMaterials(ctx).glass)
  mesh.name = 'merged:clear'
  mesh.renderOrder = 1
  root.add(mesh)
}

function buildLow(ctx: Tracker, content: THREE.Object3D, keepLabels: boolean): THREE.Object3D {
  const low = content.clone(true)
  const clear: THREE.Mesh[] = []
  const opaque: THREE.Mesh[] = []
  low.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.visible) return
    mesh.geometry = lowGeometry(ctx, mesh.geometry)
    mesh.castShadow = false
    const mat = mesh.material as THREE.MeshStandardMaterial
    if (Array.isArray(mesh.material)) return
    if (isClear(mat)) clear.push(mesh)
    else {
      if (mat.map && !keepLabels) mesh.material = sharedMaterials(ctx).paper
      opaque.push(mesh)
    }
  })
  low.updateMatrixWorld(true)
  mergeClear(ctx, low, clear)
  mergeVertexColored(ctx, low, opaque)
  return low
}

/** Bọc `content` (nhóm do kit dựng) trong THREE.LOD 3 mức. Vật nhẹ (< 4000 tam giác) không bọc. */
export function withLod(ctx: Tracker, content: THREE.Object3D): THREE.LOD | null {
  let heavy = 0
  content.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) heavy += triCount((o as THREE.Mesh).geometry)
  })
  if (heavy < 4000) return null
  const lod = new THREE.LOD()
  lod.name = 'lod'
  lod.addLevel(content, 0)
  lod.addLevel(buildLow(ctx, content, true), NEAR)
  lod.addLevel(buildLow(ctx, content, false), FAR)
  lod.userData.rebuild = () => {
    for (const i of [2, 1]) {
      const old = lod.levels[i]!.object
      lod.remove(old)
      lod.levels.splice(i, 1)
    }
    lod.addLevel(buildLow(ctx, content, true), NEAR)
    lod.addLevel(buildLow(ctx, content, false), FAR)
  }
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

/** Dựng lại bản xa của mọi LOD trong `obj` (sau khi dung dịch/màu đổi). */
export function refreshLod(obj: THREE.Object3D): void {
  obj.traverse((o) => (o as THREE.LOD).isLOD && (o.userData.rebuild as (() => void) | undefined)?.())
}
