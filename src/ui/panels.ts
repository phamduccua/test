import { describe as appearance, getSpecies, toDisplay } from '../chem/index'
import { describePhenomenon } from '../chem/explain'
import type { ObjectMeta } from '../lab/builders/types'
import { ghs, type Ghs } from '../lab/textures/draw'
import { makeCanvas } from '../vendor/lab3d/lab/materials/canvas'
import { useHud } from '../vendor/lab3d/sim/hudStore'
import { useSim } from '../vendor/lab3d/sim/simStore'
import { BTN, clock, el, PANEL, ui, type NoteEntry } from './store'


/** Bảng có tiêu đề bấm để thu gọn (trạng thái nhớ trong phiên). */
function panel(root: HTMLElement, title: string, cls: string, open: boolean) {
  const box = el('section', `${PANEL} absolute z-20 flex flex-col overflow-hidden ${cls}`)
  const head = el('button', 'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-900/5')
  const caret = el('span', 'text-slate-500', open ? '▾' : '▸')
  head.append(el('span', '', title), caret)
  const body = el('div', 'min-h-0 flex-1 overflow-y-auto border-t border-slate-200 px-3 py-2 text-sm')
  body.hidden = !open
  head.onclick = () => {
    body.hidden = !body.hidden
    caret.textContent = body.hidden ? '▸' : '▾'
  }
  box.append(head, body)
  root.append(box)
  return { box, body, open: () => ((body.hidden = false), (caret.textContent = '▾')) }
}

// ---------- Kết quả và kết luận ----------
export function mountResultPanel(root: HTMLElement) {
  const narrow = window.innerWidth < 900
  const p = panel(root, 'Kết quả và kết luận', 'right-4 top-16 w-[min(340px,calc(100vw-2rem))] max-h-[60vh]', !narrow)
  const sub = (t: string) => el('h4', 'mt-2 text-xs font-bold uppercase tracking-wide text-slate-500 first:mt-0', t)
  ui.subscribe((s) => {
    p.body.replaceChildren()
    if (!s.result) {
      p.body.append(el('p', 'text-slate-500', 'Chưa có thí nghiệm nào. Đổ một chất vào chất khác để xem hệ thống phán xét.'))
      return
    }
    const { title, r } = s.result
    const head = el('div', 'flex items-center gap-2')
    head.append(
      el('span', `rounded px-1.5 py-0.5 text-xs font-bold text-white ${r.happened ? 'bg-emerald-600' : 'bg-slate-500'}`, r.happened ? 'Có phản ứng' : 'Không phản ứng'),
      el('span', 'font-medium', title),
    )
    p.body.append(head)
    p.body.append(sub('Hiện tượng'))
    const list = el('ul', 'list-disc space-y-0.5 pl-5')
    for (const ph of r.phenomena) {
      const t = describePhenomenon(ph)
      if (t) list.append(el('li', '', t))
    }
    if (!list.children.length) list.append(el('li', 'text-slate-500', 'Không có hiện tượng quan sát rõ'))
    p.body.append(list)
    const a = appearance(r.mixtureAfter)
    p.body.append(sub('Số liệu'))
    const nums = el('div', 'grid grid-cols-2 gap-x-3 text-[13px] tabular-nums')
    const kv = (k: string, v: string) => nums.append(el('span', 'text-slate-500', k), el('span', '', v))
    kv('Thể tích', `${(r.mixtureAfter.volumeL * 1000).toFixed(1).replace('.', ',')} mL`)
    kv('Nhiệt độ', `${r.mixtureAfter.temperatureC.toFixed(1).replace('.', ',')} °C`)
    if (a.pH !== undefined) kv('pH (ước tính)', a.pH.toFixed(1).replace('.', ','))
    const gas = Object.entries(r.mixtureAfter.gases)
    if (gas.length) kv('Khí thoát ra', gas.map(([k, v]) => `${toDisplay(k)} ${(v * 1000).toFixed(2).replace('.', ',')} mmol`).join(', '))
    p.body.append(nums)
    if (r.equations.length) {
      p.body.append(sub('Phương trình'))
      for (const e of r.equations) p.body.append(el('p', 'rounded bg-slate-100 px-2 py-1 font-mono text-[13px]', e.text))
    }
    p.body.append(sub('Kết luận'))
    p.body.append(el('p', '', r.explanationVi))
    if (r.wouldHappenIf) p.body.append(el('p', 'mt-1 rounded bg-sky-50 px-2 py-1 text-sky-900', `💡 ${r.wouldHappenIf.noteVi}`))
    for (const w of r.safety)
      p.body.append(el('p', `mt-1 rounded px-2 py-1 ${w.level === 'danger' ? 'bg-red-50 text-red-800' : w.level === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'}`, w.messageVi))
    p.open()
  })
}

// ---------- Sổ thí nghiệm ----------
export function mountNotebook(root: HTMLElement) {
  const p = panel(root, 'Sổ thí nghiệm', 'left-4 top-[4.75rem] w-[min(310px,calc(100vw-2rem))] max-h-[42vh]', false)
  const tools = el('div', 'mb-1 flex items-center gap-1 text-xs')
  type Filter = 'all' | NoteEntry['kind']
  let filter: Filter = 'all'
  const tabs: [Filter, string][] = [['all', 'Tất cả'], ['reaction', 'Phản ứng'], ['action', 'Thao tác'], ['safety', 'An toàn']]
  const buttons = tabs.map(([k, t]) => {
    const b = el('button', 'rounded-md px-2 py-1 hover:bg-slate-900/10', t)
    b.onclick = () => {
      filter = k
      render()
    }
    return [k, b] as const
  })
  const exp = el('button', 'ml-auto rounded-md px-2 py-1 text-red-700 hover:bg-red-50', 'Xuất JSON')
  exp.onclick = () => {
    const blob = new Blob([JSON.stringify(ui.get().notebook, null, 2)], { type: 'application/json' })
    const a = el('a')
    a.href = URL.createObjectURL(blob)
    a.download = `so-thi-nghiem-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  tools.append(...buttons.map(([, b]) => b), exp)
  const list = el('ol', 'space-y-1')
  p.body.append(tools, list)
  const color: Record<NoteEntry['kind'], string> = { action: 'bg-slate-400', reaction: 'bg-emerald-500', safety: 'bg-red-500' }
  const render = () => {
    for (const [k, b] of buttons) b.classList.toggle('bg-slate-900/10', k === filter)
    list.replaceChildren()
    const items = ui.get().notebook.filter((n) => filter === 'all' || n.kind === filter)
    if (!items.length) list.append(el('li', 'text-slate-500', 'Chưa có ghi chép.'))
    for (const n of [...items].reverse()) {
      const li = el('li', 'flex gap-2')
      li.append(el('span', 'w-11 shrink-0 font-mono text-xs leading-5 text-slate-500', clock(n.t)), el('span', `mt-1.5 h-2 w-2 shrink-0 rounded-full ${color[n.kind]}`))
      const txt = el('div', 'min-w-0')
      txt.append(el('div', '', n.text))
      if (n.detail) txt.append(el('div', 'text-xs text-slate-500', n.detail))
      li.append(txt)
      list.append(li)
    }
  }
  ui.subscribe(render)
}

// ---------- Thẻ chất (soi nhãn) ----------
const GHS_OF: Record<string, Ghs> = { corrosive: 'corrosive', toxic: 'skull', flammable: 'flame', oxidizer: 'oxidizer', irritant: 'exclamation', harmful: 'exclamation', environment: 'environment' }
const HAZARD_VI: Record<string, string> = { corrosive: 'Ăn mòn', toxic: 'Độc', flammable: 'Dễ cháy', oxidizer: 'Chất oxi hóa', irritant: 'Gây kích ứng', harmful: 'Có hại', environment: 'Hại môi trường' }
const CLASS_VI: Record<string, string> = {
  acid: 'Axit', base: 'Bazơ', salt: 'Muối', metal: 'Kim loại', halogen: 'Halogen (phi kim)', nonmetal: 'Phi kim', oxide_basic: 'Oxit bazơ', oxide_acidic: 'Oxit axit',
  oxide_amphoteric: 'Oxit lưỡng tính', peroxide: 'Peoxit', water: 'Nước', gas: 'Khí', other: 'Chất khác', oxide_neutral: 'Oxit trung tính',
}
function ghsIcon(kind: Ghs): HTMLImageElement {
  const { canvas, g } = makeCanvas(96, 96)
  ghs(g, 48, 48, 88, kind)
  const img = el('img', 'h-12 w-12')
  img.src = canvas.toDataURL()
  return img
}

export function mountSubstanceCard(root: HTMLElement) {
  const wrap = el('div', 'pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/30')
  wrap.hidden = true
  const card = el('div', `${PANEL} w-[min(380px,calc(100vw-2rem))] p-4`)
  wrap.append(card)
  root.append(wrap)
  const close = () => ui.set({ inspect: null })
  wrap.onclick = (e) => e.target === wrap && close()
  window.addEventListener('keydown', (e) => e.code === 'Escape' && ui.get().inspect && close())
  ui.subscribe((s) => {
    wrap.hidden = !s.inspect
    if (!s.inspect) return
    card.replaceChildren(...substanceCard(s.inspect, close))
  })
}

function substanceCard(m: ObjectMeta, close: () => void): HTMLElement[] {
  const out: HTMLElement[] = []
  const x = el('button', `${BTN} float-right -mr-1 -mt-1`, '✕')
  x.setAttribute('aria-label', 'Đóng')
  x.onclick = close
  out.push(x)
  if (!m.chem || m.chem.speciesId === 'H2O') {
    out.push(el('h3', 'text-lg font-bold', m.displayName))
    const info = [m.capacityMl ? `Dung tích ${m.capacityMl} mL` : '', m.chem?.speciesId === 'H2O' ? 'Nước cất – dùng tráng rửa, pha loãng' : ''].filter(Boolean)
    if (info.length) out.push(el('p', 'mt-1 text-slate-600', info.join(' · ')))
    return out
  }
  const s = getSpecies(m.chem.speciesId)
  out.push(el('h3', 'text-2xl font-bold', toDisplay(s.formula)))
  out.push(el('p', 'font-medium', s.nameVi))
  out.push(el('p', 'text-sm italic text-slate-500', s.nameEn))
  const facts = el('div', 'mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm')
  const kv = (k: string, v: string) => facts.append(el('span', 'text-slate-500', k), el('span', 'font-medium', v))
  kv('Loại chất', CLASS_VI[s.class] ?? s.class)
  if (m.chem.concM !== undefined) kv('Nồng độ', `${String(m.chem.concM).replace('.', ',')} M${s.concentratedAboveM !== undefined && m.chem.concM >= s.concentratedAboveM ? ' (đặc)' : ''}`)
  if (m.chem.volumeMl !== undefined) kv('Thể tích trong chai', `${m.chem.volumeMl} mL`)
  if (m.chem.grams !== undefined) kv('Khối lượng', `${m.chem.grams} g`)
  kv('Khối lượng mol', `${s.molarMass.toFixed(2).replace('.', ',')} g/mol`)
  out.push(facts)
  if (s.hazards.length) {
    const hz = el('div', 'mt-3 flex flex-wrap items-center gap-3')
    for (const h of s.hazards) {
      const b = el('div', 'flex flex-col items-center text-[11px] text-slate-600')
      if (GHS_OF[h]) b.append(ghsIcon(GHS_OF[h]!))
      b.append(el('span', '', HAZARD_VI[h] ?? h))
      hz.append(b)
    }
    out.push(hz)
  }
  if (m.chem.concM !== undefined) {
    const a = appearance({ volumeL: 0.1, solutes: { [s.id]: m.chem.concM * 0.1 }, solids: {}, gases: {}, temperatureC: 25 })
    const sw = el('div', 'mt-3 flex items-center gap-2 text-sm text-slate-600')
    const dot = el('span', 'h-5 w-5 rounded-full ring-1 ring-black/10')
    dot.style.background = a.colorHex
    dot.style.opacity = String(Math.max(0.35, a.opacity))
    sw.append(dot, el('span', '', a.colorSources.length ? 'Màu dung dịch' : 'Dung dịch không màu'))
    if (a.pH !== undefined) sw.append(el('span', 'ml-auto tabular-nums', `pH ≈ ${a.pH.toFixed(1).replace('.', ',')}`))
    out.push(sw)
  }
  return out
}

// ---------- Ô "đang cầm", HUD số đo, caption, cảnh báo ----------
export function mountStatus(root: HTMLElement) {
  // Ô đang cầm và caption chung một cột dưới đáy: không chồng nhau; đang cầm thì ẩn caption chung.
  const bottom = el('div', 'pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2 px-4')
  const held = el('div', 'max-w-full rounded-full bg-slate-900/80 px-4 py-1.5 text-center text-sm text-white shadow')
  const cap = el('div', 'max-w-[min(80%,40rem)] rounded-lg bg-black/60 px-4 py-2 text-center text-sm text-white')
  bottom.append(held, cap)
  const warn = el('div', 'pointer-events-none absolute left-1/2 top-4 z-30 max-w-[60%] -translate-x-1/2 rounded-lg bg-amber-100 px-4 py-2 text-sm text-amber-950 shadow ring-1 ring-amber-300')
  const hud = el('div', `${PANEL} absolute bottom-4 right-4 z-20 min-w-40 px-3 py-2 text-sm tabular-nums`)
  root.append(bottom, warn, hud)
  const sim = () => {
    const st = useSim.getState()
    cap.textContent = st.caption
    cap.hidden = !st.caption || !!ui.get().held
    warn.hidden = !st.warning
    warn.textContent = st.warning ? `⚠ ${st.warningTitle ?? 'An toàn'}: ${st.warning}` : ''
    warn.className = warn.className.replace(/bg-\w+-100|text-\w+-950|ring-\w+-300/g, '') + (st.warningTone === 'info' ? ' bg-sky-100 text-sky-950 ring-sky-300' : ' bg-amber-100 text-amber-950 ring-amber-300')
  }
  useSim.subscribe(sim)
  ui.subscribe((s) => {
    held.hidden = !s.held
    held.textContent = s.held ? `Đang cầm: ${s.held} · bấm mặt bàn/giá để đặt · Q trả chỗ cũ · E xem nhãn` : ''
    sim()
  })
  const renderHud = () => {
    const items = useHud.getState().items
    hud.hidden = !items.length
    hud.replaceChildren(...items.map((i) => {
      const row = el('div', 'flex justify-between gap-4')
      row.append(el('span', 'text-slate-500', i.label), el('span', 'font-medium', i.value))
      return row
    }))
  }
  renderHud()
  useHud.subscribe(renderHud)
}
