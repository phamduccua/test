import * as THREE from 'three'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import '../builders/furniture'
import '../builders/fixtures'
import '../builders/safety'
import '../builders/kitItems'
import '../builders/glasswareExtra'
import '../builders/composites'
import { attachToSocket } from '../builders/helpers'
import { build } from '../builders/registry'
import { metaOf, type ObjectMeta } from '../builders/types'
import { getColliders, type Facing, type LayoutItem } from '../layout'
import { applyLod } from '../lod'
import { buildArchitecture } from './architecture'
import { POPULATION, type Placement } from './population'

const ROT: Record<Facing, number> = { '+z': 0, '-z': Math.PI, '-x': -Math.PI / 2, '+x': Math.PI / 2 }

/** Builder + tham số cho một mục layout (null = do kiến trúc dựng hoặc bỏ qua). */
function builderFor(it: LayoutItem): { kind: string; params?: Record<string, unknown> } | null {
  const along = it.facing === '-x' || it.facing === '+x'
  const length = along ? it.d : it.w
  const depth = along ? it.w : it.d
  switch (it.kind) {
    case 'bench':
      if (it.id.startsWith('bench_island')) return { kind: 'islandBench', params: { length, depth } }
      if (it.id === 'bench_teacher') return { kind: 'wallBench', params: { length, depth, sink: true, gas: true, title: it.label } }
      return { kind: 'wallBench', params: { length, depth, sink: it.id === 'bench_wall_window', title: it.label } }
    case 'fume': return { kind: 'fumeCupboard' }
    case 'cabinet': return { kind: it.id === 'cabinet_flammables' ? 'flammablesCabinet' : 'glazedCupboard' }
    case 'cart': return { kind: 'cart' }
    case 'stool': return { kind: 'stool' }
    case 'board': return { kind: it.id === 'pinboard' ? 'pinBoard' : 'whiteboard', params: { width: it.w, height: it.h } }
    case 'clock': return { kind: 'wallClock' }
    case 'poster': return { kind: 'posterFrame', params: { width: along ? it.d : it.w, height: it.h, title: it.label } }
    case 'sign': return { kind: 'safetySign', params: { type: it.id === 'exit_sign' ? 'exit' : ['firstAid', 'fireBlanket', 'fireExtinguisher', 'eyeWash'][Number(it.id.slice(-1)) - 1], width: along ? it.d : it.w, height: it.h } }
    case 'hooks': return { kind: 'coatHooks' }
    case 'pegboard': return { kind: 'pegBoard' }
    case 'bin': return { kind: it.id === 'bin_sharps' ? 'sharpsBin' : 'steelBin' }
    case 'safety':
      return { kind: { shower_eyewash: 'showerEyewash', first_aid: 'firstAidBox', fire_blanket: 'fireBlanketBox', extinguisher: 'fireExtinguisher' }[it.id] ?? 'firstAidBox' }
    default: return null
  }
}

/** Đặt vật theo layout: vật treo tường có mặt sau áp sát tường; vật trên sàn đặt theo tâm. */
function place(obj: THREE.Object3D, it: LayoutItem) {
  const y = it.y ?? 0
  obj.rotation.y = ROT[it.facing ?? '+z']
  const wall = ['board', 'clock', 'poster', 'sign', 'hooks', 'pegboard'].includes(it.kind) || (it.kind === 'safety' && !!it.facing && y > 0)
  if (!wall) return obj.position.set(it.x, y, it.z)
  const f = it.facing ?? '+z'
  const x = f === '-x' ? it.x + it.w / 2 : f === '+x' ? it.x - it.w / 2 : it.x
  const z = f === '+z' ? it.z - it.d / 2 : f === '-z' ? it.z + it.d / 2 : it.z
  obj.position.set(x, it.kind === 'clock' ? y + it.h / 2 : y, z)
}

export interface PlacedObject { id: string; group: THREE.Group; meta: ObjectMeta; parentId?: string }
export interface Room { group: THREE.Group; ceiling: THREE.Group; colliders: ReturnType<typeof getColliders>; placed: Map<string, PlacedObject> }

export function buildRoom(ctx: Tracker, layout: readonly LayoutItem[], population: readonly Placement[] = POPULATION): Room {
  const arch = buildArchitecture(ctx, layout)
  const group = new THREE.Group()
  group.name = 'room'
  group.add(arch.group)
  const placed = new Map<string, PlacedObject>()
  for (const it of layout) {
    const b = builderFor(it)
    if (!b) continue
    const obj = build(ctx, b.kind, b.params)
    place(obj, it)
    obj.userData.instanceId = it.id
    group.add(obj)
    placed.set(it.id, { id: it.id, group: obj, meta: metaOf(obj)! })
  }
  for (const p of population) {
    const parent = placed.get(p.on)
    if (!parent) throw new Error(`population ${p.id}: unknown parent ${p.on}`)
    const obj = build(ctx, p.kind, p.params)
    obj.userData.instanceId = p.id
    if (p.socket) {
      if (!attachToSocket(obj, parent.group, p.socket)) throw new Error(`population ${p.id}: no socket ${p.socket} on ${p.on}`)
    } else {
      const s = parent.meta.surfaces?.find((x) => x.name === (p.surface ?? 'top'))
      if (!s) throw new Error(`population ${p.id}: no surface ${p.surface} on ${p.on}`)
      obj.position.set(p.at[0], s.y, p.at[1])
      parent.group.add(obj)
    }
    obj.rotation.y = p.rot ?? 0
    applyLod(ctx, obj)
    placed.set(p.id, { id: p.id, group: obj, meta: metaOf(obj)!, parentId: p.on })
  }
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.castShadow === undefined) o.castShadow = true
  })
  return { group, ceiling: arch.ceiling, colliders: getColliders(layout), placed }
}
