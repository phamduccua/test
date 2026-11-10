import type * as THREE from 'three'
import { FONT, ghs, paint, roundRect, text, type Ghs } from './draw'

/** Poster "Ký hiệu cảnh báo nguy hiểm" – 6 biểu tượng GHS hay gặp trong phòng lab trường phổ thông. */
export function hazardPoster(): THREE.CanvasTexture {
  return paint(600, 850, (g, W, H) => {
    g.fillStyle = '#fbfaf6'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#c62828'
    g.fillRect(0, 0, W, 110)
    text(g, 'KÝ HIỆU CẢNH BÁO', W / 2, 40, 40, '#fff', 800)
    text(g, 'NGUY HIỂM (GHS)', W / 2, 82, 34, '#fff', 700)
    const items: [Ghs, string, string][] = [
      ['flame', 'Dễ cháy', 'cồn, H₂'], ['corrosive', 'Ăn mòn', 'HCl, H₂SO₄, NaOH'], ['skull', 'Độc cấp tính', 'Cl₂, Br₂, H₂S'],
      ['exclamation', 'Gây kích ứng', 'NH₃, CH₃COOH'], ['oxidizer', 'Chất oxi hóa', 'KMnO₄, KClO₃'], ['environment', 'Hại môi trường', 'AgNO₃, CuSO₄'],
    ]
    items.forEach(([k, name, ex], i) => {
      const cx = i % 2 ? W * 0.73 : W * 0.27
      const cy = 210 + Math.floor(i / 2) * 215
      ghs(g, cx, cy, 130, k)
      text(g, name, cx, cy + 92, 30, '#111', 800)
      text(g, ex, cx, cy + 124, 22, '#555', 500)
    })
  })
}

/** Poster nội quy an toàn phòng thí nghiệm. */
export function rulesPoster(): THREE.CanvasTexture {
  const rules = [
    'Mặc áo blouse, đeo kính bảo hộ.',
    'Không ăn uống trong phòng thí nghiệm.',
    'Đọc kỹ nhãn trước khi lấy hóa chất.',
    'Không nếm, không ngửi trực tiếp hóa chất.',
    'Thí nghiệm có khí độc: làm trong tủ hút.',
    'Rót từ từ axit vào nước, không làm ngược lại.',
    'Có sự cố: báo ngay cho giáo viên.',
    'Rửa tay sau khi làm thí nghiệm.',
  ]
  return paint(600, 850, (g, W, H) => {
    g.fillStyle = '#fbfaf6'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#1b5e9e'
    g.fillRect(0, 0, W, 110)
    text(g, 'NỘI QUY AN TOÀN', W / 2, 40, 40, '#fff', 800)
    text(g, 'PHÒNG THÍ NGHIỆM HÓA HỌC', W / 2, 82, 28, '#fff', 700)
    rules.forEach((r, i) => {
      const y = 170 + i * 84
      g.fillStyle = i === 5 ? '#c62828' : '#1b5e9e'
      g.beginPath()
      g.arc(54, y, 24, 0, Math.PI * 2)
      g.fill()
      text(g, String(i + 1), 54, y + 1, 28, '#fff', 800)
      text(g, r, 92, y, 27, '#1a1a1a', i === 5 ? 800 : 600, 'left', W - 110)
    })
  })
}

const SYMBOLS =
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ')

/** Vị trí (nhóm 1–18, chu kì 1–7; họ Lantan/Actini ở hàng 9–10) từ số hiệu Z. */
export function periodicCell(z: number): { col: number; row: number } {
  if (z === 1) return { col: 1, row: 1 }
  if (z === 2) return { col: 18, row: 1 }
  const starts = [3, 11, 19, 37, 55, 87]
  let period = 2
  for (let i = 0; i < starts.length; i++) if (z >= starts[i]!) period = i + 2
  const start = starts[period - 2]!
  const k = z - start
  if (period <= 3) return { col: k < 2 ? k + 1 : k + 11, row: period }
  if (period <= 5) return { col: k + 1, row: period }
  // Chu kì 6, 7: La–Lu / Ac–Lr tách xuống hàng riêng.
  if (k < 2) return { col: k + 1, row: period }
  if (k <= 16) return { col: k + 1, row: period + 3 }
  return { col: k - 13, row: period }
}

function category(z: number): string {
  const noble = [2, 10, 18, 36, 54, 86, 118]
  const halogen = [9, 17, 35, 53, 85, 117]
  const alkali = [3, 11, 19, 37, 55, 87]
  const alkEarth = [4, 12, 20, 38, 56, 88]
  const metalloid = [5, 14, 32, 33, 51, 52]
  const nonmetal = [1, 6, 7, 8, 15, 16, 34]
  if (noble.includes(z)) return '#c9b8f0'
  if (halogen.includes(z)) return '#9fe0e8'
  if (alkali.includes(z)) return '#ffb4a8'
  if (alkEarth.includes(z)) return '#ffd9a0'
  if (metalloid.includes(z)) return '#d6e6a8'
  if (nonmetal.includes(z)) return '#b9e7b4'
  if ((z >= 57 && z <= 71) || (z >= 89 && z <= 103)) return z <= 71 ? '#f6c4dc' : '#efb6d0'
  if ((z >= 21 && z <= 30) || (z >= 39 && z <= 48) || (z >= 72 && z <= 80) || (z >= 104 && z <= 112)) return '#fff0a8'
  return '#d4dce4'
}

/** Bảng tuần hoàn treo tường (khổ ngang). */
export function periodicTable(): THREE.CanvasTexture {
  return paint(1600, 1000, (g, W, H) => {
    g.fillStyle = '#fbfaf6'
    g.fillRect(0, 0, W, H)
    text(g, 'BẢNG TUẦN HOÀN CÁC NGUYÊN TỐ HÓA HỌC', W / 2, 48, 46, '#14335c', 800)
    const cw = 84
    const ch = 92
    const x0 = (W - 18 * cw) / 2
    const y0 = 100
    for (let z = 1; z <= 118; z++) {
      const { col, row } = periodicCell(z)
      const x = x0 + (col - 1) * cw
      const y = y0 + (row - 1) * ch + (row >= 9 ? 22 : 0)
      g.fillStyle = category(z)
      g.fillRect(x + 2, y + 2, cw - 4, ch - 4)
      g.strokeStyle = '#7d8790'
      g.lineWidth = 1.5
      g.strokeRect(x + 2, y + 2, cw - 4, ch - 4)
      text(g, String(z), x + 10, y + 18, 17, '#333', 600, 'left')
      text(g, SYMBOLS[z - 1]!, x + cw / 2, y + ch / 2 + 8, 36, '#111', 800)
    }
    const legend: [string, string][] = [
      ['#ffb4a8', 'Kim loại kiềm'], ['#ffd9a0', 'Kim loại kiềm thổ'], ['#fff0a8', 'Kim loại chuyển tiếp'], ['#d4dce4', 'Kim loại khác'],
      ['#d6e6a8', 'Á kim'], ['#b9e7b4', 'Phi kim'], ['#9fe0e8', 'Halogen'], ['#c9b8f0', 'Khí hiếm'],
    ]
    legend.forEach(([c, name], i) => {
      const x = x0 + 3 * cw + 20 + (i % 4) * 270
      const y = y0 + 22 + Math.floor(i / 4) * 40
      g.fillStyle = c
      g.fillRect(x, y - 12, 26, 26)
      text(g, name, x + 36, y + 1, 22, '#222', 600, 'left')
    })
  })
}

/** Nội dung bảng trắng: bài tính chất hóa học của axit. */
export function whiteboardContent(): THREE.CanvasTexture {
  return paint(1600, 800, (g, W) => {
    g.fillStyle = '#fbfbfb'
    g.fillRect(0, 0, W, 800)
    text(g, 'TÍNH CHẤT HÓA HỌC CỦA AXIT', W / 2, 70, 58, '#1f4fa0', 800)
    g.strokeStyle = '#1f4fa0'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(420, 112)
    g.lineTo(W - 420, 112)
    g.stroke()
    const lines: [string, string][] = [
      ['1. Làm quỳ tím hóa đỏ', ''],
      ['2. + kim loại (trước H)', 'Zn + 2HCl → ZnCl₂ + H₂↑'],
      ['3. + bazơ', 'NaOH + HCl → NaCl + H₂O'],
      ['4. + oxit bazơ', 'CuO + 2HCl → CuCl₂ + H₂O'],
      ['5. + muối', 'Na₂CO₃ + 2HCl → 2NaCl + CO₂↑ + H₂O'],
    ]
    lines.forEach(([a, b], i) => {
      const y = 190 + i * 104
      text(g, a, 90, y, 44, '#1a1a1a', 700, 'left')
      if (b) text(g, b, 760, y, 44, '#c62828', 600, 'left')
    })
    g.font = `italic 600 34px ${FONT}`
    g.fillStyle = '#2e7d32'
    g.textAlign = 'left'
    g.fillText('Lưu ý: Cu, Ag đứng sau H → không tác dụng với HCl, H₂SO₄ loãng', 90, 730)
  })
}

/** Dải chữ trên nóc tủ hút. */
export function fumeSign(): THREE.CanvasTexture {
  return paint(1024, 102, (g, W, H) => {
    g.fillStyle = '#fbfaf6'
    g.fillRect(0, 0, W, H)
    text(g, 'GIỮ CỬA KÍNH THẤP NHẤT CÓ THỂ', W / 2, H / 2 + 2, 50, '#c62828', 800)
  })
}

/** Nhãn cánh tủ chất dễ cháy. */
export function flammableLabel(): THREE.CanvasTexture {
  return paint(400, 186, (g, W, H) => {
    g.fillStyle = '#f2c21b'
    g.fillRect(0, 0, W, H)
    g.lineWidth = 8
    g.strokeStyle = '#111'
    roundRect(g, 8, 8, W - 16, H - 16, 10)
    g.stroke()
    g.fillStyle = '#111'
    g.beginPath()
    g.moveTo(80, 40)
    g.lineTo(130, 140)
    g.lineTo(30, 140)
    g.closePath()
    g.lineWidth = 6
    g.stroke()
    // Ngọn lửa trong tam giác cảnh báo.
    g.beginPath()
    g.moveTo(80, 132)
    g.bezierCurveTo(56, 128, 60, 100, 76, 82)
    g.bezierCurveTo(78, 96, 88, 96, 86, 88)
    g.bezierCurveTo(104, 104, 102, 128, 80, 132)
    g.fill()
    text(g, 'CHẤT LỎNG', 265, 70, 40, '#111', 800)
    text(g, 'DỄ CHÁY', 265, 120, 44, '#111', 900)
  })
}

/** Nhãn vàng "AXIT ĂN MÒN" dán trên cánh tủ dưới tủ hút (như ảnh mẫu). */
export function corrosiveLabel(): THREE.CanvasTexture {
  return paint(400, 220, (g, W, H) => {
    g.fillStyle = '#f2c21b'
    g.fillRect(0, 0, W, H)
    g.lineWidth = 8
    g.strokeStyle = '#111'
    roundRect(g, 8, 8, W - 16, H - 16, 10)
    g.stroke()
    g.beginPath()
    g.moveTo(85, 45)
    g.lineTo(140, 165)
    g.lineTo(30, 165)
    g.closePath()
    g.lineWidth = 7
    g.stroke()
    // Giọt axit rơi xuống vật (giản lược).
    g.fillStyle = '#111'
    g.fillRect(62, 140, 46, 10)
    g.beginPath()
    g.arc(85, 112, 9, 0, Math.PI * 2)
    g.fill()
    text(g, 'AXIT', 270, 85, 52, '#111', 900)
    text(g, 'ĂN MÒN', 270, 145, 44, '#111', 800)
  })
}

/** Mặt hộp sơ cứu, chăn chữa cháy, nhãn bình chữa cháy. */
export function boxFace(kind: 'firstAid' | 'fireBlanket' | 'extinguisher'): THREE.CanvasTexture {
  return paint(256, 256, (g, W, H) => {
    g.fillStyle = kind === 'firstAid' ? '#1b8a3e' : kind === 'fireBlanket' ? '#c62828' : '#f4f1e8'
    g.fillRect(0, 0, W, H)
    if (kind === 'firstAid') {
      g.fillStyle = '#fff'
      g.fillRect(W / 2 - 26, 40, 52, 176)
      g.fillRect(40, H / 2 - 26, 176, 52)
    } else if (kind === 'fireBlanket') {
      text(g, 'CHĂN', W / 2, 80, 44, '#fff', 900)
      text(g, 'CHỮA CHÁY', W / 2, 130, 34, '#fff', 800)
      text(g, '↓ KÉO ↓', W / 2, 196, 30, '#fff', 800)
    } else {
      text(g, 'CO₂', W / 2, 90, 64, '#c62828', 900)
      text(g, 'BÌNH', W / 2, 160, 34, '#111', 800)
      text(g, 'CHỮA CHÁY', W / 2, 200, 30, '#111', 800)
    }
  })
}
