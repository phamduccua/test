import * as THREE from 'three'
import { buildProfile, createVessel, cylinderProfile, labMaterials, mm, toML, volumeBelow } from '../../vendor/lab3d/lab/index'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import { group, makeKit } from './helpers'
import { register } from './registry'

const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) })

/** Buret 50 mL: ống chia vạch, khóa (node `stopcock`), đầu nhọn; gốc ở đầu nhọn. */
function burette(ctx: Tracker) {
  const k = makeKit(ctx)
  const mats = labMaterials(ctx)
  const v = createVessel(ctx, cylinderProfile(13, 600, 1), { name: 'burette' })
  const g = group('burette', {
    kind: 'burette', displayName: 'Buret 50 mL', category: 'glassware', grabbable: true, vessel: v, capacityMl: 50, mouthRadius: mm(5.5),
    spout: [0, 0, 0], footprint: { w: mm(30), d: mm(30), h: mm(690) },
    movables: [{ name: 'stopcock', node: 'stopcock', type: 'rotate', axis: 'z', min: 0, max: Math.PI / 2, initial: 0 }],
  })
  v.group.position.y = mm(90)
  // Vạch chia: 50 vạch nhỏ, vạch 10 mL dài hơn.
  const ticks = new THREE.Group()
  for (let i = 0; i <= 50; i++) {
    const long = i % 10 === 0
    ticks.add(k.box(mm(long ? 5 : 3), mm(0.5), mm(0.5), 'blackPlastic', mm(6.6), mm(90 + 30 + i * 10), 0))
  }
  const tip = new THREE.Mesh(ctx.track(new THREE.LatheGeometry([new THREE.Vector2(mm(1), 0), new THREE.Vector2(mm(2.5), mm(50)), new THREE.Vector2(mm(5.5), mm(90))], 16)), mats.glass())
  const stopcock = new THREE.Group()
  stopcock.name = 'stopcock'
  stopcock.position.y = mm(75)
  const key = k.box(mm(36), mm(6), mm(6), 'blackPlastic', 0, -mm(3), 0)
  stopcock.add(key)
  g.add(v.group, ticks, tip, k.sphere(mm(7), mats.glass()).translateY(mm(75)), stopcock)
  return g
}

/** Ống nghiệm thu khí / lọ thu khí có nắp kính. */
function gasJar(ctx: Tracker) {
  const k = makeKit(ctx)
  const v = createVessel(ctx, cylinderProfile(60, 200, 2), { name: 'gas-jar' })
  const lid = k.cyl(mm(36), mm(36), mm(4), labMaterials(ctx).glass(), 0, mm(200), 0, 28)
  lid.name = 'lid'
  return group('gasJar', { kind: 'gasJar', displayName: 'Lọ thu khí', category: 'glassware', grabbable: true, vessel: v, capacityMl: Math.round(toML(volumeBelow(v.profile.inner, v.profile.height))), mouthRadius: mm(28), footprint: { w: mm(70), d: mm(70), h: mm(204) } }, v.group, lid)
}

/** Chén nung sứ có nắp; bát sứ cô cạn. */
function crucible(ctx: Tracker) {
  const mats = labMaterials(ctx)
  const v = createVessel(ctx, buildProfile([P(0, 0), P(16, 0), P(20, 4), P(25, 40)], mm(2)), { name: 'crucible', material: mats.ceramic() })
  const lid = makeKit(ctx).cyl(mm(27), mm(27), mm(3), mats.ceramic(), 0, mm(40), 0, 24)
  lid.name = 'lid'
  return group('crucible', { kind: 'crucible', displayName: 'Chén nung sứ', category: 'glassware', grabbable: true, vessel: v, capacityMl: 15, mouthRadius: mm(23), footprint: { w: mm(54), d: mm(54), h: mm(43) } }, v.group, lid)
}
function evaporatingDish(ctx: Tracker) {
  const v = createVessel(ctx, buildProfile([P(0, 0), P(20, 0), P(36, 12), P(45, 25)], mm(2.5)), { name: 'evaporating-dish', material: labMaterials(ctx).ceramic() })
  return group('evaporatingDish', { kind: 'evaporatingDish', displayName: 'Bát sứ', category: 'glassware', grabbable: true, vessel: v, capacityMl: 60, mouthRadius: mm(42), footprint: { w: mm(90), d: mm(90), h: mm(25) } }, v.group)
}

/** Chậu thủy tinh (dùng úp ống thu khí). */
function trough(ctx: Tracker) {
  const v = createVessel(ctx, buildProfile([P(0, 0), P(120, 0), P(124, 4), P(125, 100)], mm(4)), { name: 'trough' })
  return group('trough', { kind: 'trough', displayName: 'Chậu thủy tinh', category: 'glassware', grabbable: true, vessel: v, capacityMl: 4500, mouthRadius: mm(121), footprint: { w: mm(250), d: mm(250), h: mm(100) } }, v.group)
}

/** Nút cao su (0–2 lỗ). */
function rubberStopper(ctx: Tracker, p: Record<string, unknown> = {}) {
  const k = makeKit(ctx)
  const holes = (p.holes as number) ?? 1
  const g = group('rubberStopper', { kind: 'rubberStopper', displayName: `Nút cao su ${holes} lỗ`, category: 'apparatus', grabbable: true, footprint: { w: mm(34), d: mm(34), h: mm(28) }, params: { holes } })
  g.add(k.cyl(mm(17), mm(13), mm(28), 'rubberOrange', 0, 0, 0, 20))
  for (let i = 0; i < holes; i++) g.add(k.cyl(mm(3), mm(3), mm(1), 'blackPlastic', holes === 1 ? 0 : (i - 0.5) * mm(14), mm(28), 0, 10))
  return g
}

/** Kính bảo hộ: gọng ống bo tròn, mắt kính trong, quai. */
function goggles(ctx: Tracker) {
  const k = makeKit(ctx)
  const g = group('goggles', { kind: 'goggles', displayName: 'Kính bảo hộ', category: 'apparatus', grabbable: true, footprint: { w: mm(170), d: mm(80), h: mm(65) } })
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * mm(80), mm(32) + Math.sin(a) * mm(28), Math.sin(a) * mm(4)))
  }
  const rim = k.mesh(ctx.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, mm(7), 8, true)), new THREE.MeshPhysicalMaterial({ color: 0x1f5fbf, roughness: 0.5 }))
  ctx.track(rim.material)
  const lens = k.mesh(ctx.track(new THREE.CircleGeometry(1, 32)), 'glassPane', false)
  lens.scale.set(mm(76), mm(25), 1)
  lens.position.y = mm(32)
  const strap = k.box(mm(150), mm(14), mm(2), 'blackPlastic', 0, mm(26), -mm(60))
  g.add(rim, lens, strap)
  g.rotation.x = -0.25
  return g
}

function glovesBox(ctx: Tracker) {
  const k = makeKit(ctx)
  const g = group('glovesBox', { kind: 'glovesBox', displayName: 'Hộp găng tay', category: 'apparatus', grabbable: true, footprint: { w: mm(240), d: mm(120), h: mm(90) } })
  g.add(k.box(mm(240), mm(90), mm(120), 'paper', 0, 0, 0, mm(4)), k.box(mm(150), mm(4), mm(40), 'blackPlastic', 0, mm(88), 0))
  const glove = k.box(mm(60), mm(12), mm(30), new THREE.MeshStandardMaterial({ color: 0x5e8fd6, roughness: 0.7 }), 0, mm(90), 0, mm(6))
  ctx.track(glove.material)
  g.add(glove)
  return g
}

register('burette', 'glassware', burette)
register('gasJar', 'glassware', gasJar)
register('crucible', 'glassware', crucible)
register('evaporatingDish', 'glassware', evaporatingDish)
register('trough', 'glassware', trough)
register('rubberStopper', 'apparatus', rubberStopper, [{ holes: 1 }, { holes: 2 }])
register('goggles', 'apparatus', goggles)
register('glovesBox', 'apparatus', glovesBox)
