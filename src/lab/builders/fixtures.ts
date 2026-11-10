import * as THREE from 'three'
import { createClock } from '../../vendor/lab3d/lab/desk/clock'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import { group, makeKit } from './helpers'
import { register } from './registry'
import type { Movable } from './types'

/** Tủ hút: tủ dưới 2 cánh, buồng có đèn, cửa kính trượt (node `sash`), nóc có dải chữ (`signFace`), ống thoát lên trần. */
function fumeCupboard(ctx: Tracker, p: Record<string, unknown> = {}) {
  const k = makeKit(ctx)
  const L = 15
  const D = 9
  const ceiling = (p.ceilingY as number) ?? 30
  const movables: Movable[] = [{ name: 'sash', node: 'sash', type: 'translate', axis: 'y', min: 0, max: 6, initial: 2.5 }]
  const g = group('fumeCupboard', {
    kind: 'fumeCupboard', displayName: 'Tủ hút khí độc', category: 'fixture', grabbable: false, footprint: { w: L, d: D, h: 24 },
    surfaces: [{ name: 'hood', y: 9, minX: -L / 2 + 1.2, maxX: L / 2 - 1.2, minZ: -D / 2 + 1.2, maxZ: D / 2 - 1.5, kind: 'hood' }],
    params: { hoodVolume: { min: [-L / 2 + 0.6, 9, -D / 2 + 0.6], max: [L / 2 - 0.6, 19.5, D / 2 - 0.3] } },
    movables,
  })
  g.add(k.box(L - 0.4, 0.8, D - 1, 'skirting', 0, 0, -0.2))
  g.add(k.box(L, 7.8, D, 'cabinet', 0, 0.8, 0))
  // Nhãn "axit ăn mòn" trên cánh trái (tủ dưới đựng axit).
  const acid = k.box(2.4, 1.3, 0.03, 'paper', -L / 4 + 1.2, 5.6, D / 2 + 0.21)
  acid.name = 'label_acid'
  g.add(acid)
  for (const x of [-L / 4, L / 4]) {
    g.add(k.box(L / 2 - 0.3, 7.4, 0.2, 'cabinetFront', x, 1, D / 2, 0.05))
    g.add(k.box(0.15, 1.6, 0.25, 'handle', x + (x < 0 ? L / 4 - 1 : -L / 4 + 1), 5, D / 2 + 0.2))
    for (let i = 0; i < 5; i++) g.add(k.box(2.2, 0.12, 0.05, 'blackPlastic', x, 1.6 + i * 0.35, D / 2 + 0.12))
  }
  g.add(k.box(L, 0.4, D, 'worktop', 0, 8.6, 0, 0.05))
  // Buồng: hai vách bên, vách sau (lòng nhạt), trần buồng có đèn.
  g.add(k.box(1, 10.5, D, 'cabinet', -L / 2 + 0.5, 9, 0), k.box(1, 10.5, D, 'cabinet', L / 2 - 0.5, 9, 0))
  g.add(k.box(L - 2, 10.5, 0.3, 'frame', 0, 9, -D / 2 + 0.15))
  // Lòng buồng như ảnh mẫu: vách sau inox (vách hướng dòng) với 3 khe hút gió tối, hai vách bên lót inox.
  g.add(k.box(L - 2.2, 9.8, 0.1, 'sinkSteel', 0, 9.3, -D / 2 + 0.35))
  for (const y of [10.2, 14.2, 18.2]) g.add(k.box(L - 3.4, 0.25, 0.05, 'blackPlastic', 0, y, -D / 2 + 0.42))
  for (const x of [-L / 2 + 1.05, L / 2 - 1.05]) g.add(k.box(0.08, 10, D - 1.2, 'sinkSteel', x + (x < 0 ? 0.05 : -0.05), 9.1, -0.3))
  g.add(k.box(L - 2, 0.3, D, 'cabinet', 0, 19.2, 0))
  const lamp = k.box(L - 4, 0.15, 1, 'lightPanel', 0, 19.05, 0)
  lamp.castShadow = false
  g.add(lamp)
  // Nóc + dải chữ.
  g.add(k.box(L, 4.5, D, 'cabinet', 0, 19.5, 0))
  const sign = k.box(8, 0.8, 0.05, 'paper', 0, 22.4, D / 2 + 0.01)
  sign.name = 'signFace'
  g.add(sign)
  // Cửa kính trượt trong ray.
  const sash = new THREE.Group()
  sash.name = 'sash'
  sash.position.y = 2.5
  sash.add(k.box(L - 2, 0.4, 0.3, 'steel', 0, 9.2, D / 2 - 0.4))
  const glass = k.box(L - 2, 7.5, 0.1, 'hoodGlass', 0, 9.6, D / 2 - 0.4)
  glass.castShadow = false
  // Tay nắm cửa kính: thanh inox nằm ngang nhô ra trước ray dưới.
  sash.add(glass, k.box(L - 2, 0.3, 0.3, 'steel', 0, 17.1, D / 2 - 0.4), k.box(L - 4, 0.22, 0.3, 'chrome', 0, 9.0, D / 2 - 0.05))
  g.add(sash)
  for (const x of [-L / 2 + 1.05, L / 2 - 1.05]) g.add(k.box(0.15, 10.4, 0.5, 'steel', x, 9, D / 2 - 0.4))
  // Bảng điều khiển + 2 nút + ống thoát.
  g.add(k.box(0.8, 2, 0.2, 'blackPlastic', L / 2 - 0.5, 14, D / 2 + 0.05))
  const b1 = k.cyl(0.18, 0.18, 0.15, 'yellowPaint', L / 2 - 0.5, 15.3, D / 2 + 0.2, 12)
  const b2 = k.cyl(0.18, 0.18, 0.15, 'safetyGreen', L / 2 - 0.5, 14.5, D / 2 + 0.2, 12)
  b1.rotation.x = b2.rotation.x = Math.PI / 2
  g.add(b1, b2, k.cyl(1, 1, Math.max(0.5, ceiling - 24), 'steel', 0, 24, -1, 20))
  return g
}

/** Tủ đựng chất dễ cháy (vàng), 2 cánh có bản lề, nhãn hai cánh (`label_L`, `label_R`). */
function flammablesCabinet(ctx: Tracker) {
  const k = makeKit(ctx)
  const L = 9
  const D = 5
  const H = 18
  const movables: Movable[] = []
  const g = group('flammablesCabinet', { kind: 'flammablesCabinet', displayName: 'Tủ chất dễ cháy', category: 'fixture', grabbable: false, footprint: { w: L, d: D, h: H }, movables })
  g.add(k.box(L, H, D - 0.2, 'yellowPaint', 0, 0, -0.1, 0.1))
  for (const half of [-1, 1]) {
    const hinge = new THREE.Group()
    hinge.name = `door_${half < 0 ? 'L' : 'R'}`
    hinge.position.set(half * (L / 2 - 0.05), 0.3, D / 2 - 0.2)
    const dw = L / 2 - 0.15
    hinge.add(k.box(dw, H - 0.6, 0.2, 'yellowPaint', -half * (dw / 2 + 0.05), 0, 0, 0.05))
    const label = k.box(3, 1.4, 0.03, 'paper', -half * (dw / 2 + 0.05), H * 0.62, 0.21)
    label.name = `label_${half < 0 ? 'L' : 'R'}`
    hinge.add(label, k.box(0.15, 1.8, 0.3, 'handle', -half * (dw - 0.4), H / 2 - 1, 0.2))
    g.add(hinge)
    movables.push({ name: hinge.name, node: hinge.name, type: 'rotate', axis: 'y', min: 0, max: half * 1.9, initial: 0 })
  }
  return g
}

/** Tủ kính: nửa dưới cánh đặc, nửa trên cánh kính khung trắng, 2 kệ bên trong. */
function glazedCupboard(ctx: Tracker) {
  const k = makeKit(ctx)
  const L = 10
  const D = 4.5
  const H = 20
  const movables: Movable[] = []
  const g = group('glazedCupboard', {
    kind: 'glazedCupboard', displayName: 'Tủ kính dụng cụ', category: 'fixture', grabbable: false, footprint: { w: L, d: D, h: H }, movables,
    surfaces: [10.3, 13.5, 16.7].map((y, i) => ({ name: `shelf${i}`, y: y + 0.15, minX: -L / 2 + 0.6, maxX: L / 2 - 0.6, minZ: -D / 2 + 0.5, maxZ: D / 2 - 0.6, kind: 'shelf' as const })),
  })
  g.add(k.box(L, 0.6, D - 0.3, 'skirting', 0, 0, -0.1))
  // Thân rỗng: đáy, nóc, hai vách, lưng.
  g.add(k.box(L, 0.3, D, 'cabinet', 0, 0.6, 0), k.box(L, 0.3, D, 'cabinet', 0, H - 0.3, 0), k.box(L, 0.3, D, 'cabinet', 0, 10, 0))
  g.add(k.box(0.3, H - 0.6, D, 'cabinet', -L / 2 + 0.15, 0.6, 0), k.box(0.3, H - 0.6, D, 'cabinet', L / 2 - 0.15, 0.6, 0))
  g.add(k.box(L, H - 0.6, 0.2, 'frame', 0, 0.6, -D / 2 + 0.1))
  for (const y of [13.5, 16.7]) g.add(k.box(L - 0.6, 0.15, D - 0.6, 'glassPane', 0, y, -0.1))
  for (const half of [-1, 1]) {
    const dw = L / 2 - 0.1
    const low = new THREE.Group()
    low.name = `door_low_${half < 0 ? 'L' : 'R'}`
    low.position.set(half * (L / 2 - 0.05), 0.9, D / 2)
    low.add(k.box(dw, 9, 0.2, 'cabinetFront', -half * (dw / 2), 0, 0, 0.05), k.box(0.12, 1.4, 0.25, 'handle', -half * (dw - 0.4), 6.5, 0.2))
    const up = new THREE.Group()
    up.name = `door_up_${half < 0 ? 'L' : 'R'}`
    up.position.set(half * (L / 2 - 0.05), 10.3, D / 2)
    const cx = -half * (dw / 2)
    up.add(k.box(dw, 0.5, 0.2, 'frame', cx, 0, 0), k.box(dw, 0.5, 0.2, 'frame', cx, 8.9, 0))
    up.add(k.box(0.5, 9.4, 0.2, 'frame', cx - dw / 2 + 0.25, 0, 0), k.box(0.5, 9.4, 0.2, 'frame', cx + dw / 2 - 0.25, 0, 0))
    const pane = k.box(dw - 1, 8.4, 0.05, 'glassPane', cx, 0.5, 0)
    pane.castShadow = false
    up.add(pane, k.box(0.12, 1.4, 0.25, 'handle', -half * (dw - 0.4), 1, 0.2))
    g.add(low, up)
    for (const d of [low, up]) movables.push({ name: d.name, node: d.name, type: 'rotate', axis: 'y', min: 0, max: half * 1.9, initial: 0 })
  }
  return g
}

/** Bảng trắng khung nhôm, mặt bảng (`boardFace`), khay bút, 3 bút. */
function whiteboard(ctx: Tracker, p: Record<string, unknown> = {}) {
  const k = makeKit(ctx)
  const W = (p.width as number) ?? 24
  const H = (p.height as number) ?? 12
  const g = group('whiteboard', { kind: 'whiteboard', displayName: 'Bảng trắng', category: 'fixture', grabbable: false, footprint: { w: W, d: 0.6, h: H } })
  g.add(k.box(W, H, 0.25, 'steel', 0, 0, 0.12, 0.08))
  const face = k.box(W - 0.6, H - 0.6, 0.05, 'whiteboard', 0, 0.3, 0.26)
  face.name = 'boardFace'
  g.add(face, k.box(W * 0.7, 0.25, 0.7, 'steel', 0, -0.1, 0.5))
  ;['#1f5fbf', '#c8372d', '#222'].forEach((c, i) => {
    const pen = k.cyl(0.08, 0.08, 1.2, new THREE.MeshStandardMaterial({ color: c }), -3 + i * 1.6, 0.25, 0.55, 8)
    ctx.track(pen.material)
    pen.rotation.z = Math.PI / 2
    g.add(pen)
  })
  return g
}

/** Khung poster/biển: mặt `posterFace` (chặng 4 vẽ nội dung). */
function posterFrame(ctx: Tracker, p: Record<string, unknown> = {}) {
  const k = makeKit(ctx)
  const W = (p.width as number) ?? 6
  const H = (p.height as number) ?? 8.5
  const g = group('posterFrame', { kind: 'posterFrame', displayName: (p.title as string) ?? 'Áp phích', category: 'fixture', grabbable: false, footprint: { w: W, d: 0.2, h: H } })
  g.add(k.box(W, H, 0.12, 'blackPlastic', 0, 0, 0.06))
  const face = k.box(W - 0.25, H - 0.25, 0.03, 'paper', 0, 0.125, 0.13)
  face.name = 'posterFace'
  g.add(face)
  return g
}

function pinBoard(ctx: Tracker) {
  const k = makeKit(ctx)
  const g = group('pinBoard', { kind: 'pinBoard', displayName: 'Bảng ghim', category: 'fixture', grabbable: false, footprint: { w: 12, d: 0.4, h: 9 } })
  g.add(k.box(12, 9, 0.3, 'wood', 0, 0, 0.15), k.box(11.4, 8.4, 0.05, 'cork', 0, 0.3, 0.3))
  const notes: [number, number, number, number, number][] = [[-3.6, 4.6, 2.6, 3.4, 0.06], [-0.6, 5.2, 2.2, 2.9, -0.05], [2.6, 4.8, 2.8, 3.6, 0.03], [-2.4, 1.2, 3, 2.2, -0.08], [2.2, 1.0, 2.4, 2.6, 0.07]]
  for (const [x, y, w, h, r] of notes) {
    const n = k.box(w, h, 0.02, 'paper', x, y, 0.34)
    n.rotation.z = r
    g.add(n, k.sphere(0.15, 'safetyRed').translateX(x).translateY(y + h - 0.3).translateZ(0.4))
  }
  return g
}

/** Móc treo + áo blouse. */
function coatHooks(ctx: Tracker) {
  const k = makeKit(ctx)
  const g = group('coatHooks', { kind: 'coatHooks', displayName: 'Móc áo blouse', category: 'fixture', grabbable: false, footprint: { w: 6, d: 1, h: 1 } })
  g.add(k.box(6, 0.6, 0.3, 'wood', 0, 0, 0.15))
  for (let i = 0; i < 4; i++) g.add(k.cyl(0.08, 0.08, 0.8, 'steel', -2.2 + i * 1.47, 0.3, 0.5, 8).rotateX(Math.PI / 2))
  // Áo blouse: thân hình thang + hai tay áo.
  const coat = new THREE.Group()
  coat.position.set(-0.7, -0.2, 0.7)
  const shape = new THREE.Shape([new THREE.Vector2(-1.4, 0), new THREE.Vector2(1.4, 0), new THREE.Vector2(2.2, -9), new THREE.Vector2(-2.2, -9)])
  const body = k.mesh(ctx.track(new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2 })), 'fabric')
  body.position.z = -0.4
  coat.add(body)
  for (const s of [-1, 1]) {
    const sleeve = k.cyl(0.55, 0.65, 6.5, 'fabric', s * 1.9, -6.8, 0, 10)
    sleeve.rotation.z = s * 0.12
    coat.add(sleeve)
  }
  g.add(coat)
  return g
}

function wallClock(ctx: Tracker) {
  const c = createClock(ctx, { kind: 'wall', size: 300 })
  return group('wallClock', { kind: 'wallClock', displayName: 'Đồng hồ treo tường', category: 'fixture', grabbable: false, params: { clock: c } }, c.group)
}

/** Giá phơi dụng cụ: tấm có chốt nghiêng. */
function pegBoard(ctx: Tracker) {
  const k = makeKit(ctx)
  const g = group('pegBoard', { kind: 'pegBoard', displayName: 'Giá phơi dụng cụ', category: 'fixture', grabbable: false, footprint: { w: 8, d: 1.5, h: 8 } })
  g.add(k.box(8, 8, 0.3, 'frame', 0, 0, 0.15))
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 5; c++) {
      const peg = k.cyl(0.05, 0.05, 1.2, 'steel', -3.2 + c * 1.6, 1 + r * 1.8, 0.3, 6)
      peg.rotation.x = Math.PI / 2 - 0.35
      g.add(peg)
    }
  return g
}

register('fumeCupboard', 'fixture', fumeCupboard)
register('flammablesCabinet', 'fixture', flammablesCabinet)
register('glazedCupboard', 'fixture', glazedCupboard)
register('whiteboard', 'fixture', whiteboard)
register('posterFrame', 'fixture', posterFrame)
register('pinBoard', 'fixture', pinBoard)
register('coatHooks', 'fixture', coatHooks)
register('wallClock', 'fixture', wallClock)
register('pegBoard', 'fixture', pegBoard)
