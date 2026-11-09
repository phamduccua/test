import type { ReactionResult } from '../chem/index'
import type { ObjectMeta } from '../lab/builders/types'

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
const state: UiState = { notebook: [], result: null, inspect: null, held: null, started: false }
const t0 = performance.now()

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
    const list = [...state.notebook, { t: (performance.now() - t0) / 1000, kind, text, detail }].slice(-200)
    ui.set({ notebook: list })
  },
  setResult(title: string, r: ReactionResult, indicatorOnly = false) {
    ui.set({ result: { title, r, indicatorOnly } })
    const verdict = indicatorOnly ? 'chỉ thị đổi màu' : r.happened ? 'có phản ứng' : 'không phản ứng'
    ui.note('reaction', `${title}: ${verdict}`, r.equations.map((e) => e.text).join('; ') || (indicatorOnly ? undefined : r.explanationVi))
    for (const s of r.safety.filter((x) => x.level === 'danger')) ui.note('safety', s.messageVi)
  },
  clearNotebook() {
    ui.set({ notebook: [], result: null })
  },
}

export const clock = (t: number) => {
  const s = Math.floor(t)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
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
