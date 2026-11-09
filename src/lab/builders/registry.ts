import type * as THREE from 'three'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import type { Builder, Category } from './types'

interface Entry { kind: string; category: Category; build: Builder; showroom?: Record<string, unknown>[] }
const entries = new Map<string, Entry>()

/** `showroom`: các bộ tham số hiện trong phòng trưng bày (mặc định một bản không tham số). */
export function register(kind: string, category: Category, build: Builder, showroom?: Record<string, unknown>[]): void {
  entries.set(kind, { kind, category, build, showroom })
}

export function build(ctx: Tracker, kind: string, params?: Record<string, unknown>): THREE.Group {
  const e = entries.get(kind)
  if (!e) throw new Error(`Unknown kind ${kind}`)
  const g = e.build(ctx, params)
  g.userData.kind = kind
  return g
}

export function listKinds(category?: Category): Entry[] {
  return [...entries.values()].filter((e) => !category || e.category === category)
}
