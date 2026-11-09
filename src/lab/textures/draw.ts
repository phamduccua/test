import * as THREE from 'three'
import { canvasTexture, makeCanvas } from '../../vendor/lab3d/lab/materials/canvas'

/** Vẽ canvas → texture sRGB. Font hệ thống (không tải font ngoài). */
export const FONT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif'
export function paint(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(w, h)
  g.textBaseline = 'middle'
  g.textAlign = 'center'
  draw(g, w, h)
  const t = canvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, color = '#111', weight = 600, align: CanvasTextAlign = 'center', maxW?: number) {
  g.font = `${weight} ${px}px ${FONT}`
  g.fillStyle = color
  g.textAlign = align
  g.fillText(s, x, y, maxW)
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

// ---------- Biểu tượng GHS (hình thoi viền đỏ, ký hiệu đen) ----------
export type Ghs = 'flame' | 'corrosive' | 'skull' | 'exclamation' | 'oxidizer' | 'environment' | 'health' | 'gas'

export function ghs(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, kind: Ghs) {
  const s = size / 2
  g.save()
  g.translate(cx, cy)
  g.beginPath()
  g.moveTo(0, -s)
  g.lineTo(s, 0)
  g.lineTo(0, s)
  g.lineTo(-s, 0)
  g.closePath()
  g.fillStyle = '#fff'
  g.fill()
  g.lineWidth = size * 0.08
  g.strokeStyle = '#d0021b'
  g.stroke()
  g.fillStyle = '#111'
  g.strokeStyle = '#111'
  const u = size / 10
  const flame = (x: number, y: number, k: number) => {
    g.beginPath()
    g.moveTo(x, y + 2 * u * k)
    g.bezierCurveTo(x - 2.2 * u * k, y + 1.5 * u * k, x - 1.6 * u * k, y - 1 * u * k, x - 0.2 * u * k, y - 2.6 * u * k)
    g.bezierCurveTo(x - 0.1 * u * k, y - 1.2 * u * k, x + 1 * u * k, y - 1.4 * u * k, x + 0.8 * u * k, y - 2.2 * u * k)
    g.bezierCurveTo(x + 2.4 * u * k, y - 0.6 * u * k, x + 2 * u * k, y + 1.6 * u * k, x, y + 2 * u * k)
    g.fill()
  }
  switch (kind) {
    case 'flame':
      flame(0, -0.3 * u, 1.1)
      g.fillRect(-2.5 * u, 2.1 * u, 5 * u, 0.5 * u)
      break
    case 'oxidizer':
      g.lineWidth = 0.6 * u
      g.beginPath()
      g.arc(0, 1 * u, 1.5 * u, 0, Math.PI * 2)
      g.stroke()
      flame(0, -1.2 * u, 0.85)
      g.fillRect(-2.5 * u, 2.9 * u, 5 * u, 0.45 * u)
      break
    case 'corrosive':
      g.fillRect(-2.8 * u, -2 * u, 2.2 * u, 0.6 * u)
      g.fillRect(0.6 * u, -2 * u, 2.2 * u, 0.6 * u)
      for (const [x, y] of [[-1.8, -0.8], [1.8, -0.8], [-1.8, 0.2], [1.8, 0.2]]) g.fillRect((x! - 0.2) * u, y! * u, 0.4 * u, 0.6 * u)
      g.fillRect(-3 * u, 1.4 * u, 2.6 * u, 0.9 * u)
      g.fillRect(0.4 * u, 1.6 * u, 2.6 * u, 0.6 * u)
      break
    case 'skull':
      g.beginPath()
      g.arc(0, -0.8 * u, 1.8 * u, 0, Math.PI * 2)
      g.fill()
      g.fillRect(-1 * u, 0.6 * u, 2 * u, 1 * u)
      g.fillStyle = '#fff'
      g.beginPath()
      g.arc(-0.7 * u, -0.9 * u, 0.5 * u, 0, Math.PI * 2)
      g.arc(0.7 * u, -0.9 * u, 0.5 * u, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#111'
      g.lineWidth = 0.6 * u
      g.beginPath()
      g.moveTo(-2.4 * u, 1.6 * u)
      g.lineTo(2.4 * u, 3 * u)
      g.moveTo(2.4 * u, 1.6 * u)
      g.lineTo(-2.4 * u, 3 * u)
      g.stroke()
      break
    case 'exclamation':
      g.fillRect(-0.45 * u, -2.6 * u, 0.9 * u, 3.6 * u)
      g.beginPath()
      g.arc(0, 2.1 * u, 0.55 * u, 0, Math.PI * 2)
      g.fill()
      break
    case 'health':
      g.beginPath()
      g.arc(0, -2 * u, 0.8 * u, 0, Math.PI * 2)
      g.fill()
      g.fillRect(-1.4 * u, -1.1 * u, 2.8 * u, 3.4 * u)
      g.fillStyle = '#fff'
      g.beginPath()
      g.moveTo(0, -0.6 * u)
      g.lineTo(0.9 * u, 0.6 * u)
      g.lineTo(0, 1.8 * u)
      g.lineTo(-0.9 * u, 0.6 * u)
      g.fill()
      break
    case 'environment':
      g.fillRect(-2.5 * u, 2 * u, 5 * u, 0.4 * u)
      g.beginPath()
      g.ellipse(1 * u, 1.2 * u, 1.3 * u, 0.6 * u, 0, 0, Math.PI * 2)
      g.fill()
      g.fillRect(-1.8 * u, -2 * u, 0.4 * u, 4 * u)
      g.beginPath()
      g.moveTo(-1.6 * u, -2.4 * u)
      g.lineTo(-0.4 * u, -0.6 * u)
      g.lineTo(-2.8 * u, -0.6 * u)
      g.fill()
      break
    case 'gas':
      roundRect(g, -1 * u, -2.5 * u, 2 * u, 5 * u, 0.9 * u)
      g.fill()
      break
  }
  g.restore()
}

// ---------- Biển an toàn (nền xanh/đỏ, hình trắng) ----------
export type SignType = 'firstAid' | 'eyeWash' | 'emergencyShower' | 'fireBlanket' | 'fireExtinguisher' | 'exit'

const SIGN_TEXT: Record<SignType, string> = {
  firstAid: 'SƠ CỨU', eyeWash: 'RỬA MẮT', emergencyShower: 'VÒI SEN KHẨN CẤP', fireBlanket: 'CHĂN CHỮA CHÁY', fireExtinguisher: 'BÌNH CHỮA CHÁY', exit: 'LỐI RA',
}

export function safetySignTexture(type: SignType): THREE.CanvasTexture {
  const red = type === 'fireBlanket' || type === 'fireExtinguisher'
  const W = 256
  const H = type === 'exit' ? 128 : 307
  return paint(W, H, (g) => {
    g.fillStyle = red ? '#c62828' : '#1b8a3e'
    g.fillRect(0, 0, W, H)
    g.strokeStyle = '#fff'
    g.lineWidth = 8
    g.strokeRect(10, 10, W - 20, H - 20)
    g.fillStyle = '#fff'
    g.strokeStyle = '#fff'
    const cx = W / 2
    const cy = type === 'exit' ? H / 2 - 10 : 125
    if (type === 'firstAid') {
      g.fillRect(cx - 22, cy - 70, 44, 140)
      g.fillRect(cx - 70, cy - 22, 140, 44)
    } else if (type === 'eyeWash') {
      g.lineWidth = 9
      g.beginPath()
      g.ellipse(cx, cy - 30, 62, 30, 0, 0, Math.PI * 2)
      g.stroke()
      g.beginPath()
      g.arc(cx, cy - 30, 17, 0, Math.PI * 2)
      g.fill()
      for (const dx of [-30, 0, 30]) {
        g.beginPath()
        g.moveTo(cx + dx, cy + 20)
        g.quadraticCurveTo(cx + dx - 10, cy + 42, cx + dx, cy + 50)
        g.quadraticCurveTo(cx + dx + 10, cy + 42, cx + dx, cy + 20)
        g.fill()
      }
    } else if (type === 'emergencyShower') {
      g.beginPath()
      g.moveTo(cx - 50, cy - 60)
      g.lineTo(cx + 50, cy - 60)
      g.lineTo(cx + 30, cy - 80)
      g.lineTo(cx - 30, cy - 80)
      g.fill()
      for (let i = -3; i <= 3; i++) g.fillRect(cx + i * 13 - 2, cy - 52, 4, 22)
      g.beginPath()
      g.arc(cx, cy - 8, 14, 0, Math.PI * 2)
      g.fill()
      g.fillRect(cx - 14, cy + 8, 28, 50)
      g.fillRect(cx - 14, cy + 58, 10, 30)
      g.fillRect(cx + 4, cy + 58, 10, 30)
    } else if (type === 'fireBlanket') {
      g.fillRect(cx - 55, cy - 70, 110, 22)
      g.beginPath()
      g.moveTo(cx - 45, cy - 48)
      g.lineTo(cx + 45, cy - 48)
      g.lineTo(cx + 60, cy + 60)
      g.lineTo(cx - 60, cy + 60)
      g.fill()
      g.fillStyle = '#c62828'
      g.font = `700 26px ${FONT}`
      g.fillText('↓', cx - 20, cy)
      g.fillText('↓', cx + 20, cy)
    } else if (type === 'fireExtinguisher') {
      roundRect(g, cx - 26, cy - 40, 52, 120, 16)
      g.fill()
      g.fillRect(cx - 10, cy - 62, 20, 24)
      g.fillRect(cx - 4, cy - 70, 50, 10)
      g.lineWidth = 7
      g.beginPath()
      g.moveTo(cx + 20, cy - 52)
      g.quadraticCurveTo(cx + 60, cy - 30, cx + 46, cy + 20)
      g.stroke()
    } else {
      // Lối ra: người chạy + mũi tên + chữ.
      g.beginPath()
      g.arc(55, 30, 10, 0, Math.PI * 2)
      g.fill()
      g.lineWidth = 9
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(52, 44)
      g.lineTo(44, 72)
      g.lineTo(26, 92)
      g.moveTo(44, 72)
      g.lineTo(62, 92)
      g.moveTo(50, 52)
      g.lineTo(28, 58)
      g.moveTo(50, 52)
      g.lineTo(72, 62)
      g.stroke()
      g.fillRect(84, 46, 30, 12)
      g.beginPath()
      g.moveTo(112, 36)
      g.lineTo(132, 52)
      g.lineTo(112, 68)
      g.fill()
    }
    if (type === 'exit') text(g, SIGN_TEXT.exit, 190, H / 2, 34, '#fff', 800)
    else text(g, SIGN_TEXT[type], cx, H - 42, type === 'emergencyShower' ? 22 : 28, '#fff', 800, 'center', W - 30)
  })
}
