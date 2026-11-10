import type * as THREE from 'three'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import type { Vessel } from '../../vendor/lab3d/lab/glassware/vessel'

export type Category = 'architecture' | 'furniture' | 'fixture' | 'safety' | 'glassware' | 'apparatus' | 'reagent'
export type V3 = [number, number, number]

/** Bề mặt đặt được đồ (toạ độ cục bộ của vật). */
export interface Surface {
  name: string; y: number; minX: number; maxX: number; minZ: number; maxZ: number; kind: 'bench' | 'shelf' | 'tray' | 'hood' | 'floor'
  /** Vùng không đặt được đồ trên bề mặt (đế kệ, vòi gas, bồn rửa…), cùng toạ độ cục bộ. */
  blocked?: { minX: number; maxX: number; minZ: number; maxZ: number }[]
}
export interface Socket { name: string; pos: V3; accepts: string[]; radius: number }
export interface Movable { name: string; node: string; type: 'rotate' | 'translate'; axis: 'x' | 'y' | 'z'; min: number; max: number; initial: number }

/** Siêu dữ liệu gắn ở `group.userData.meta` (chặng 5–7 dùng). Gốc vật ở tâm đáy, mặt trước hướng +Z. */
export interface ObjectMeta {
  kind: string
  displayName: string
  category: Category
  grabbable: boolean
  /** Kích thước chiếm chỗ (dm) – để đặt đồ. */
  footprint?: { w: number; d: number; h: number }
  surfaces?: Surface[]
  sockets?: Socket[]
  movables?: Movable[]
  vessel?: Vessel
  capacityMl?: number
  /** Bán kính miệng (dm). */
  mouthRadius?: number
  /** Mép rót (cục bộ). */
  spout?: V3
  chem?: { speciesId: string; concM?: number; volumeMl?: number; grams?: number }
  params?: Record<string, unknown>
}

export type Builder = (ctx: Tracker, params?: Record<string, unknown>) => THREE.Group

export function metaOf(o: THREE.Object3D): ObjectMeta | undefined {
  return o.userData.meta as ObjectMeta | undefined
}
