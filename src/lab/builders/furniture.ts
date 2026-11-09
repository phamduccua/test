import * as THREE from 'three'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import { group, makeKit } from './helpers'
import { register } from './registry'
import type { Movable, Socket, Surface } from './types'

const TOP = 9 // mặt bàn
const SLAB = 0.4
const PLINTH = 0.8
const MODULE = 6

/**
 * Thân tủ bàn thí nghiệm: hộp thân + chân lùi + mặt đá phenolic + cánh tủ/ngăn kéo theo mô-đun 6 dm.
 * `faces`: mặt có cánh tủ ('front' = +Z; 'both' = cả hai mặt dài). Gốc ở tâm đáy, dài theo X.
 */
function benchBody(ctx: Tracker, L: number, D: number, faces: 'front' | 'both', movables: Movable[], g: THREE.Group) {
  const k = makeKit(ctx)
  const bodyH = TOP - SLAB - PLINTH
  g.add(k.box(L - 0.4, PLINTH, D - 1.2, 'skirting', 0, 0, 0))
  g.add(k.box(L, bodyH, D - 0.4, 'cabinet', 0, PLINTH, 0))
  g.add(k.box(L + 0.4, SLAB, D + 0.4, 'worktop', 0, TOP - SLAB, 0, 0.08))
  const n = Math.max(1, Math.round(L / MODULE))
  const w = L / n
  const sides = faces === 'both' ? [1, -1] : [1]
  for (const s of sides) {
    for (let i = 0; i < n; i++) {
      const cx = -L / 2 + w * (i + 0.5)
      const zFace = s * (D / 2 - 0.2)
      const drawers = i % 2 === 1
      if (drawers) {
        const h = (bodyH - 0.2) / 3
        for (let j = 0; j < 3; j++) {
          const node = new THREE.Group()
          node.name = `drawer_${s > 0 ? 'f' : 'b'}${i}_${j}`
          node.position.set(cx, PLINTH + 0.1 + j * h, zFace)
          const panel = k.box(w - 0.2, h - 0.15, 0.2, 'cabinetFront', 0, 0, 0, 0.05)
          const handle = k.box(w * 0.4, 0.15, 0.25, 'handle', 0, h - 0.7, s * 0.2)
          node.add(panel, handle)
          g.add(node)
          movables.push({ name: node.name, node: node.name, type: 'translate', axis: 'z', min: 0, max: s * 4.5, initial: 0 })
        }
      } else {
        for (const half of [-1, 1]) {
          // Bản lề ở mép ngoài, cánh mở quanh trục y.
          const hinge = new THREE.Group()
          hinge.name = `door_${s > 0 ? 'f' : 'b'}${i}_${half > 0 ? 'r' : 'l'}`
          hinge.position.set(cx + half * (w / 2 - 0.1), PLINTH + 0.1, zFace)
          const dw = w / 2 - 0.15
          const panel = k.box(dw, bodyH - 0.25, 0.2, 'cabinetFront', -half * (dw / 2 + 0.05), 0, 0, 0.05)
          const handle = k.box(0.15, 1.6, 0.25, 'handle', -half * (dw - 0.5), bodyH - 3, s * 0.2)
          hinge.add(panel, handle)
          g.add(hinge)
          movables.push({ name: hinge.name, node: hinge.name, type: 'rotate', axis: 'y', min: 0, max: half * s * 1.9, initial: 0 })
        }
      }
    }
  }
}

function sink(ctx: Tracker, x: number, z: number, faceZ: number) {
  const k = makeKit(ctx)
  const g = new THREE.Group()
  g.name = 'sink'
  g.position.set(x, TOP, z)
  // Bồn: viền mỏng nổi trên mặt bàn + lòng tối.
  g.add(k.box(3.6, 0.05, 4.2, 'sinkSteel', 0, 0, 0))
  g.add(k.box(3.2, 0.06, 3.8, 'blackPlastic', 0, 0.01, 0))
  // Vòi cổ ngỗng.
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3.2, 0), new THREE.Vector3(0, 3.8, faceZ * 0.6), new THREE.Vector3(0, 3.2, faceZ * 1.3), new THREE.Vector3(0, 2.7, faceZ * 1.4)]
  const neck = k.tube(pts, 0.12, 'chrome', 24)
  neck.position.set(0, 0, -faceZ * 1.6)
  g.add(neck, k.cyl(0.25, 0.3, 0.4, 'chrome', 0, 0, -faceZ * 1.6))
  return g
}

/** Vòi gas đồng thau: thân + cần gạt (node `lever`) + đầu nối dây (socket `hose`). Gốc tâm đáy, đầu vòi hướng +Z. */
export function gasTap(ctx: Tracker): THREE.Group {
  const k = makeKit(ctx)
  const lever = new THREE.Group()
  lever.name = 'lever'
  lever.position.set(0, 0.75, 0)
  lever.add(k.box(0.12, 0.1, 0.7, 'brass', 0, 0, -0.1))
  const nozzle = k.cyl(0.07, 0.09, 0.6, 'brass', 0, 0.45, 0.12)
  nozzle.rotation.x = Math.PI / 3
  return group('gasTap', {
    kind: 'gasTap', displayName: 'Vòi khí gas', category: 'fixture', grabbable: false,
    sockets: [{ name: 'hose', pos: [0, 0.55, 0.55], accepts: ['gasHose'], radius: 0.3 }],
    movables: [{ name: 'lever', node: 'lever', type: 'rotate', axis: 'y', min: 0, max: Math.PI / 2, initial: 0 }],
  }, k.cyl(0.18, 0.22, 0.75, 'brass'), nozzle, lever)
}

function socketOutlet(ctx: Tracker) {
  const k = makeKit(ctx)
  const g = new THREE.Group()
  g.add(k.box(1.46, 0.86, 0.12, 'frame', 0, 0, 0, 0.03))
  for (const x of [-0.36, 0.36]) g.add(k.box(0.25, 0.08, 0.13, 'blackPlastic', x, 0.55, 0))
  return g
}

/** Bàn đảo: hai mặt tủ, kệ hóa chất giữa (2 tầng), 2 bồn rửa, 3 vòi gas mỗi bên, ổ cắm. */
function islandBench(ctx: Tracker, p: Record<string, unknown> = {}) {
  const L = (p.length as number) ?? 48
  const D = (p.depth as number) ?? 15
  const k = makeKit(ctx)
  const movables: Movable[] = []
  const g = group('islandBench', {
    kind: 'islandBench', displayName: 'Bàn thí nghiệm đảo', category: 'furniture', grabbable: false,
    footprint: { w: L, d: D, h: TOP },
  })
  benchBody(ctx, L, D, 'both', movables, g)
  // Kệ giữa: đế (máng kỹ thuật) + 5 cột + 2 tầng có thanh chắn.
  const SL = L - 8
  g.add(k.box(SL, 1.5, 3, 'cabinet', 0, TOP, 0, 0.1))
  for (let i = 0; i < 5; i++) g.add(k.cyl(0.15, 0.15, 8.5, 'steel', -SL / 2 + (i * SL) / 4, TOP, 0, 10))
  for (const lvl of [3.5, 6.5]) {
    g.add(k.box(SL, 0.2, 3, 'frame', 0, TOP + lvl, 0, 0.05))
    for (const s of [-1, 1]) {
      // Trụ nằm ngang: trục +y của trụ quay thành −x, nên đặt gốc ở +SL/2.
      const rail = k.cyl(0.05, 0.05, SL, 'steel', SL / 2, TOP + lvl + 0.6, s * 1.4, 8)
      rail.rotation.z = Math.PI / 2
      g.add(rail)
    }
  }
  // Vòi gas và ổ cắm trên hai mặt đế kệ.
  const sockets: Socket[] = []
  for (const s of [-1, 1]) {
    for (const x of [-16, 0, 16]) {
      const t = gasTap(ctx)
      t.position.set(x, TOP + 1.5, s * 1.2)
      t.rotation.y = s > 0 ? 0 : Math.PI
      t.name = `gasTap_${s > 0 ? 'f' : 'b'}${x}`
      g.add(t)
      sockets.push({ name: t.name, pos: [x, TOP + 1.5, s * 1.2], accepts: ['gasHose'], radius: 0.4 })
    }
    for (const x of [-8, 8]) {
      const o = socketOutlet(ctx)
      o.position.set(x, TOP + 0.35, s * 1.52)
      if (s < 0) o.rotation.y = Math.PI
      g.add(o)
    }
  }
  // Bồn rửa hai đầu (lệch về hai phía khác nhau).
  g.add(sink(ctx, -L / 2 + 2.3, 3, 1), sink(ctx, L / 2 - 2.3, -3, -1))
  const surfaces: Surface[] = [
    { name: 'top', y: TOP, minX: -L / 2 + 4.3, maxX: L / 2 - 4.3, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3, kind: 'bench' },
    { name: 'shelf0', y: TOP + 3.7, minX: -SL / 2, maxX: SL / 2, minZ: -1.3, maxZ: 1.3, kind: 'shelf' },
    { name: 'shelf1', y: TOP + 6.7, minX: -SL / 2, maxX: SL / 2, minZ: -1.3, maxZ: 1.3, kind: 'shelf' },
  ]
  Object.assign(g.userData.meta, { surfaces, sockets, movables })
  return g
}

/** Bàn một mặt tủ (bàn giáo viên, bàn tường). `sink` = đặt bồn ở đầu −X. */
function wallBench(ctx: Tracker, p: Record<string, unknown> = {}) {
  const L = (p.length as number) ?? 30
  const D = (p.depth as number) ?? 6.5
  const movables: Movable[] = []
  const g = group('wallBench', {
    kind: 'wallBench', displayName: (p.title as string) ?? 'Bàn thí nghiệm', category: 'furniture', grabbable: false,
    footprint: { w: L, d: D, h: TOP },
  })
  benchBody(ctx, L, D, 'front', movables, g)
  const sockets: Socket[] = []
  if (p.sink) g.add(sink(ctx, -L / 2 + 2.6, 0.2, 1))
  if (p.gas) {
    const t = gasTap(ctx)
    t.position.set(-L / 2 + 6.5, TOP, -D / 2 + 1)
    g.add(t)
    sockets.push({ name: 'gasTap', pos: [-L / 2 + 6.5, TOP, -D / 2 + 1], accepts: ['gasHose'], radius: 0.4 })
  }
  const surfaces: Surface[] = [{ name: 'top', y: TOP, minX: -L / 2 + (p.sink ? 5 : 0.3), maxX: L / 2 - 0.3, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3, kind: 'bench' }]
  Object.assign(g.userData.meta, { surfaces, sockets, movables })
  return g
}

/** Ghế đẩu: mặt gỗ tròn, 4 chân thép choãi, vòng đỡ chân. */
function stool(ctx: Tracker) {
  const k = makeKit(ctx)
  const H = 6.5
  const g = group('stool', { kind: 'stool', displayName: 'Ghế đẩu', category: 'furniture', grabbable: false, footprint: { w: 3.6, d: 3.6, h: H } })
  g.add(k.cyl(1.8, 1.75, 0.3, 'wood', 0, H - 0.3, 0, 28))
  g.add(k.cyl(1.2, 1.2, 0.15, 'steel', 0, H - 0.45, 0, 20))
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4
    const top = new THREE.Vector3(Math.cos(a) * 1.0, H - 0.45, Math.sin(a) * 1.0)
    const foot = new THREE.Vector3(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6)
    g.add(k.tube([foot, top], 0.12, 'steel', 2))
    g.add(k.cyl(0.16, 0.16, 0.12, 'blackPlastic', foot.x, 0, foot.z, 10))
  }
  const ring = k.torus(1.35, 0.07, 'steel')
  ring.rotation.x = Math.PI / 2
  ring.position.y = 2.2
  g.add(ring)
  return g
}

/** Xe đẩy inox 2 tầng: tầng y 2,5 và 8,5. */
function cart(ctx: Tracker) {
  const k = makeKit(ctx)
  const W = 8
  const D = 5
  const g = group('cart', {
    kind: 'cart', displayName: 'Xe đẩy', category: 'furniture', grabbable: false, footprint: { w: W, d: D, h: 9 },
    surfaces: [2.5, 8.5].map((y, i) => ({ name: `tier${i}`, y: y + 0.15, minX: -W / 2 + 0.3, maxX: W / 2 - 0.3, minZ: -D / 2 + 0.3, maxZ: D / 2 - 0.3, kind: 'tray' as const })),
    params: { pushable: true },
  })
  for (const y of [2.5, 8.5]) {
    g.add(k.box(W, 0.15, D, 'steel', 0, y, 0, 0.05))
    g.add(k.box(W, 0.5, 0.06, 'steel', 0, y, D / 2 - 0.03), k.box(W, 0.5, 0.06, 'steel', 0, y, -D / 2 + 0.03))
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    g.add(k.cyl(0.15, 0.15, 8.5, 'steel', x * (W / 2 - 0.2), 0.6, z * (D / 2 - 0.2), 10))
    const wheel = k.cyl(0.45, 0.45, 0.3, 'blackPlastic', 0, 0, 0, 16)
    wheel.rotation.x = Math.PI / 2
    wheel.position.set(x * (W / 2 - 0.2), 0.45, z * (D / 2 - 0.2) - 0.15)
    g.add(wheel)
  }
  const handle = k.tube([new THREE.Vector3(-W / 2 - 0.2, 8.5, -1.8), new THREE.Vector3(-W / 2 - 1, 9.6, -1.8), new THREE.Vector3(-W / 2 - 1, 9.6, 1.8), new THREE.Vector3(-W / 2 - 0.2, 8.5, 1.8)], 0.15, 'steel', 16)
  g.add(handle)
  return g
}

register('islandBench', 'furniture', islandBench)
register('wallBench', 'furniture', wallBench, [{ length: 30, depth: 8, sink: true, gas: true, title: 'Bàn giáo viên' }])
register('stool', 'furniture', stool)
register('cart', 'furniture', cart)
register('gasTap', 'fixture', (ctx) => gasTap(ctx))
