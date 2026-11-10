import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import { roomMaterial, type RoomMaterialKey } from '../materials'
import type { ObjectMeta } from './types'

type Mat = RoomMaterialKey | THREE.Material
const geoCache = new WeakMap<Tracker, Map<string, THREE.BufferGeometry>>()

/** Hình học dùng chung theo tham số (các vật giống nhau dùng chung một BufferGeometry). */
export function cachedGeometry(ctx: Tracker, key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let m = geoCache.get(ctx)
  if (!m) geoCache.set(ctx, (m = new Map()))
  let g = m.get(key)
  if (!g) m.set(key, (g = ctx.track(make())))
  return g
}

/** Vật liệu có texture lát lặp theo dm (materials.ts). */
const METRIC_UV = new Set<string>(['worktop', 'cabinet', 'cabinetFront', 'steel', 'sinkSteel', 'wood'])

/** Vát tự động: 4 mm cho hộp dày ≥ 0,3 dm và không phải mảng kiến trúc lớn (tường, sàn – cạnh không nhìn thấy). */
export function autoBevel(w: number, h: number, d: number): number {
  return Math.min(w, h, d) >= 0.3 && Math.max(w, h, d) < 40 ? 0.04 : 0
}

/**
 * UV theo mét-hệ của phòng (1 đơn vị UV = 1 dm), chiếu theo trục chính của pháp tuyến từng đỉnh:
 * mặt ±X lấy (z, y), mặt ±Y lấy (x, z), mặt ±Z lấy (x, y). Texture đặt `repeat = 1 / cỡ ô (dm)`.
 */
export function metricUV(geo: THREE.BufferGeometry): void {
  const p = geo.attributes.position!
  const n = geo.attributes.normal!
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i))
    const ay = Math.abs(n.getY(i))
    const az = Math.abs(n.getZ(i))
    const [u, v] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)]
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

export function makeKit(ctx: Tracker) {
  const mat = (k: Mat) => (typeof k === 'string' ? roomMaterial(ctx, k) : k)
  const mesh = (g: THREE.BufferGeometry, m: Mat, shadow = true) => {
    const x = new THREE.Mesh(g, mat(m))
    x.castShadow = shadow
    x.receiveShadow = true
    return x
  }
  return {
    mat,
    mesh,
    /**
     * Hộp, gốc ở tâm đáy. Cạnh vát (`r`, mặc định tự vát 0,04 dm = 4 mm cho hộp không quá mỏng/quá lớn): mép bắt sáng như đồ thật.
     * UV tính theo dm (xem `metricUV`) nên texture có tỉ lệ thật, không kéo giãn theo kích thước hộp.
     */
    box(w: number, h: number, d: number, m: Mat, x = 0, y = 0, z = 0, r = autoBevel(w, h, d)) {
      // Chỉ vật liệu lát lặp mới dùng UV theo dm; biển, nhãn, poster (texture vẽ riêng, gán sau) giữ UV 0..1 mỗi mặt.
      const metric = typeof m === 'string' && METRIC_UV.has(m)
      const key = `box:${w}:${h}:${d}:${r}:${metric ? 'm' : ''}`
      const g = cachedGeometry(ctx, key, () => {
        const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d)
        if (metric) metricUV(geo)
        geo.translate(0, h / 2, 0)
        return geo
      })
      const o = mesh(g, m)
      o.position.set(x, y, z)
      return o
    },
    /** Trụ, gốc ở tâm đáy. */
    cyl(rTop: number, rBot: number, h: number, m: Mat, x = 0, y = 0, z = 0, seg = 20) {
      const g = cachedGeometry(ctx, `cyl:${rTop}:${rBot}:${h}:${seg}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg).translate(0, h / 2, 0))
      const o = mesh(g, m)
      o.position.set(x, y, z)
      return o
    },
    plane(w: number, h: number, m: Mat) {
      return mesh(cachedGeometry(ctx, `plane:${w}:${h}`, () => new THREE.PlaneGeometry(w, h)), m, false)
    },
    tube(points: THREE.Vector3[], r: number, m: Mat, seg = 24) {
      return mesh(ctx.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, r, 8)), m)
    },
    torus(R: number, r: number, m: Mat) {
      return mesh(cachedGeometry(ctx, `torus:${R}:${r}`, () => new THREE.TorusGeometry(R, r, 8, 24)), m)
    },
    sphere(r: number, m: Mat) {
      return mesh(cachedGeometry(ctx, `sphere:${r}`, () => new THREE.SphereGeometry(r, 16, 12)), m)
    },
  }
}

export function group(name: string, meta: ObjectMeta, ...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group()
  g.name = name
  g.userData.meta = meta
  if (children.length) g.add(...children)
  return g
}

/** Gắn `child` vào socket `name` của `parent` (toạ độ cục bộ của parent). */
export function attachToSocket(child: THREE.Object3D, parent: THREE.Object3D, name: string): boolean {
  const meta = parent.userData.meta as ObjectMeta | undefined
  const s = meta?.sockets?.find((x) => x.name === name)
  if (!s) return false
  child.position.set(...s.pos)
  parent.add(child)
  return true
}
