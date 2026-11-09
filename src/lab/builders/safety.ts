import * as THREE from 'three'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import { group, makeKit } from './helpers'
import { register } from './registry'

/** Cột vòi sen khẩn cấp + bồn rửa mắt + tay kéo + bàn đạp. */
function showerEyewash(ctx: Tracker) {
  const k = makeKit(ctx)
  const g = group('showerEyewash', {
    kind: 'showerEyewash', displayName: 'Vòi sen khẩn cấp và bồn rửa mắt', category: 'safety', grabbable: false, footprint: { w: 4, d: 4, h: 23 },
    movables: [{ name: 'pull', node: 'pull', type: 'translate', axis: 'y', min: 0, max: -1, initial: 0 }],
  })
  g.add(k.cyl(0.9, 0.9, 0.15, 'steel', 0, 0, 0, 20), k.cyl(0.22, 0.22, 23, 'steel', 0, 0, 0, 14))
  const arm = k.cyl(0.18, 0.18, 4, 'steel', 0, 22.5, 0, 12)
  arm.rotation.x = Math.PI / 2
  g.add(arm)
  g.add(k.cyl(0.4, 1.6, 0.5, 'yellowPaint', 0, 21.6, 4, 28))
  const pull = new THREE.Group()
  pull.name = 'pull'
  pull.add(k.cyl(0.04, 0.04, 6, 'steel', 0, 15, 2.5, 6))
  const tri = k.torus(0.6, 0.08, 'yellowPaint')
  tri.position.set(0, 14.6, 2.5)
  pull.add(tri)
  g.add(pull)
  // Bồn rửa mắt ở y ≈ 10.
  const bowl = k.cyl(1.6, 0.6, 0.6, 'safetyGreen', 0, 10, 1.6, 28)
  const stem = k.cyl(0.15, 0.15, 1.8, 'steel', 0, 10, 0.2, 10)
  stem.rotation.x = Math.PI / 2
  g.add(bowl, stem)
  for (const x of [-0.5, 0.5]) g.add(k.cyl(0.18, 0.12, 0.35, 'yellowPaint', x, 10.6, 1.6, 10))
  g.add(k.box(1.4, 1, 0.1, 'yellowPaint', 0, 10.1, 3.1))
  g.add(k.box(1.6, 0.2, 1.2, 'yellowPaint', 0, 0.15, 1.2))
  return g
}

function fireExtinguisher(ctx: Tracker) {
  const k = makeKit(ctx)
  const g = group('fireExtinguisher', { kind: 'fireExtinguisher', displayName: 'Bình chữa cháy', category: 'safety', grabbable: false, footprint: { w: 1.6, d: 1.6, h: 5.5 } })
  g.add(k.cyl(0.75, 0.75, 4.6, 'safetyRed', 0, 0, 0, 24), k.sphere(0.75, 'safetyRed').translateY(4.6))
  g.add(k.cyl(0.25, 0.3, 0.6, 'blackPlastic', 0, 5.1, 0, 12), k.box(1.2, 0.15, 0.3, 'blackPlastic', 0.3, 5.6, 0))
  g.add(k.tube([new THREE.Vector3(0.2, 5.3, 0), new THREE.Vector3(0.9, 4.5, 0.2), new THREE.Vector3(0.85, 2, 0.6)], 0.1, 'blackPlastic', 16))
  const label = k.box(1.2, 1.5, 0.15, 'paper', 0, 2, 0.74)
  label.name = 'label'
  g.add(label)
  return g
}

function boxSign(ctx: Tracker, kind: string, name: string, w: number, h: number, d: number, color: 'safetyRed' | 'safetyGreen') {
  const k = makeKit(ctx)
  const g = group(kind, { kind, displayName: name, category: 'safety', grabbable: false, footprint: { w, d, h } })
  g.add(k.box(w, h, d, color, 0, 0, d / 2, 0.08))
  const face = k.box(w * 0.7, h * 0.7, 0.03, 'paper', 0, h * 0.15, d + 0.01)
  face.name = 'signFace'
  g.add(face)
  return g
}

/** Biển an toàn (mặt `signFace`, chặng 4 vẽ hình). */
function safetySign(ctx: Tracker, p: Record<string, unknown> = {}) {
  const k = makeKit(ctx)
  const type = (p.type as string) ?? 'firstAid'
  const red = ['fireBlanket', 'fireExtinguisher', 'corrosive', 'toxic', 'flammable', 'keepSashLow'].includes(type)
  const g = group('safetySign', { kind: 'safetySign', displayName: 'Biển báo an toàn', category: 'safety', grabbable: false, params: { type } })
  const plate = k.box((p.width as number) ?? 2.5, (p.height as number) ?? 3, 0.08, red ? 'safetyRed' : 'safetyGreen', 0, 0, 0.04)
  // Mặt in phủ gần hết tấm, cùng tỉ lệ với texture biển báo (không méo hình).
  const face = k.box(((p.width as number) ?? 2.5) * 0.94, ((p.height as number) ?? 3) * 0.94, 0.02, 'paper', 0, ((p.height as number) ?? 3) * 0.03, 0.09)
  face.name = 'signFace'
  g.add(plate, face)
  return g
}

function steelBin(ctx: Tracker) {
  const k = makeKit(ctx)
  const g = group('steelBin', { kind: 'steelBin', displayName: 'Thùng rác', category: 'safety', grabbable: false, footprint: { w: 4, d: 4, h: 6 } })
  g.add(k.cyl(1.9, 1.7, 5.6, 'steel', 0, 0, 0, 28), k.cyl(1.95, 1.95, 0.4, 'chrome', 0, 5.6, 0, 28))
  return g
}

function sharpsBin(ctx: Tracker) {
  const k = makeKit(ctx)
  const g = group('sharpsBin', { kind: 'sharpsBin', displayName: 'Thùng đựng mảnh thủy tinh vỡ', category: 'safety', grabbable: false, footprint: { w: 2.5, d: 2.5, h: 4 } })
  g.add(k.box(2.5, 3.6, 2.5, 'yellowPaint', 0, 0, 0, 0.1), k.box(2.6, 0.4, 2.6, 'safetyRed', 0, 3.6, 0, 0.08))
  return g
}

register('showerEyewash', 'safety', showerEyewash)
register('fireExtinguisher', 'safety', fireExtinguisher)
register('fireBlanketBox', 'safety', (ctx) => boxSign(ctx, 'fireBlanketBox', 'Chăn chữa cháy', 3, 3, 1, 'safetyRed'))
register('firstAidBox', 'safety', (ctx) => boxSign(ctx, 'firstAidBox', 'Tủ sơ cứu', 3, 3, 1.2, 'safetyGreen'))
register('safetySign', 'safety', safetySign, [{ type: 'firstAid' }, { type: 'fireExtinguisher' }])
register('steelBin', 'safety', steelBin)
register('sharpsBin', 'safety', sharpsBin)
