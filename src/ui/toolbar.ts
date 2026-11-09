import { getAudioSettings, onAudioSettings, setAudioSettings } from '../vendor/lab3d/audio/settings'
import { useSim } from '../vendor/lab3d/sim/simStore'
import { readQualityPref, saveQualityPref, type QualityPref } from '../vendor/lab3d/engine/quality'
import type { Host } from '../app/host'
import { labApi } from '../lab/api'
import { BTN, el, PANEL, ui } from './store'

const SPEEDS = [0.5, 1, 2, 4]
const QUALITY: [QualityPref, string][] = [['auto', 'Tự động'], ['low', 'Thấp'], ['medium', 'Vừa'], ['high', 'Cao']]

/** Thanh điều khiển góc trên trái (thay SimToolbar React của kit): tên, chạy/dừng, tốc độ, loa, chất lượng, góc nhìn, làm lại, hướng dẫn. */
export function mountToolbar(root: HTMLElement, host: Host, openGuide: () => void): void {
  const bar = el('div', `${PANEL} absolute left-4 top-4 z-30 flex flex-wrap items-center gap-1 px-2 py-1.5`)
  const title = el('div', 'mr-1 flex items-center gap-2 pl-1')
  title.append(el('span', 'rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white', 'Hóa 10'), el('span', 'text-sm font-semibold', 'Phòng thí nghiệm'))
  const sep = () => el('span', 'mx-0.5 h-5 w-px bg-slate-300')
  const play = el('button', BTN)
  play.title = 'Chạy / tạm dừng phản ứng'
  const speed = el('button', `${BTN} tabular-nums`)
  speed.title = 'Tốc độ mô phỏng'
  const sound = el('button', BTN)
  sound.title = 'Bật/tắt âm thanh'
  const quality = el('select', 'h-9 rounded-lg bg-transparent px-1.5 text-sm text-slate-700 hover:bg-slate-900/10')
  quality.title = 'Chất lượng hình ảnh (tải lại trang)'
  for (const [v, t] of QUALITY) quality.append(Object.assign(el('option', '', `Hình: ${t}`), { value: v }))
  quality.value = readQualityPref()
  const view = el('button', BTN, '⌖')
  view.title = 'Đặt lại góc nhìn (về cửa ra vào)'
  const restart = el('button', BTN, '↺')
  restart.title = 'Làm lại từ đầu: đồ về chỗ cũ, đóng tủ, xóa sổ'
  const help = el('button', `${BTN} font-bold`, '?')
  help.title = 'Hướng dẫn điều khiển'
  bar.append(title, sep(), play, speed, sound, sep(), quality, view, restart, help)
  root.append(bar)

  const render = () => {
    const s = useSim.getState()
    play.textContent = s.playing ? '⏸' : '▶'
    play.setAttribute('aria-label', s.playing ? 'Tạm dừng' : 'Chạy')
    speed.textContent = `${String(s.speed).replace('.', ',')}×`
    const a = getAudioSettings()
    sound.textContent = a.muted ? '🔇' : '🔊'
    sound.setAttribute('aria-label', a.muted ? 'Bật âm' : 'Tắt âm')
  }
  render()
  useSim.subscribe(render)
  onAudioSettings(render)
  play.onclick = () => useSim.getState().setPlaying(!useSim.getState().playing)
  speed.onclick = () => {
    const i = SPEEDS.indexOf(useSim.getState().speed)
    useSim.getState().setSpeed(SPEEDS[(i + 1) % SPEEDS.length]!)
  }
  sound.onclick = () => setAudioSettings({ muted: !getAudioSettings().muted })
  quality.onchange = () => {
    saveQualityPref(quality.value as QualityPref)
    location.reload()
  }
  view.onclick = () => labApi.resetView()
  restart.onclick = () => {
    if (!confirm('Làm lại từ đầu? Mọi đồ vật về chỗ cũ, sổ thí nghiệm bị xóa.')) return
    host.reset()
    ui.clearNotebook()
  }
  help.onclick = openGuide
}
