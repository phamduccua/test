import { readQualityPref, saveQualityPref, type QualityPref } from '../vendor/lab3d/engine/quality'
import { el, PANEL, ui } from './store'

export const CONTROLS: [string, string][] = [
  ['W A S D', 'Đi tới, lùi, bước ngang · giữ Shift để chạy'],
  ['Kéo chuột chỗ trống', 'Nhìn quanh · ← → quay người'],
  ['Bấm đồ vật', 'Cầm lên tay, mang đi khắp phòng'],
  ['Giữ chuột trên đồ vật', 'Xem nhãn, tính chất, cảnh báo nguy hiểm'],
  ['Kéo đồ vật', 'Trượt trên mặt bàn'],
  ['Đang cầm: bấm mặt bàn, kệ, giá', 'Đặt xuống (tự tìm chỗ trống, cắm vào giá/kiềng/kẹp)'],
  ['Q · E', 'Trả đồ đang cầm về chỗ cũ · xem nhãn đồ đang cầm'],
  ['Bấm cánh tủ, ngăn kéo, vòi gas', 'Mở / đóng · bấm xe đẩy để đẩy'],
  ['F5 · F4 · F3', 'Điểm nhìn nhanh · bay tự do · số liệu kỹ thuật'],
]

function controlsTable(): HTMLElement {
  const t = el('dl', 'grid grid-cols-[minmax(0,13rem)_1fr] gap-x-4 gap-y-1.5 text-sm')
  for (const [k, v] of CONTROLS) t.append(el('dt', 'font-semibold text-slate-900', k), el('dd', 'text-slate-600', v))
  return t
}

/** Hộp hướng dẫn điều khiển (nút "?" trên thanh công cụ; tự hiện một lần sau khi vào phòng). */
export function mountGuide(root: HTMLElement): () => void {
  const wrap = el('div', 'pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/30')
  wrap.hidden = true
  const card = el('div', `${PANEL} w-[min(560px,calc(100vw-2rem))] p-5`)
  const close = el('button', 'mt-4 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700', 'Đã hiểu')
  card.append(el('h3', 'mb-3 text-lg font-bold', 'Hướng dẫn điều khiển'), controlsTable(), close)
  wrap.append(card)
  root.append(wrap)
  const hide = () => (wrap.hidden = true)
  close.onclick = hide
  wrap.onclick = (e) => e.target === wrap && hide()
  window.addEventListener('keydown', (e) => e.code === 'Escape' && hide())
  return () => {
    wrap.hidden = false
    close.focus()
  }
}

/** Màn hình bắt đầu: phủ cảnh (cảnh vẫn tải phía sau); bấm "Vào phòng" là cử chỉ mở khóa âm thanh. */
export function mountStart(root: HTMLElement, onEnter: () => void): void {
  const wrap = el('div', 'pointer-events-auto absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm')
  const card = el('div', `${PANEL} w-[min(640px,100%)] p-6`)
  card.append(
    el('div', 'mb-1 text-xs font-bold uppercase tracking-widest text-red-600', 'Hóa học 10 · Phòng thí nghiệm ảo'),
    el('h1', 'text-2xl font-bold text-slate-900', 'Phòng thí nghiệm Hóa học'),
    el('p', 'mt-2 text-slate-600', 'Đi lại trong phòng, tự lấy hóa chất và dụng cụ trên kệ để làm thí nghiệm. Mọi cặp chất đều được phán xét theo quy luật hóa học: có phản ứng thì thấy hiện tượng và phương trình, không phản ứng thì biết vì sao.'),
  )
  const mode = el('div', 'mt-4')
  mode.append(el('div', 'mb-1 text-sm font-semibold', 'Bài học'))
  const lesson = el('select', 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2')
  lesson.append(Object.assign(el('option', '', 'Tự do khám phá'), { value: 'free' }))
  mode.append(lesson, el('p', 'mt-1 text-xs text-slate-500', 'Các bài thực hành có hướng dẫn từng bước sẽ có ở bản sau.'))
  const q = el('div', 'mt-3')
  q.append(el('div', 'mb-1 text-sm font-semibold', 'Chất lượng hình ảnh'))
  const quality = el('select', 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2')
  for (const [v, t] of [['auto', 'Tự động theo máy'], ['low', 'Thấp – máy yếu'], ['medium', 'Vừa – card tích hợp'], ['high', 'Cao – card rời']] as const)
    quality.append(Object.assign(el('option', '', t), { value: v }))
  quality.value = readQualityPref()
  q.append(quality)
  const details = el('details', 'mt-4 rounded-lg bg-slate-50 px-3 py-2')
  details.append(el('summary', 'cursor-pointer text-sm font-semibold', 'Cách điều khiển'), controlsTable())
  const go = el('button', 'mt-5 w-full rounded-xl bg-red-600 px-4 py-3 text-lg font-bold text-white shadow hover:bg-red-700', 'Vào phòng thí nghiệm')
  card.append(mode, q, details, go)
  wrap.append(card)
  root.append(wrap)
  go.onclick = () => {
    if (quality.value !== readQualityPref()) {
      saveQualityPref(quality.value as QualityPref)
      location.reload()
      return
    }
    wrap.remove()
    ui.set({ started: true })
    onEnter()
  }
  go.focus()
}
