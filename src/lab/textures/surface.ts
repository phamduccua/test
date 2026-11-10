import * as THREE from 'three'
import { makeCanvas } from '../../vendor/lab3d/lab/materials/canvas'

/**
 * Texture bề mặt tự sinh, LẶP KHÔNG LỘ MỐI (vẽ quấn quanh mép): vân loang, hạt mịn, vệt xước inox, thớ gỗ.
 * Dùng với UV theo dm của makeKit (`metricUV`): đặt `repeat = 1 / cỡ ô (dm)`.
 */

function rng(seed: number) {
  let r = seed
  return () => ((r = (r * 16807) % 2147483647) / 2147483647)
}

/** Vẽ `draw(x, y)` tại (x, y) và các bản sao quấn quanh mép để ô lặp liền. */
function wrapDraw(S: number, x: number, y: number, rad: number, draw: (x: number, y: number) => void) {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) if (x + dx + rad > 0 && x + dx - rad < S && y + dy + rad > 0 && y + dy - rad < S) draw(x + dx, y + dy)
}

function finish(canvas: HTMLCanvasElement, color: boolean, tileDm: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas)
  if (color) t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / tileDm, 1 / tileDm)
  t.anisotropy = 8
  return t
}

/** Vân loang mờ (sơn, laminate, mặt đá) + hạt mịn. `amp` = độ đậm vệt (0…0,1), `grain` = mật độ hạt (0…1). */
export function mottleTexture(base: string, amp: number, grain: number, tileDm: number, seed = 1, S = 512): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(S, S)
  const rnd = rng(seed)
  g.fillStyle = base
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 220; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const rad = S * (0.06 + rnd() * 0.22)
    const light = rnd() > 0.5
    const a = amp * (0.3 + rnd() * 0.7)
    wrapDraw(S, x, y, rad, (cx, cy) => {
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad)
      grd.addColorStop(0, light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`)
      grd.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grd
      g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
    })
  }
  for (let i = 0; i < S * S * 0.06 * grain; i++) {
    g.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${0.07 * grain})` : `rgba(0,0,0,${0.08 * grain})`
    g.fillRect(rnd() * S, rnd() * S, 1, 1)
  }
  return finish(canvas, true, tileDm)
}

/** Bản đồ xám cho bumpMap / roughnessMap: hạt mịn quanh mức `mid` (0…255), biên độ `amp`. */
export function grainMap(mid: number, amp: number, tileDm: number, seed = 2, S = 256): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(S, S)
  const rnd = rng(seed)
  const img = g.createImageData(S, S)
  for (let i = 0; i < S * S; i++) {
    const v = Math.max(0, Math.min(255, mid + (rnd() - 0.5) * 2 * amp))
    img.data.set([v, v, v, 255], i * 4)
  }
  g.putImageData(img, 0, 0)
  // Làm mềm một lần (hạt quá sắc thành nhiễu lấp lánh khi xa) – dịch quấn quanh mép để ô vẫn lặp liền.
  const copy = makeCanvas(S, S)
  copy.g.drawImage(canvas, 0, 0)
  g.globalAlpha = 0.5
  for (const [dx, dy] of [[1, 0], [1 - S, 0], [0, 1], [0, 1 - S]] as const) g.drawImage(copy.canvas, dx, dy)
  g.globalAlpha = 1
  return finish(canvas, false, tileDm)
}

/** Inox chải xước: vệt ngang dài (theo trục U), dùng làm roughnessMap/bumpMap. */
export function brushedMap(tileDm: number, seed = 3, S = 512): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(S, S)
  const rnd = rng(seed)
  g.fillStyle = 'rgb(128,128,128)'
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 1400; i++) {
    const y = rnd() * S
    const v = Math.round(128 + (rnd() - 0.5) * 90)
    g.strokeStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.4})`
    g.lineWidth = 0.5 + rnd()
    const x0 = rnd() * S
    const len = S * (0.2 + rnd() * 0.8)
    g.beginPath()
    g.moveTo(x0, y)
    g.lineTo(x0 + len, y)
    g.stroke()
    if (x0 + len > S) {
      g.beginPath()
      g.moveTo(x0 - S, y)
      g.lineTo(x0 + len - S, y)
      g.stroke()
    }
  }
  return finish(canvas, false, tileDm)
}

/** Thớ gỗ (gỗ dán ghế đẩu, khay): sọc thớ lượn theo U + vân màu. */
export function woodTexture(base: string, tileDm: number, seed = 4, S = 512): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(S, S)
  const rnd = rng(seed)
  g.fillStyle = base
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 90; i++) {
    const y0 = rnd() * S
    const amp = 2 + rnd() * 8
    const f = (Math.PI * 2 * (1 + Math.floor(rnd() * 3))) / S
    const ph = rnd() * Math.PI * 2
    const dark = rnd() > 0.35
    g.strokeStyle = dark ? `rgba(90,55,20,${0.06 + rnd() * 0.12})` : `rgba(255,240,210,${0.05 + rnd() * 0.08})`
    g.lineWidth = 1 + rnd() * 3
    for (const dy of [-S, 0, S]) {
      g.beginPath()
      for (let x = 0; x <= S; x += 8) {
        const y = y0 + dy + Math.sin(x * f + ph) * amp
        if (x === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
    }
  }
  return finish(canvas, true, tileDm)
}
