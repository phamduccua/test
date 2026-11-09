import type { ReactionResult } from '../chem/index'
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
  /** Bộ máy hóa học phán xét một thao tác (chặng 7). `indicatorOnly`: chỉ nhỏ chỉ thị. */
  | { type: 'reaction'; vessel: string; title: string; result: ReactionResult; indicatorOnly?: boolean; via: 'mix' | 'heat' | 'gas' }
  /** Thao tác hóa học không cần phán xét (rót vào bình trống, châm đèn, thử que đóm…). */
  | { type: 'chemNote'; vessel?: string; kind: 'action' | 'safety'; text: string }
  /** Số đo: nhiệt độ, thời gian đồng hồ bấm giờ. */
  | { type: 'measure'; key: string; label: string; value: number; unit: string; vessel?: string }
  /** Dấu X dưới cốc bị che khuất sau `seconds` giây kể từ khi trộn. */
  | { type: 'crossHidden'; vessel: string; seconds: number }
  | { type: 'wear'; item: 'goggles'; on: boolean }

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
