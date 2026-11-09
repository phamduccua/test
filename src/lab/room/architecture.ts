import * as THREE from 'three'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import { makeKit } from '../builders/helpers'
import type { LayoutItem } from '../layout'
import { ROOM } from '../layout'

/** Vỏ phòng: sàn, tường, trần ô, gờ chân tường, cửa, cửa sổ có rèm cuốn, đèn tấm, miệng gió. */
export function buildArchitecture(ctx: Tracker, layout: readonly LayoutItem[]): { group: THREE.Group; ceiling: THREE.Group } {
  const k = makeKit(ctx)
  const g = new THREE.Group()
  g.name = 'architecture'
  const ceiling = new THREE.Group()
  ceiling.name = 'ceiling'
  g.add(ceiling)
  const W = ROOM.maxX - ROOM.minX
  const D = ROOM.maxZ - ROOM.minZ
  const floor = k.plane(W, D, 'floor')
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  g.add(floor)
  const ceil = k.plane(W, D, 'ceiling')
  ceil.rotation.x = Math.PI / 2
  ceil.position.y = ROOM.height
  ceiling.add(ceil)
  // Tường (mặt trong) + gờ chân tường.
  const walls: [number, number, number, number, number][] = [
    [0, ROOM.minZ - 1, W + 4, 2, 0], [0, ROOM.maxZ + 1, W + 4, 2, 0], [ROOM.minX - 1, 0, 2, D, 0], [ROOM.maxX + 1, 0, 2, D, 0],
  ]
  for (const [x, z, w, d] of walls) g.add(k.box(w, ROOM.height, d, 'wall', x, 0, z))
  g.add(k.box(W, 0.8, 0.15, 'skirting', 0, 0, ROOM.minZ + 0.07), k.box(W, 0.8, 0.15, 'skirting', 0, 0, ROOM.maxZ - 0.07))
  g.add(k.box(0.15, 0.8, D, 'skirting', ROOM.minX + 0.07, 0, 0), k.box(0.15, 0.8, D, 'skirting', ROOM.maxX - 0.07, 0, 0))
  // Lưới khung trần 6 dm.
  for (let x = ROOM.minX + 6; x < ROOM.maxX; x += 6) ceiling.add(k.box(0.12, 0.08, D, 'vent', x, ROOM.height - 0.08, 0))
  for (let z = ROOM.minZ + 6; z < ROOM.maxZ; z += 6) ceiling.add(k.box(W, 0.08, 0.12, 'vent', 0, ROOM.height - 0.08, z))

  for (const it of layout) {
    const y = it.y ?? 0
    if (it.kind === 'door') {
      const z = ROOM.minZ
      g.add(k.box(it.w + 1, 0.6, 0.3, 'frame', it.x, it.h, z + 0.15))
      for (const s of [-1, 1]) g.add(k.box(0.5, it.h, 0.3, 'frame', it.x + s * (it.w / 2 + 0.25), 0, z + 0.15))
      const door = new THREE.Group()
      door.name = 'door'
      door.position.set(it.x - it.w / 2, 0, z + 0.2)
      door.add(k.box(it.w, it.h - 0.1, 0.4, 'doorWood', it.w / 2, 0, 0, 0.05))
      door.add(k.box(1.6, 4, 0.42, 'glassPane', it.w / 2, it.h - 7, 0))
      door.add(k.box(1.2, 0.2, 0.5, 'handle', it.w - 1.3, 10, 0.2))
      g.add(door)
    } else if (it.kind === 'window') {
      const z = ROOM.maxZ
      // "Trời" phía sau kính: mặt sáng không nhận bóng.
      const sky = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(it.w, it.h)), ctx.track(new THREE.MeshBasicMaterial({ color: 0xcfe3f2, toneMapped: false })))
      sky.rotation.y = Math.PI
      sky.position.set(it.x, y + it.h / 2, z - 0.02)
      g.add(sky)
      const f = 0.4
      g.add(k.box(it.w, f, 0.4, 'frame', it.x, y, z - 0.25), k.box(it.w, f, 0.4, 'frame', it.x, y + it.h - f, z - 0.25))
      for (const dx of [-it.w / 2 + f / 2, 0, it.w / 2 - f / 2]) g.add(k.box(f, it.h, 0.4, 'frame', it.x + dx, y, z - 0.25))
      g.add(k.box(it.w + 0.8, 0.3, 1.2, 'frame', it.x, y - 0.3, z - 0.6))
      // Rèm cuốn: trục + tấm rèm hạ 35 % (node blind_*).
      g.add(k.cyl(0.4, 0.4, it.w + 0.6, 'blind', it.x + it.w / 2 + 0.3, y + it.h + 0.6, z - 0.8).rotateZ(Math.PI / 2))
      const blind = k.box(it.w, it.h * 0.35, 0.05, 'blind', it.x, y + it.h * 0.65 + 0.2, z - 0.9)
      blind.name = `blind_${it.id}`
      g.add(blind)
    } else if (it.kind === 'light') {
      const frame = k.box(it.w, 0.3, it.d, 'frame', it.x, y + 0.2, it.z)
      const panel = k.box(it.w - 0.4, 0.05, it.d - 0.4, 'lightPanel', it.x, y + 0.15, it.z)
      frame.castShadow = panel.castShadow = false
      ceiling.add(frame, panel)
    } else if (it.kind === 'vent') {
      const v = k.box(it.w, 0.15, it.d, 'vent', it.x, y, it.z)
      ceiling.add(v)
      for (let i = 1; i <= 3; i++) ceiling.add(k.box(it.w - i * 1.4, 0.05, it.d - i * 1.4, i % 2 ? 'blackPlastic' : 'vent', it.x, y - 0.05, it.z))
    } else if (it.kind === 'striping') {
      const s = k.plane(it.w, it.d, 'striping')
      s.rotation.x = -Math.PI / 2
      s.position.set(it.x, 0.02, it.z)
      s.receiveShadow = true
      g.add(s)
      g.add(k.cyl(1.2, 1.2, 0.04, 'steel', it.x, 0.02, it.z, 24))
    }
  }
  return { group: g, ceiling }
}
