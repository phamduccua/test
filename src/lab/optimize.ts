import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Tracker } from '../vendor/lab3d/lab/types'
import type { PlacedObject } from './room/roomBuilder'

/**
 * Giảm draw call (mục tiêu ≤ 600):
 * 1. Mảnh tĩnh của nội thất/kiến trúc gộp theo vật liệu (một mesh mỗi vật liệu mỗi vật).
 * 2. Mỗi phần di chuyển được (cánh tủ, ngăn kéo) gộp thành MỘT mesh tô màu theo đỉnh – vẫn mở/đóng được ở chặng 5.
 * 3. Bản xa (LOD) của dụng cụ: phần đục không có texture gộp thành một mesh màu đỉnh.
 * Bỏ qua vật con có `userData.meta` (đồ bày trên bàn, vòi gas) – chúng tự gộp theo quy tắc riêng.
 */
const KEEP = ['position', 'normal', 'uv']

function prepared(mesh: THREE.Mesh, rel: THREE.Matrix4, color?: THREE.Color): THREE.BufferGeometry | null {
  const src = mesh.geometry
  if (!src.attributes.position || src.attributes.position.count === 0) return null
  let g = (src.index ? src.toNonIndexed() : src.clone()) as THREE.BufferGeometry
  for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name)
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count * 2), 2))
  g.applyMatrix4(rel)
  if (color) {
    const n = g.attributes.position!.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) color.toArray(arr, i * 3)
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3))
  }
  g.groups = []
  return g
}

/** Các mesh thuộc `root` nhưng không nằm trong nhánh bị loại (`skip(o)` = true thì dừng ở nhánh đó). */
function collect(root: THREE.Object3D, skip: (o: THREE.Object3D) => boolean): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  const walk = (o: THREE.Object3D) => {
    if (o !== root && skip(o)) return
    if ((o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh) out.push(o as THREE.Mesh)
    for (const c of o.children) walk(c)
  }
  walk(root)
  return out
}

const relMatrix = (root: THREE.Object3D, o: THREE.Object3D) => new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(o.matrixWorld)

/** Gộp các mesh cùng vật liệu thành một (toạ độ của `root`). */
export function mergeByMaterial(ctx: Tracker, root: THREE.Object3D, meshes: THREE.Mesh[]): number {
  const groups = new Map<string, THREE.Mesh[]>()
  for (const m of meshes) {
    if (Array.isArray(m.material)) continue
    const key = `${m.material.uuid}|${m.renderOrder}|${m.receiveShadow}|${!!m.userData.shadowCaster}`
    let list = groups.get(key)
    if (!list) groups.set(key, (list = []))
    list.push(m)
  }
  let saved = 0
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const geos = list.map((m) => prepared(m, relMatrix(root, m))).filter((g): g is THREE.BufferGeometry => !!g)
    const merged = geos.length ? mergeGeometries(geos, false) : null
    geos.forEach((g) => g.dispose())
    if (!merged) continue
    const first = list[0]!
    const mesh = new THREE.Mesh(ctx.track(merged), first.material)
    mesh.castShadow = list.some((m) => m.castShadow)
    mesh.receiveShadow = first.receiveShadow
    mesh.renderOrder = first.renderOrder
    mesh.name = `merged:${(first.material as THREE.Material).name || first.name}`
    if (first.userData.shadowCaster) mesh.userData.shadowCaster = true
    for (const m of list) m.removeFromParent()
    root.add(mesh)
    saved += list.length - 1
  }
  return saved
}

const colorMats = new WeakMap<Tracker, THREE.Material>()
function vertexColorMaterial(ctx: Tracker) {
  let m = colorMats.get(ctx)
  if (!m) colorMats.set(ctx, (m = ctx.track(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.15 }))))
  return m
}
const plainOpaque = (m: THREE.Material) => {
  const s = m as THREE.MeshStandardMaterial
  return (s.isMeshStandardMaterial || (m as THREE.MeshBasicMaterial).isMeshBasicMaterial) && !s.map && !m.transparent && !((m as THREE.MeshPhysicalMaterial).transmission > 0)
}

/** Gộp mọi mesh đục không texture của `root` thành một mesh tô màu theo đỉnh; mesh khác gộp theo vật liệu. */
export function mergeVertexColored(ctx: Tracker, root: THREE.Object3D, meshes: THREE.Mesh[]): number {
  const opaque = meshes.filter((m) => !Array.isArray(m.material) && plainOpaque(m.material) && m.renderOrder === 0)
  const rest = meshes.filter((m) => !opaque.includes(m))
  let saved = 0
  if (opaque.length >= 2) {
    const geos = opaque
      .map((m) => prepared(m, relMatrix(root, m), (m.material as THREE.MeshStandardMaterial).color))
      .filter((g): g is THREE.BufferGeometry => !!g)
    const merged = geos.length ? mergeGeometries(geos, false) : null
    geos.forEach((g) => g.dispose())
    if (merged) {
      const mesh = new THREE.Mesh(ctx.track(merged), vertexColorMaterial(ctx))
      mesh.castShadow = opaque.some((m) => m.castShadow)
      mesh.receiveShadow = true
      mesh.name = 'merged:vertexColor'
      opaque.forEach((m) => m.removeFromParent())
      root.add(mesh)
      saved += opaque.length - 1
    }
  }
  return saved + mergeByMaterial(ctx, root, rest)
}

/** Vật nhỏ, vật liệu đơn giản: gộp toàn bộ thành một mesh tô màu theo đỉnh. */
const SMALL = new Set(['stool', 'gasTap', 'safetySign', 'steelBin', 'sharpsBin', 'coatHooks', 'pegBoard', 'cart'])

/**
 * Gộp các phần di chuyển được (cánh tủ, ngăn kéo) đang ĐÓNG thành một mesh; nút gốc giữ lại ở dạng ẩn.
 * `releaseMovable` (chặng 5) hiện lại đúng nút cần mở và dựng lại mesh gộp từ các nút còn đóng.
 */
function mergeMovables(ctx: Tracker, root: THREE.Object3D, nodes: THREE.Object3D[], isChildObject: (o: THREE.Object3D) => boolean): number {
  const rebuild = () => {
    for (const old of (root.userData.movablesMeshes as THREE.Mesh[] | undefined) ?? []) {
      old.removeFromParent()
      old.geometry.dispose()
    }
    root.userData.movablesMeshes = []
    const closed = nodes.filter((n) => !n.visible)
    if (!closed.length) return
    root.updateMatrixWorld(true)
    // Bản chép tạm (dùng chung hình học/vật liệu) đặt ở gốc của root, rồi gộp; mesh gốc trong nút giữ nguyên.
    const holder = new THREE.Group()
    root.add(holder)
    holder.updateMatrixWorld(true)
    const copies = closed.flatMap((n) => collect(n, isChildObject)).map((m) => {
      const c = new THREE.Mesh(m.geometry, m.material)
      c.matrixAutoUpdate = false
      c.matrix.copy(relMatrix(root, m))
      c.castShadow = m.castShadow
      c.receiveShadow = m.receiveShadow
      holder.add(c)
      c.updateMatrixWorld(true)
      return c
    })
    mergeVertexColored(ctx, holder, copies)
    const results = [...holder.children] as THREE.Mesh[]
    holder.removeFromParent()
    for (const r of results) {
      // Bản chép chưa gộp (vật liệu dùng một lần) cần giữ ma trận đã nướng.
      if (!r.matrixAutoUpdate) {
        r.matrix.decompose(r.position, r.quaternion, r.scale)
        r.matrixAutoUpdate = true
      }
      root.add(r)
    }
    root.userData.movablesMeshes = results
  }
  nodes.forEach((n) => (n.visible = false))
  rebuild()
  root.userData.releaseMovable = (name: string) => {
    const n = nodes.find((x) => x.name === name)
    if (!n || n.visible) return n ?? null
    n.visible = true
    rebuild()
    return n
  }
  return nodes.length
}

/** Hiện lại phần di chuyển được `name` của vật `root` để mở/đóng (các phần khác vẫn gộp). */
export function releaseMovable(root: THREE.Object3D, name: string): THREE.Object3D | null {
  const fn = root.userData.releaseMovable as ((n: string) => THREE.Object3D | null) | undefined
  return fn ? fn(name) : root.getObjectByName(name) ?? null
}

export function optimizeObject(ctx: Tracker, root: THREE.Object3D): number {
  const meta = root.userData.meta as { kind: string; movables?: { node: string }[] } | undefined
  const isChildObject = (o: THREE.Object3D) => o !== root && !!o.userData.meta
  let saved = 0
  // Vật con không phải đồ bày (vd. vòi gas gắn trong bàn) tối ưu riêng; không đi vào đồ bày (có instanceId).
  const walk = (o: THREE.Object3D) => {
    for (const c of [...o.children]) {
      if (c.userData.instanceId) continue
      if (c.userData.meta) saved += optimizeObject(ctx, c)
      else walk(c)
    }
  }
  walk(root)
  const movable = new Set((meta?.movables ?? []).map((m) => m.node))
  const nodes: THREE.Object3D[] = []
  root.traverse((o) => {
    if (o !== root && movable.has(o.name) && !isChildObject(o)) nodes.push(o)
  })
  const top = nodes.filter((n) => !nodes.some((m) => m !== n && m.getObjectById(n.id)))
  if (top.length) saved += mergeMovables(ctx, root, top, isChildObject)
  const merged = new Set((root.userData.movablesMeshes as THREE.Object3D[] | undefined) ?? [])
  const staticMeshes = collect(root, (o) => isChildObject(o) || top.includes(o) || merged.has(o))
  saved += SMALL.has(meta?.kind ?? '') ? mergeVertexColored(ctx, root, staticMeshes) : mergeByMaterial(ctx, root, staticMeshes)
  return saved
}

/** Áp cho phòng: mỗi vật layout (không cầm được) + kiến trúc. Trả số mesh đã gộp bớt (ước lượng draw call tiết kiệm). */
export function optimizeRoom(ctx: Tracker, room: { group: THREE.Group; ceiling: THREE.Group; placed: Map<string, PlacedObject> }): number {
  room.group.updateMatrixWorld(true)
  let saved = 0
  for (const p of room.placed.values()) if (!p.parentId && !p.meta.grabbable) saved += optimizeObject(ctx, p.group)
  // Kiến trúc: trần riêng (ẩn khi nhìn từ trên), cửa và rèm giữ riêng.
  const arch = room.group.getObjectByName('architecture')
  if (arch) {
    saved += mergeByMaterial(ctx, room.ceiling, collect(room.ceiling, () => false))
    saved += mergeByMaterial(ctx, arch, collect(arch, (o) => o === room.ceiling || o.name === 'door' || o.name.startsWith('blind_')))
  }
  return saved
}
