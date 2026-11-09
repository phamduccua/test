import type { ReactionResult } from '../chem/index'
import type { ObjectMeta } from '../lab/builders/types'

/** `t`: giờ thực (ms, Date.now) – sổ được lưu lại giữa các lần mở trang. */
export interface NoteEntry { t: number; kind: 'action' | 'reaction' | 'safety'; text: string; detail?: string }
export interface UiState {
  notebook: NoteEntry[]
  /** Kết quả phản ứng gần nhất (chặng 7 đặt) + mô tả "đổ gì vào gì". */
  result: { title: string; r: ReactionResult; indicatorOnly?: boolean } | null
  inspect: ObjectMeta | null
  held: string | null
  started: boolean
}

type L = (s: UiState) => void
const listeners = new Set<L>()
const NOTEBOOK_KEY = 'freelab:notebook'
const loadNotebook = (): NoteEntry[] => {
  try {
    const v = JSON.parse(localStorage.getItem(NOTEBOOK_KEY) ?? '[]') as NoteEntry[]
    return Array.isArray(v) ? v.slice(-200) : []
  } catch {
    return []
  }
}
let persist = true
const saveNotebook = (list: NoteEntry[]) => {
  if (!persist) return
  try {
    localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(list))
  } catch {
    /* chế độ riêng tư / đầy bộ nhớ: sổ chỉ còn trong phiên */
  }
}
const state: UiState = { notebook: loadNotebook(), result: null, inspect: null, held: null, started: false }

/** Kho trạng thái giao diện (không React): subscribe/set; mọi bảng vẽ lại theo đây. */
export const ui = {
  get: () => state,
  subscribe(cb: L): () => void {
    listeners.add(cb)
    cb(state)
    return () => listeners.delete(cb)
  },
  set(patch: Partial<UiState>) {
    Object.assign(state, patch)
    for (const cb of listeners) cb(state)
  },
  note(kind: NoteEntry['kind'], text: string, detail?: string) {
    const list = [...state.notebook, { t: Date.now(), kind, text, detail }].slice(-200)
    ui.set({ notebook: list })
    saveNotebook(list)
  },
  setResult(title: string, r: ReactionResult, indicatorOnly = false) {
    ui.set({ result: { title, r, indicatorOnly } })
    const verdict = indicatorOnly ? 'chỉ thị đổi màu' : r.happened ? 'có phản ứng' : 'không phản ứng'
    ui.note('reaction', `${title}: ${verdict}`, r.equations.map((e) => e.text).join('; ') || (indicatorOnly ? undefined : r.explanationVi))
    for (const s of r.safety.filter((x) => x.level === 'danger')) ui.note('safety', s.messageVi)
  },
  /** Chế độ xem thử giao diện: không ghi đè sổ đã lưu của học sinh. */
  noPersist() {
    persist = false
    ui.set({ notebook: [] })
  },
  clearNotebook() {
    ui.set({ notebook: [], result: null })
    saveNotebook([])
  },
}

/** Giờ:phút của một mục sổ (Date.now). */
export const clock = (t: number) => {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Tạo phần tử với lớp Tailwind. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export const PANEL = 'pointer-events-auto rounded-xl bg-white/90 text-slate-800 shadow-lg ring-1 ring-black/5 backdrop-blur'
export const BTN = 'inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-900/10 active:bg-slate-900/15 focus-visible:outline-2 focus-visible:outline-red-600'
