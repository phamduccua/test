import type { ObjectMeta } from './builders/types'

/** Sự kiện của phòng lab: giao diện (sổ thí nghiệm, thẻ chất) và hóa học (chặng 7) nghe ở đây. */
export type LabEvent =
  | { type: 'pick'; id: string; name: string }
  | { type: 'place'; id: string; name: string; on: string; onName: string; socket?: string }
  | { type: 'return'; id: string; name: string }
  | { type: 'movable'; id: string; owner: string; node: string; open: boolean }
  | { type: 'gas'; id: string; on: boolean }
  | { type: 'inspect'; id: string; meta: ObjectMeta }
  | { type: 'cart'; pushing: boolean }

type Listener = (e: LabEvent) => void
const listeners = new Set<Listener>()

export const labEvents = {
  on(cb: Listener): () => void {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  emit(e: LabEvent): void {
    for (const cb of listeners) cb(e)
  },
}
