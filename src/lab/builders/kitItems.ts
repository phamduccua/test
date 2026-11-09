import * as THREE from 'three'
import { describe as chemAppearance, getSpecies, makeSolution, toDisplay } from '../../chem/index'
import {
  createAlcoholLamp, createBeaker, createBunsenBurner, createDropper, createErlenmeyer, createFunnel, createGlassRod, createGraduatedCylinder,
  createJar, createLabNotebook, createMortar, createNail, createPaperSheet, createPen, createPetri, createPipette, createReagentBottle,
  createRetortStand, createRoundFlask, createSpatula, createSplint, createStopwatch, createTestTube, createThermometer, createTray,
  createTripodGauze, createTubeHolder, createTubeRack, createWashBottle, createWatchGlass, createWaterBath, createDigitalScale,
  drawCrossMark, volumeBelow, toML, mm,
} from '../../vendor/lab3d/lab/index'
import type { Vessel } from '../../vendor/lab3d/lab/glassware/vessel'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import { group } from './helpers'
import { register } from './registry'
import type { Category, ObjectMeta } from './types'

const capacity = (v: Vessel) => Math.round(toML(volumeBelow(v.profile.inner, v.profile.height)))
const footprintOf = (o: THREE.Object3D) => {
  const b = new THREE.Box3().setFromObject(o)
  const s = b.getSize(new THREE.Vector3())
  return { w: +s.x.toFixed(2), d: +s.z.toFixed(2), h: +s.y.toFixed(2) }
}

function wrapVessel(kind: string, name: string, v: Vessel, extra: Partial<ObjectMeta> = {}) {
  const meta: ObjectMeta = {
    kind, displayName: name, category: 'glassware', grabbable: true, vessel: v, capacityMl: capacity(v),
    mouthRadius: v.profile.inner[v.profile.inner.length - 1]!.r, footprint: footprintOf(v.group), ...extra,
  }
  return group(kind, meta, v.group)
}

function wrap(kind: string, name: string, category: Category, obj: THREE.Object3D, extra: Partial<ObjectMeta> = {}) {
  return group(kind, { kind, displayName: name, category, grabbable: true, footprint: footprintOf(obj), ...extra }, obj)
}

// ---- Thủy tinh ----
for (const size of [100, 250, 500] as const)
  register(`beaker${size}`, 'glassware', (ctx) => {
    const v = createBeaker(ctx, size)
    return wrapVessel(`beaker${size}`, `Cốc thủy tinh ${size} mL`, v, { spout: [v.profile.maxRadius, v.mouthY, 0] })
  })
register('erlenmeyer250', 'glassware', (ctx) => wrapVessel('erlenmeyer250', 'Bình tam giác 250 mL', createErlenmeyer(ctx, 250)))
register('testTube', 'glassware', (ctx) => wrapVessel('testTube', 'Ống nghiệm', createTestTube(ctx)))
register('cylinder100', 'glassware', (ctx) => wrapVessel('cylinder100', 'Ống đong 100 mL', createGraduatedCylinder(ctx, 100)))
register('cylinder50', 'glassware', (ctx) => wrapVessel('cylinder50', 'Ống đong 50 mL', createGraduatedCylinder(ctx, 50)))
register('roundFlask', 'glassware', (ctx) => wrapVessel('roundFlask', 'Bình cầu', createRoundFlask(ctx, { flatBottom: true })))
register('volumetricFlask', 'glassware', (ctx) => wrapVessel('volumetricFlask', 'Bình định mức 250 mL', createRoundFlask(ctx, { diameter: 80, neckD: 16, neckLen: 140, flatBottom: true })))
register('funnel', 'glassware', (ctx) => wrapVessel('funnel', 'Phễu thủy tinh', createFunnel(ctx)))
register('watchGlass', 'glassware', (ctx) => wrapVessel('watchGlass', 'Mặt kính đồng hồ', createWatchGlass(ctx)))
register('petri', 'glassware', (ctx) => {
  const p = createPetri(ctx)
  return wrap('petri', 'Đĩa petri', 'glassware', p.group, { vessel: p.base })
})
register('glassRod', 'glassware', (ctx) => {
  const r = createGlassRod(ctx)
  r.rotation.z = Math.PI / 2
  r.position.y = mm(4)
  return wrap('glassRod', 'Đũa thủy tinh', 'glassware', r)
})
register('pipette', 'glassware', (ctx) => {
  const p = createPipette(ctx)
  p.group.rotation.z = Math.PI / 2
  p.group.position.y = mm(8)
  return wrap('pipette', 'Ống hút nhỏ giọt', 'glassware', p.group, { params: { pipette: p } })
})

// ---- Lọ hóa chất: màu dung dịch lấy từ bộ máy hóa học ----
const CAP: Record<string, string> = { acid: 'red', base: 'blue', salt: 'green', halogen: 'orange', peroxide: 'purple', metal: 'blue', other: 'blue' }
function concText(c: number) {
  return `${String(c).replace('.', ',')} M`
}

/** Chai thuốc thử: params { species, conc, volumeMl?, amber?, style? } hoặc chất rắn { species, grams }. */
function reagentBottle(ctx: Tracker, p: Record<string, unknown> = {}) {
  const id = (p.species as string) ?? 'HCl'
  const s = getSpecies(id)
  const conc = (p.conc as number) ?? s.defaultConc ?? 1
  const style = (p.style as 'bottle' | 'dropper' | 'wide') ?? 'bottle'
  const solid = p.grams !== undefined
  const strong = s.concentratedAboveM !== undefined && conc >= s.concentratedAboveM
  const label = toDisplay(String(p.label ?? s.formula))
  const sub = solid ? `${p.grams} g` : strong ? `đặc ${concText(conc)}` : (p.sublabel as string) ?? concText(conc)
  let liquidColor: string | undefined
  let liquidOpacity: number | undefined
  let solidColor: string | undefined
  if (solid) solidColor = s.color?.solid ?? (s.class === 'metal' ? '#9aa3a8' : '#f2f2ee')
  else {
    const look = chemAppearance(makeSolution(id, conc, 100))
    liquidColor = look.colorHex
    liquidOpacity = Math.min(0.85, look.opacity + 0.1)
  }
  const b = createReagentBottle(ctx, {
    style, label, sublabel: sub, amber: (p.amber as boolean) ?? false, capColor: (CAP[s.class] ?? 'blue') as never,
    liquidColor, liquidOpacity, fill: 0.75, solidColor, solidFill: 0.5, dropper: style === 'dropper' ? 'black' : false,
  })
  const chem = solid ? { speciesId: id, grams: p.grams as number } : { speciesId: id, concM: conc, volumeMl: (p.volumeMl as number) ?? 180 }
  return group('reagentBottle', {
    kind: style === 'dropper' ? 'dropperBottle' : solid ? 'solidJar' : 'reagentBottle',
    displayName: `${s.nameVi} ${sub}`,
    category: 'reagent', grabbable: true, vessel: b.vessel, capacityMl: capacity(b.vessel), mouthRadius: b.vessel.profile.inner.at(-1)!.r,
    footprint: footprintOf(b.group), chem, params: { bottle: b, hazards: s.hazards },
  }, b.group)
}
register('reagentBottle', 'reagent', reagentBottle, [
  { species: 'HCl', conc: 1 }, { species: 'CuSO4', conc: 0.5 }, { species: 'KMnO4', conc: 0.02 }, { species: 'H2SO4', conc: 18, amber: true },
  { species: 'Zn', grams: 20, style: 'wide' },
])
register('dropperBottle', 'reagent', (ctx, p = {}) => {
  const name = (p.label as string) ?? 'Phenolphtalein'
  const b = createReagentBottle(ctx, { style: 'dropper', label: name, sublabel: (p.sublabel as string) ?? 'chỉ thị', capColor: 'purple', liquidColor: (p.color as string) ?? '#f4f6f8', liquidOpacity: 0.3, fill: 0.7, dropper: 'black' })
  return group('dropperBottle', {
    kind: 'dropperBottle', displayName: `Lọ nhỏ giọt ${name}`, category: 'reagent', grabbable: true, vessel: b.vessel, footprint: footprintOf(b.group),
    params: { bottle: b, indicator: p.indicator ?? 'phenolphthalein' },
  }, b.group)
}, [{ label: 'Phenolphtalein', indicator: 'phenolphthalein' }, { label: 'Metyl da cam', indicator: 'methyl_orange', color: '#f08c00' }])
register('washBottle', 'reagent', (ctx) => {
  const w = createWashBottle(ctx)
  return wrap('washBottle', 'Bình tia nước cất', 'reagent', w.group, { chem: { speciesId: 'H2O', volumeMl: 400 }, params: { tip: w.tip } })
})

// ---- Dụng cụ ----
register('tubeRack', 'apparatus', (ctx, p = {}) => {
  const r = createTubeRack(ctx, { slots: (p.slots as number) ?? 6 })
  const g = wrap('tubeRack', 'Giá ống nghiệm', 'apparatus', r.group, {
    sockets: r.slots.map((s, i) => ({ name: `slot${i}`, pos: [s.x, s.y, s.z] as [number, number, number], accepts: ['testTube'], radius: mm(12) })),
  })
  if (p.tubes) r.slots.slice(0, p.tubes as number).forEach((s) => {
    const t = createTestTube(ctx)
    t.group.position.copy(s)
    r.group.add(t.group)
  })
  return g
}, [{ slots: 6, tubes: 4 }])
register('retortStand', 'apparatus', (ctx, p = {}) => {
  const r = createRetortStand(ctx, { clampHeight: (p.clampHeight as number) ?? mm(300), ringHeight: (p.ring as boolean) ? mm(200) : null })
  const c = r.clampPoint.position
  return wrap('retortStand', 'Giá đỡ thí nghiệm', 'apparatus', r.group, {
    sockets: [{ name: 'clamp', pos: [c.x, c.y, c.z], accepts: ['testTube', 'burette', 'thermometer', 'erlenmeyer250'], radius: mm(20) }],
    params: { stand: r },
  })
}, [{}])
register('tripodGauze', 'apparatus', (ctx) => {
  const t = createTripodGauze(ctx)
  return wrap('tripodGauze', 'Kiềng ba chân và lưới', 'apparatus', t.group, {
    sockets: [{ name: 'top', pos: [0, t.topY, 0], accepts: ['beaker100', 'beaker250', 'beaker500', 'erlenmeyer250', 'roundFlask'], radius: mm(40) }],
    params: { tripod: t },
  })
})
register('bunsenBurner', 'apparatus', (ctx, p = {}) => {
  const b = createBunsenBurner(ctx, { lit: (p.lit as boolean) ?? false, hoseTo: p.hoseTo as THREE.Vector3 | undefined })
  return wrap('bunsenBurner', 'Đèn Bunsen', 'apparatus', b.group, { params: { burner: b } })
})
register('alcoholLamp', 'apparatus', (ctx) => {
  const l = createAlcoholLamp(ctx)
  return wrap('alcoholLamp', 'Đèn cồn', 'apparatus', l.group, { params: { lamp: l } })
})
register('thermometer', 'apparatus', (ctx) => {
  const t = createThermometer(ctx, { min: -10, max: 110, value: 25 })
  t.group.rotation.z = Math.PI / 2
  t.group.position.y = mm(6)
  return wrap('thermometer', 'Nhiệt kế', 'apparatus', t.group, { params: { thermometer: t } })
})
register('stopwatch', 'apparatus', (ctx) => {
  const s = createStopwatch(ctx)
  return wrap('stopwatch', 'Đồng hồ bấm giờ', 'apparatus', s.group, { params: { stopwatch: s } })
})
register('splint', 'apparatus', (ctx) => {
  const s = createSplint(ctx)
  s.group.rotation.z = Math.PI / 2
  s.group.position.y = mm(3)
  return wrap('splint', 'Que đóm', 'apparatus', s.group, { params: { splint: s } })
})
register('spatula', 'apparatus', (ctx) => {
  const s = createSpatula(ctx)
  s.group.position.y = mm(3)
  return wrap('spatula', 'Thìa xúc hóa chất', 'apparatus', s.group, { params: { spatula: s } })
})
register('dropper', 'apparatus', (ctx) => {
  const d = createDropper(ctx)
  d.rotation.z = Math.PI / 2
  d.position.y = mm(8)
  return wrap('dropper', 'Ống nhỏ giọt', 'apparatus', d)
})
register('tubeHolder', 'apparatus', (ctx) => {
  const h = createTubeHolder(ctx)
  h.rotation.z = Math.PI / 2
  h.position.y = mm(8)
  return wrap('tubeHolder', 'Kẹp ống nghiệm', 'apparatus', h)
})
register('waterBath', 'apparatus', (ctx) => {
  const w = createWaterBath(ctx)
  return wrap('waterBath', 'Bể ổn nhiệt', 'apparatus', w.group, { params: { bath: w } })
})
register('digitalScale', 'apparatus', (ctx) => {
  const s = createDigitalScale(ctx)
  return wrap('digitalScale', 'Cân điện tử', 'apparatus', s.group, { params: { scale: s } })
})
register('mortar', 'apparatus', (ctx) => {
  const m = createMortar(ctx)
  m.pestle.position.set(mm(20), mm(30), 0)
  m.pestle.rotation.z = -0.6
  m.group.add(m.pestle)
  return wrap('mortar', 'Cối và chày sứ', 'apparatus', m.group)
})
register('tray', 'apparatus', (ctx, p = {}) => {
  const t = createTray(ctx, { width: (p.width as number) ?? 350, depth: (p.depth as number) ?? 250, material: 'plastic', color: 'blue' })
  return wrap('tray', 'Khay nhựa', 'apparatus', t.group, {
    surfaces: [{ name: 'tray', y: t.floorY, minX: -t.inner.width / 2, maxX: t.inner.width / 2, minZ: -t.inner.depth / 2, maxZ: t.inner.depth / 2, kind: 'tray' }],
  })
})
register('notebook', 'apparatus', (ctx) => {
  const n = createLabNotebook(ctx, { title: 'Sổ thí nghiệm' })
  return wrap('notebook', 'Sổ thí nghiệm', 'apparatus', n.group, { params: { notebook: n } })
})
register('pen', 'apparatus', (ctx) => wrap('pen', 'Bút', 'apparatus', createPen(ctx).group))
register('crossCard', 'apparatus', (ctx) => {
  const s = createPaperSheet(ctx, { width: 1, depth: 1, draw: (g, W, H) => drawCrossMark(g, W, H) })
  return wrap('crossCard', 'Tấm giấy đánh dấu X', 'apparatus', s)
})
register('nail', 'reagent', (ctx) => {
  const n = createNail(ctx)
  return wrap('nail', 'Đinh sắt', 'reagent', n.group, { chem: { speciesId: 'Fe', grams: 2 } })
})
register('jar', 'reagent', (ctx, p = {}) => {
  const j = createJar(ctx, { preset: 'yogurt', label: (p.label as string) ?? 'Mẫu', capColor: 'blue' })
  return wrap('jar', 'Lọ mẫu', 'reagent', j.group, { vessel: j.vessel })
})
