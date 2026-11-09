import * as THREE from 'three'
import type { SimContext } from '../vendor/lab3d/sim/types'
import { getColliders, type LayoutItem } from './layout'

/** Màu khối xám theo loại (chặng 3 thay bằng vật thể thật). */
const COLOR: Record<string, number> = {
  floor: 0xc9ccd1, ceiling: 0xf4f4f2, wall: 0xecece8, door: 0xb9a888, window: 0x9ec3e6, bench: 0xf2f2ef, benchTop: 0x202124,
  shelf: 0xd9d9d6, fume: 0xe6e6e3, cabinet: 0xf0f0ec, flammables: 0xf2c21b, cart: 0xb8bcc0, stool: 0xd9b98a, board: 0xfafafa,
  poster: 0xffffff, sign: 0x1faa59, safety: 0x1faa59, extinguisher: 0xd62828, bin: 0x9aa0a6, light: 0xffffff, vent: 0xbfc3c7,
  striping: 0xf2c21b, clock: 0x333333, hooks: 0x8a8f96, pegboard: 0xe8e2d4,
}

export interface Blockout {
  group: THREE.Group
  labels: THREE.Object3D[]
  colliders: ReturnType<typeof getColliders>
  /** Trần, đèn trần, miệng gió – ẩn khi nhìn toàn cảnh từ trên. */
  ceiling: THREE.Group
}

export function buildBlockout(ctx: SimContext, layout: readonly LayoutItem[]): Blockout {
  const mats = new Map<string, THREE.Material>()
  const mat = (key: string, o: THREE.MeshStandardMaterialParameters = {}) => {
    let m = mats.get(key)
    if (!m) {
      m = key === 'light'
        ? new THREE.MeshBasicMaterial({ color: COLOR.light, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: COLOR[key] ?? 0xcccccc, roughness: 0.85, ...o })
      mats.set(key, ctx.track(m))
    }
    return m
  }
  const group = new THREE.Group()
  group.name = 'blockout'
  const ceiling = new THREE.Group()
  ceiling.name = 'ceiling'
  group.add(ceiling)
  const labels: THREE.Object3D[] = []
  let target: THREE.Group = group
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(w, h, d)), m)
    mesh.position.set(x, y + h / 2, z)
    mesh.castShadow = mesh.receiveShadow = true
    target.add(mesh)
    return mesh
  }
  for (const it of layout) {
    const y = it.y ?? 0
    target = it.kind === 'ceiling' || it.kind === 'light' || it.kind === 'vent' ? ceiling : group
    switch (it.kind) {
      case 'floor':
      case 'ceiling': {
        const plane = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(it.w, it.d)), mat(it.kind, { side: THREE.DoubleSide }))
        plane.rotation.x = it.kind === 'floor' ? -Math.PI / 2 : Math.PI / 2
        plane.position.set(it.x, y, it.z)
        plane.receiveShadow = true
        target.add(plane)
        break
      }
      case 'window': {
        const m = mat('window', { transparent: true, opacity: 0.45, roughness: 0.1 })
        box(it.w, it.h, it.d, m, it.x, y, it.z)
        break
      }
      case 'bench': {
        box(it.w, it.h - 0.4, it.d, mat('bench'), it.x, y, it.z)
        box(it.w + 0.3, 0.4, it.d + 0.3, mat('benchTop', { roughness: 0.5 }), it.x, y + it.h - 0.4, it.z)
        break
      }
      case 'shelf': {
        const m = mat('shelf')
        box(it.w, 1.5, it.d, m, it.x, y, it.z)
        for (const lvl of [3.5, 6.5]) box(it.w, 0.2, it.d, m, it.x, y + lvl, it.z)
        for (let i = 0; i < 5; i++) box(0.3, it.h, 0.3, m, it.x - it.w / 2 + (i * it.w) / 4, y, it.z)
        break
      }
      case 'cabinet':
        box(it.w, it.h, it.d, mat(it.id === 'cabinet_flammables' ? 'flammables' : 'cabinet'), it.x, y, it.z)
        break
      case 'stool': {
        const seat = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 20)), mat('stool'))
        seat.position.set(it.x, it.h - 0.15, it.z)
        const leg = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.15, 0.25, it.h - 0.3, 8)), mat('hooks'))
        leg.position.set(it.x, (it.h - 0.3) / 2, it.z)
        seat.castShadow = leg.castShadow = true
        group.add(seat, leg)
        break
      }
      case 'bin':
      case 'clock': {
        const r = Math.min(it.w, it.d, it.kind === 'clock' ? it.h : Infinity) / 2
        const cyl = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(it.kind === 'clock' ? it.w / 2 : r, it.kind === 'clock' ? it.w / 2 : r, it.kind === 'clock' ? it.d : it.h, 24)), mat(it.kind))
        if (it.kind === 'clock') {
          cyl.rotation.x = Math.PI / 2
          cyl.position.set(it.x, y + it.h / 2, it.z)
        } else cyl.position.set(it.x, y + it.h / 2, it.z)
        group.add(cyl)
        break
      }
      case 'safety':
        box(it.w, it.h, it.d, mat(it.id === 'extinguisher' ? 'extinguisher' : 'safety'), it.x, y, it.z)
        break
      default:
        box(it.w, Math.max(it.h, 0.02), it.d, mat(it.kind), it.x, y, it.z)
    }
    if (it.label) {
      const anchor = new THREE.Object3D()
      anchor.position.set(it.x, y + it.h + 1, it.z)
      group.add(anchor)
      labels.push(ctx.labels.add(anchor, it.label))
    }
  }
  return { group, labels, colliders: getColliders(layout), ceiling }
}
