import * as THREE from 'three'
import type { Tracker } from '../vendor/lab3d/lab/types'
import type { Room } from './room/roomBuilder'
import { LAYOUT } from './layout'

/**
 * Lightmap nướng sẵn (Blender Cycles) cho phần TĨNH của phòng: tường, sàn, trần, thân tủ, mặt bàn, kệ.
 * Lightmap chỉ chứa ánh sáng GIÁN TIẾP (ánh dội giữa các bề mặt + che khuất mềm ở góc, gầm, khe) – thứ thời gian thực không tính được;
 * ánh sáng trực tiếp và bóng đổ vẫn tính thời gian thực, nên đồ cầm lên/đặt xuống vẫn đổ bóng đúng.
 *
 * Quy trình: `npm run lightmap` = (1) trình duyệt xuất các mesh tĩnh (`exportForBake`) → (2) Blender mở UV chung một atlas, nướng,
 * khử nhiễu → public/lightmap/{manifest.json, uv1.bin, atlas.png} → (3) lúc chạy `loadLightmap` gắn UV thứ hai + atlas vào đúng mesh.
 * Mesh nhận diện theo thứ tự duyệt cố định (khóa `chủ/số thứ tự`) và kiểm tra số đỉnh: phòng đổi mà chưa nướng lại thì mesh lệch bị bỏ qua.
 */

export interface LmTarget { key: string; mesh: THREE.Mesh }

/**
 * Cân giữa lightmap (đơn vị tương đối của Blender) và đèn thời gian thực. Chỉnh bằng mắt theo các góc đối chiếu ảnh mẫu;
 * `?lmgain=` trên URL để thử nhanh.
 */
const LM_GAIN = (() => {
  const q = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('lmgain')) : NaN
  return Number.isFinite(q) && q > 0 ? q : 0.15
})()

const eligible = (m: THREE.Mesh) => {
  if (!m.visible || Array.isArray(m.material)) return false
  const mat = m.material as THREE.MeshPhysicalMaterial
  return !!mat.isMeshStandardMaterial && !mat.transparent && !(mat.transmission > 0) && !!m.geometry.attributes.position?.count
}

/** Mesh tĩnh nhận lightmap, theo thứ tự cố định. Bỏ: đồ bày (có instanceId), vật con có meta (vòi gas…), phần mở được, cửa, rèm. */
export function lightmapTargets(room: Room): LmTarget[] {
  const out: LmTarget[] = []
  const take = (owner: string, root: THREE.Object3D, skip: (o: THREE.Object3D) => boolean) => {
    let i = 0
    const walk = (o: THREE.Object3D) => {
      if (o !== root && skip(o)) return
      const m = o as THREE.Mesh
      if (m.isMesh && eligible(m)) out.push({ key: `${owner}/${i++}`, mesh: m })
      for (const c of o.children) walk(c)
    }
    walk(root)
  }
  for (const p of room.placed.values()) {
    if (p.parentId || p.meta.grabbable) continue
    const movable = new Set(((p.group.userData.movablesMeshes as THREE.Object3D[] | undefined) ?? []))
    const nodes = new Set((p.meta.movables ?? []).map((m) => m.node))
    take(p.id, p.group, (o) => !!o.userData.instanceId || !!o.userData.meta || movable.has(o) || nodes.has(o.name))
  }
  const arch = room.group.getObjectByName('architecture')
  if (arch) take('arch', arch, (o) => o.name === 'door' || o.name.startsWith('blind_'))
  return out
}

/** Hệ số phản xạ trung bình (albedo) của vật liệu – cho Blender tính ánh dội có màu. */
function albedo(mesh: THREE.Mesh): [number, number, number] {
  const mat = mesh.material as THREE.MeshStandardMaterial
  const c = mat.color.clone()
  const col = mesh.geometry.attributes.color
  if (mat.vertexColors && col) {
    const s = new THREE.Color(0, 0, 0)
    const step = Math.max(1, Math.floor(col.count / 500))
    let n = 0
    for (let i = 0; i < col.count; i += step, n++) s.add(new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)))
    c.multiply(s.multiplyScalar(1 / Math.max(1, n)))
  }
  const img = mat.map?.image as HTMLCanvasElement | undefined
  if (img && typeof document !== 'undefined' && 'getContext' in img) {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 1
    const g = cv.getContext('2d')!
    g.drawImage(img, 0, 0, 1, 1)
    const [r, gg, b] = g.getImageData(0, 0, 1, 1).data
    c.multiply(new THREE.Color().setRGB(r! / 255, gg! / 255, b! / 255, THREE.SRGBColorSpace))
  }
  return [c.r, c.g, c.b]
}

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/**
 * Xuất cho Blender: mỗi mesh = tam giác rời (thứ tự đỉnh như `toNonIndexed`), toạ độ thế giới đổi ra mét (÷10).
 * Trả { meshes: [{ key, count, albedo, emissive }], positions (base64 Float32), normals (base64 Float32) }.
 */
export function exportForBake(room: Room) {
  room.group.updateMatrixWorld(true)
  const targets = lightmapTargets(room)
  const metas: { key: string; count: number; albedo: [number, number, number] }[] = []
  const pos: number[] = []
  const nor: number[] = []
  const v = new THREE.Vector3()
  const nm = new THREE.Matrix3()
  for (const { key, mesh } of targets) {
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
    const p = g.attributes.position!
    const n = g.attributes.normal
    nm.getNormalMatrix(mesh.matrixWorld)
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld)
      pos.push(v.x / 10, -v.z / 10, v.y / 10) // three (y lên) → Blender (z lên), mét
      if (n) v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize()
      else v.set(0, 1, 0)
      nor.push(v.x, -v.z, v.y)
    }
    if (g !== mesh.geometry) g.dispose()
    metas.push({ key, count: p.count, albedo: albedo(mesh) })
  }
  // Nguồn sáng (thế giới, mét, trục Blender). Đèn trần lấy từ bố cục (các tấm đã bị gộp chung một mesh);
  // mặt phát sáng khác (đèn trong tủ hút) lấy theo hộp bao mesh MeshBasic không tone map.
  const panels: { center: [number, number, number]; size: [number, number] }[] = []
  for (const it of LAYOUT) {
    if (it.kind !== 'light') continue
    const y = (it.y ?? 0) + 0.15 // mặt dưới tấm đèn (architecture.ts)
    panels.push({ center: [it.x / 10, -it.z / 10, y / 10 - 0.002], size: [(it.w - 0.4) / 10, (it.d - 0.4) / 10] })
  }
  room.group.traverse((o) => {
    const m = o as THREE.Mesh
    if (o.parent === room.ceiling || room.ceiling.getObjectById(o.id)) return
    if (!m.isMesh || !(m.material as THREE.MeshBasicMaterial).isMeshBasicMaterial || (m.material as THREE.Material).toneMapped !== false) return
    m.geometry.computeBoundingBox()
    const b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld)
    const c = b.getCenter(new THREE.Vector3())
    const s = b.getSize(new THREE.Vector3())
    // Chỉ mặt phát sáng NẰM NGANG chiếu xuống (đèn tủ hút); bỏ tấm "trời" đứng sau cửa sổ, biển thoát hiểm.
    if (s.y > 0.3 || s.x * s.z < 0.5) return
    panels.push({ center: [c.x / 10, -c.z / 10, b.min.y / 10 - 0.002], size: [s.x / 10, s.z / 10] })
  })
  // Vật che (chặn sáng khi nướng nhưng không nhận lightmap): cánh tủ, ngăn kéo đang đóng (mesh gộp `movablesMeshes`).
  // Thiếu chúng thì thân tủ phía sau bị nướng như đang lộ ra – khe giữa các cánh sáng trắng.
  let occluders = 0
  for (const p of room.placed.values()) {
    for (const mesh of (p.group.userData.movablesMeshes as THREE.Mesh[] | undefined) ?? []) {
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
      const pp = g.attributes.position!
      for (let i = 0; i < pp.count; i++) {
        v.fromBufferAttribute(pp, i).applyMatrix4(mesh.matrixWorld)
        pos.push(v.x / 10, -v.z / 10, v.y / 10)
        nor.push(0, 0, 1)
      }
      if (g !== mesh.geometry) g.dispose()
      metas.push({ key: `occluder:${p.id}/${occluders++}`, count: pp.count, albedo: albedo(mesh) })
    }
  }
  return { meshes: metas, panels, positions: toBase64(new Float32Array(pos).buffer), normals: toBase64(new Float32Array(nor).buffer) }
}

export interface LightmapManifest {
  version: number
  /** Cường độ nhân khi gắn (ảnh lưu sRGB 8 bit, đã chia cho hệ số này lúc nướng). */
  intensity: number
  atlas: string
  uv: string
  meshes: { key: string; count: number; offset: number }[]
}

/**
 * Tải và gắn lightmap (nếu đã nướng). Mỗi mesh khớp khóa + số đỉnh nhận `uv1` và bản sao vật liệu có `lightMap`.
 * Trả số mesh đã gắn (0 = chưa có lightmap hoặc phòng đã đổi).
 */
export async function loadLightmap(ctx: Tracker, room: Room, base = '/lightmap/'): Promise<number> {
  let manifest: LightmapManifest
  try {
    const r = await fetch(`${base}manifest.json`, { cache: 'no-cache' })
    if (!r.ok) return 0
    manifest = await r.json()
  } catch {
    return 0
  }
  const [uvBuf, tex] = await Promise.all([
    fetch(base + manifest.uv).then((r) => r.arrayBuffer()),
    new THREE.TextureLoader().loadAsync(base + manifest.atlas),
  ])
  tex.colorSpace = THREE.SRGBColorSpace
  // Không mipmap: mức thu nhỏ trộn các mảnh UV kề nhau trong atlas (lem màu ở xa).
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.channel = 1
  // UV của Blender: (0,0) ở góc DƯỚI trái ảnh → giữ flipY mặc định của three.
  ctx.track(tex)
  const uv = new Uint16Array(uvBuf)
  const byKey = new Map(manifest.meshes.map((m) => [m.key, m]))
  const mats = new Map<THREE.Material, THREE.Material>()
  let applied = 0
  let skipped = 0
  for (const { key, mesh } of lightmapTargets(room)) {
    const m = byKey.get(key)
    const count = mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position!.count
    if (!m || m.count !== count) {
      skipped++
      continue
    }
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    const arr = new Float32Array(count * 2)
    for (let i = 0; i < count * 2; i++) arr[i] = uv[m.offset * 2 + i]! / 65535
    g.setAttribute('uv1', new THREE.BufferAttribute(arr, 2))
    mesh.geometry = ctx.track(g)
    const src = mesh.material as THREE.MeshStandardMaterial
    let lm = mats.get(src)
    if (!lm) {
      const c = src.clone() as THREE.MeshStandardMaterial
      c.lightMap = tex
      c.lightMapIntensity = manifest.intensity * LM_GAIN
      // Ánh sáng nền đã có trong lightmap: giảm phần môi trường (vẫn giữ phản chiếu bóng loáng).
      c.envMapIntensity = (src.envMapIntensity ?? 1) * 0.35
      mats.set(src, (lm = ctx.track(c)))
    }
    mesh.material = lm
    applied++
  }
  if (skipped) console.warn(`[lightmap] bỏ qua ${skipped} mesh không khớp (phòng đã đổi – chạy lại npm run lightmap)`)
  return applied
}
