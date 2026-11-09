import { makeSolid, makeSolution, mix } from '../chem/index'
import type { Host } from '../app/host'
import { labEvents, type LabEvent } from '../lab/events'
import { mountNotebook, mountResultPanel, mountStatus, mountSubstanceCard } from './panels'
import { mountGuide, mountStart } from './start'
import { mountToolbar } from './toolbar'
import { ui } from './store'

const NODE_VI = (node: string) =>
  node.startsWith('drawer') ? 'ngăn kéo' : node === 'sash' ? 'cửa kính tủ hút' : node === 'lever' ? 'vòi gas' : node.startsWith('door') ? 'cánh tủ' : 'bộ phận'

function noteFor(e: LabEvent): string | null {
  switch (e.type) {
    case 'pick': return `Cầm ${e.name}`
    case 'place': return e.socket ? `Cắm ${e.name} vào ${e.onName}` : `Đặt ${e.name} lên ${e.onName}`
    case 'return': return `Trả ${e.name} về chỗ cũ`
    case 'movable': return e.node === 'lever' ? null : `${e.open ? 'Mở' : 'Đóng'} ${NODE_VI(e.node)}`
    case 'gas': return e.on ? 'Mở vòi gas' : 'Khóa vòi gas'
    case 'inspect': return `Xem nhãn: ${e.meta.displayName}`
    case 'cart': return e.pushing ? 'Đẩy xe' : 'Dừng xe'
    case 'measure': return `${e.label}: ${e.value.toFixed(1).replace('.', ',')} ${e.unit}`
    case 'crossHidden': return `Dấu X khuất sau ${e.seconds.toFixed(1).replace('.', ',')} s`
    case 'wear': return e.on ? 'Đeo kính bảo hộ' : 'Tháo kính bảo hộ'
    default: return null
  }
}

/** Giao diện tầng ứng dụng (DOM + Tailwind) đặt trên khung 3D. `mode === 'ui'`: dữ liệu mẫu (kết quả thật từ bộ máy hóa học). */
export function mountUi(root: HTMLElement, host: Host, mode: string | null): void {
  const layer = document.createElement('div')
  layer.className = 'pointer-events-none absolute inset-0 z-10 font-sans'
  root.append(layer)
  const openGuide = mountGuide(layer)
  mountToolbar(layer, host, openGuide)
  mountResultPanel(layer)
  mountNotebook(layer)
  mountSubstanceCard(layer)
  mountStatus(layer)
  labEvents.on((e) => {
    const t = noteFor(e)
    if (t) ui.note('action', t)
    if (e.type === 'pick') ui.set({ held: e.name })
    if (e.type === 'place' || e.type === 'return') ui.set({ held: null })
    if (e.type === 'inspect') ui.set({ inspect: e.meta })
    if (e.type === 'reaction') ui.setResult(e.title, e.result, e.indicatorOnly)
    if (e.type === 'chemNote') ui.note(e.kind, e.text)
  })
  const firstVisit = (() => {
    try {
      return !localStorage.getItem('freelab:guide')
    } catch {
      return true
    }
  })()
  if (mode === 'ui') {
    // Xem thử giao diện: ba kết quả thật của bộ máy hóa học + vài ghi chép.
    ui.note('action', 'Cầm Cốc thủy tinh 250 mL')
    ui.setResult('HCl 1 M đổ vào H₂SO₄ 1 M', mix(makeSolution('H2SO4', 1, 10), makeSolution('HCl', 1, 10)))
    ui.setResult('Cu vào H₂SO₄ đặc', mix(makeSolid('Cu', 1), makeSolution('H2SO4', 18, 10)))
    ui.setResult('HCl 1 M đổ vào Na₂CO₃ 0,5 M', mix(makeSolution('Na2CO3', 0.5, 10), makeSolution('HCl', 1, 20)))
    ui.set({ started: true })
    return
  }
  mountStart(layer, () => {
    if (firstVisit) {
      openGuide()
      try {
        localStorage.setItem('freelab:guide', '1')
      } catch {
        /* chế độ riêng tư: bỏ qua */
      }
    }
  })
}
