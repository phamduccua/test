import { useSim } from '../vendor/lab3d/sim/simStore'

/** Dải caption + chip An toàn tạm thời (chặng 6 thay bằng giao diện đầy đủ). */
export function mountCaption(root: HTMLElement): () => void {
  const cap = document.createElement('div')
  cap.className = 'pointer-events-none absolute bottom-4 left-1/2 z-20 max-w-[80%] -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-sm text-white empty:hidden'
  const warn = document.createElement('div')
  warn.className = 'pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-900 shadow empty:hidden'
  root.append(cap, warn)
  const render = () => {
    const s = useSim.getState()
    cap.textContent = s.caption
    warn.textContent = s.warning ?? ''
  }
  render()
  return useSim.subscribe(render)
}
