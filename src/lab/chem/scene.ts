import * as THREE from 'three'
import { cloneMixture, describe, getSpecies, toDisplay, type Conditions, type Indicator, type Mixture, type Phenomenon, type ReactionResult } from '../../chem/index'
import type { SoundLoop } from '../../vendor/lab3d/audio/types'
import { pointerHub } from '../../vendor/lab3d/interact/index'
import {
  createBubbles, createFoam, createLiquid, createPourStream, createPowderHeap, createPrecipitate, createProfileGas,
  type AlcoholLamp, type Bubbles, type Burner, type Foam, type Liquid, type PowderHeap, type Precipitate, type ProfileGas,
  type Splint, type StopwatchView, type Thermometer,
} from '../../vendor/lab3d/lab/index'
import type { Vessel } from '../../vendor/lab3d/lab/glassware/vessel'
import type { SimContext } from '../../vendor/lab3d/sim/types'
import type { ObjectMeta } from '../builders/types'
import { labEvents } from '../events'
import type { Interaction, InteractionHooks } from '../interact/index'
import { refreshLod } from '../lod'
import type { PlacedObject, Room } from '../room/roomBuilder'
import {
  applyUse, bubbleGas, contentLabel, crossCheck, fmt, heatCheck, heatStep, kineticTick, makeContent, planUse, splintTest, takeNewGas,
  volumeMl, type Content, type ContentKind, type HeaterKind, type UsePlan,
} from './core'

/**
 * Hóa học trong phòng 3D: mỗi bình có `Content` (hỗn hợp thật) + chất lỏng/bột/bọt/kết tủa/khí của kit.
 * Hiện tượng vẽ theo `ReactionResult` và sự kiện động học – không có chỗ nào chọn hiệu ứng theo tên cặp chất.
 */
export interface ChemLab {
  hooks: InteractionHooks
  /** Gọi sau khi có `Interaction` (cần biết ổ cắm, nghiêng tay). */
  bind(ix: Interaction): void
  /** Giờ mô phỏng (đã nhân tốc độ, dừng khi tạm dừng). */
  update(dt: number): void
  /** Mỗi khung hình (hoạt cảnh rót theo thời gian thực). */
  frame(dt: number): void
  reset(): void
  content(id: string): Content | undefined
  /** Cho bài học chạy Tự động: dùng `from` lên `to` như người bấm (không cần cầm). */
  autoUse(from: string, to: string, plan?: UsePlan): boolean
}

interface View {
  p: PlacedObject
  c: Content
  initial: Mixture
  vessel: Vessel | null
  liquid: Liquid | null
  heap: PowderHeap | null
  bubbles: Bubbles | null
  gasCloud: ProfileGas | null
  foam: Foam | null
  precip: Precipitate | null
  /** Cường độ sủi bọt hiện tại (0…1) và màu khí. */
  gas: number
  gasColor: string | null
  fizz: SoundLoop | null
  lodDirty: number
}

const CONTAINER_SKIP = new Set(['funnel', 'deliveryTube', 'gasJar', 'trough'])

function kindOf(m: ObjectMeta): ContentKind | null {
  if (m.kind === 'reagentBottle') return 'stock'
  if (m.kind === 'solidJar') return 'solidStock'
  if (m.kind === 'dropperBottle') return 'indicator'
  if (m.kind === 'washBottle') return 'water'
  if (m.kind === 'nail') return 'sample'
  if (m.vessel && m.category === 'glassware' && !CONTAINER_SKIP.has(m.kind)) return 'container'
  return null
}

const SOLID_DENSITY = 2.5
const solidColor = (id: string) => {
  const s = getSpecies(id)
  return s.color?.solid ?? (s.class === 'metal' ? '#9aa3a8' : '#f2f2ee')
}

export function createChemLab(ctx: SimContext, room: Room): ChemLab {
  const audio = ctx.audio
  const hub = pointerHub(ctx)
  const placed = room.placed
  const views = new Map<string, View>()
  let ix: Interaction | null = null
  let now = 0

  // ---------- Nội dung ban đầu ----------
  for (const p of placed.values()) {
    const kind = kindOf(p.meta)
    if (!kind) continue
    const ind = kind === 'indicator' ? ((p.meta.params?.indicator as Indicator | undefined) ?? 'phenolphthalein') : undefined
    const c = makeContent(p.id, p.meta.displayName, kind, p.meta.capacityMl ?? 0, p.meta.chem, ind)
    const bottle = p.meta.params?.bottle as { liquid: Liquid | null } | undefined
    const vessel = p.meta.vessel ?? null
    let liquid: Liquid | null = bottle?.liquid ?? null
    if (kind === 'container' && vessel) {
      liquid = createLiquid(ctx, vessel.profile, { volumeML: 0 })
      vessel.group.add(liquid.mesh)
    }
    views.set(p.id, { p, c, initial: cloneMixture(c.mixture), vessel, liquid, heap: null, bubbles: null, gasCloud: null, foam: null, precip: null, gas: 0, gasColor: null, fizz: null, lodDirty: 0 })
  }

  // ---------- Đèn, đồng hồ, nhiệt kế, que đóm ----------
  const lamps = [...placed.values()].filter((p) => p.meta.kind === 'alcoholLamp').map((p) => ({ p, lamp: p.meta.params!.lamp as AlcoholLamp }))
  const sets = [...placed.values()].filter((p) => p.meta.kind === 'heatingSet').map((p) => ({ p, burner: p.meta.params!.burner as Burner }))
  // Đèn cồn của kit dựng sẵn đang cháy – trong phòng, đèn tắt cho tới khi học sinh châm.
  for (const l of lamps) l.lamp.setLit(false)
  const gasOn = new Set<string>()
  let flameLoop: SoundLoop | null = null
  const watches = [...placed.values()].filter((p) => p.meta.kind === 'stopwatch').map((p) => ({ p, view: p.meta.params!.stopwatch as StopwatchView, t: 0, running: false }))
  let thermo: { p: PlacedObject; t: Thermometer; target: View } | null = null
  let goggles = false
  let tube: { p: PlacedObject; source: View | null; target: View | null; seen: Record<string, number>; reported: boolean } | null = null
  const hudTimers = new Map<string, number>()

  const ownerLamp = (key: string | undefined) => lamps.find((l) => key === `${l.p.id}:flame`)
  const ownerSet = (key: string | undefined) => sets.find((s) => key === `${s.p.id}:top`)
  const heaterOf = (v: View): HeaterKind | null => {
    const key = ix?.socketOf(v.p.id)
    if (ownerLamp(key)?.lamp.lit) return 'lamp'
    if (ownerSet(key)?.burner && setLit.has(ownerSet(key)!.p.id)) return 'burner'
    return null
  }
  const setLit = new Set<string>()
  const updateFlameLoop = () => {
    const any = lamps.some((l) => l.lamp.lit) || setLit.size > 0
    if (any && !flameLoop) flameLoop = audio.loop('lab/flame', { level: 0.25 })
    if (!any && flameLoop) {
      flameLoop.stop(0.4)
      flameLoop = null
    }
  }

  // ---------- Điều kiện cho bộ máy ----------
  const hood = [...placed.values()].find((p) => p.meta.kind === 'fumeCupboard' || p.id === 'fume_cupboard')
  const hoodBox = (() => {
    const v = hood?.meta.params?.hoodVolume as { min: number[]; max: number[] } | undefined
    if (!hood || !v) return null
    hood.group.updateMatrixWorld(true)
    const box = new THREE.Box3(new THREE.Vector3(...v.min), new THREE.Vector3(...v.max))
    return box.applyMatrix4(hood.group.matrixWorld)
  })()
  const wp = new THREE.Vector3()
  const condOf = (v: View): Partial<Conditions> => {
    v.p.group.getWorldPosition(wp)
    const heater = heaterOf(v)
    return {
      temperatureC: v.c.mixture.temperatureC,
      heated: !!heater,
      catalyst: (v.c.mixture.solids.MnO2 ?? 0) > 0 ? 'MnO2' : undefined,
      inFumeHood: !!hoodBox?.containsPoint(wp),
      open: !(tube && tube.source === v),
    }
  }

  // ---------- Ngoại hình ----------
  const surfaceOf = (v: View) => () => v.liquid?.level ?? v.vessel?.profile.innerBottom ?? 0
  const look = (v: View, dur = 0.6) => {
    const m = v.c.mixture
    const d = describe(m)
    if (v.liquid && v.c.kind === 'container') {
      v.liquid.setVolume(volumeMl(m))
      v.liquid.setColor(d.colorHex, dur, Math.max(0.12, d.opacity))
      v.liquid.setTurbidity(d.turbidity, dur, d.precipitateColorHex)
    }
    if (v.vessel && v.c.kind === 'container') {
      const solids = Object.entries(m.solids).filter(([, mol]) => mol > 1e-9)
      const ml = solids.reduce((a, [id, mol]) => a + (mol * getSpecies(id).molarMass) / SOLID_DENSITY, 0)
      if (ml > 0.005 && !v.heap) {
        v.heap = createPowderHeap(ctx, v.vessel.profile, { color: solidColor(solids[0]![0]) })
        v.vessel.group.add(v.heap.mesh)
      }
      if (v.heap) {
        v.heap.setVolume(Math.max(0, ml))
        if (solids[0]) (v.heap.mesh.material as THREE.MeshStandardMaterial).color.set(solidColor(solids[0][0]))
      }
    }
    v.lodDirty = 1.2
  }

  const ensureBubbles = (v: View) => {
    if (!v.vessel || v.bubbles || !v.liquid) return v.bubbles
    v.bubbles = createBubbles(ctx, v.vessel.profile, { rate: 0, surface: surfaceOf(v), maxCount: 160 })
    v.vessel.group.add(v.bubbles.mesh)
    return v.bubbles
  }
  /** Vẽ hiện tượng từ kết quả bộ máy (một lần) hoặc từ sự kiện động học (mỗi bước). */
  const render = (v: View, ph: Phenomenon[], burst: boolean) => {
    if (!v.vessel) return
    for (const p of ph) {
      if (p.type === 'gas') {
        v.gas = Math.max(v.gas, burst ? Math.max(0.5, p.intensity) : p.intensity)
        if (p.colorHex && p.colorHex.toLowerCase() !== '#ffffff') {
          v.gasColor = p.colorHex
          if (!v.gasCloud) {
            v.gasCloud = createProfileGas(ctx, v.vessel.profile, { bottom: v.liquid?.level, strat: 1.2 })
            v.vessel.group.add(v.gasCloud.group)
            const mat = (v.gasCloud.group.children[0] as THREE.Mesh | undefined)?.material as THREE.ShaderMaterial | undefined
            mat?.uniforms?.uGlow?.value?.set?.(p.colorHex)
          }
          v.gasCloud.density = Math.max(v.gasCloud.density, 0.6 * Math.max(0.4, p.intensity))
        }
        if (p.intensity > 0.7 && !v.foam && v.liquid) {
          v.foam = createFoam(ctx, v.vessel.profile, { surface: surfaceOf(v), count: 260 })
          v.vessel.group.add(v.foam.mesh)
        }
      } else if (p.type === 'precipitate' && v.liquid) {
        if (!v.precip) {
          v.precip = createPrecipitate(ctx, v.vessel.profile, { color: p.colorHex, surface: surfaceOf(v), maxCount: 220, maxLayer: 0.02 })
          v.vessel.group.add(v.precip.group)
        }
        v.precip.forming = true
        v.precip.rate = 60
        setTimeout(() => v.precip && (v.precip.forming = false), 3000)
      }
    }
  }

  const publish = (v: View, title: string, r: ReactionResult, via: 'mix' | 'heat' | 'gas', indicatorOnly = false) => {
    labEvents.emit({ type: 'reaction', vessel: v.p.id, title, result: r, indicatorOnly, via })
    render(v, r.phenomena, true)
    const worst = r.safety.find((s) => s.level === 'danger') ?? r.safety.find((s) => s.level === 'warning')
    if (worst) {
      ctx.warn(worst.messageVi.replace(/^(Nguy hiểm|Cảnh báo)\s*:\s*/i, ''), { title: worst.level === 'danger' ? 'Nguy hiểm' : 'Cảnh báo' })
      audio.sfx('ui/wrong', { volume: 0.4 })
      hudTimers.set('warn', worst.level === 'danger' ? 12 : 7)
    }
    if (r.happened && r.phenomena.some((p) => p.type === 'gas')) audio.sfx('lab/acid-bubble', { at: v.p.group, volume: 0.7 })
    if (r.happened && r.phenomena.some((p) => p.type === 'temperature' && p.deltaC > 10)) audio.sfx('lab/sizzle', { at: v.p.group, volume: 0.4 })
  }

  // ---------- Rót: hoạt cảnh ----------
  const stream = createPourStream(ctx, { look: 'visible' })
  ctx.scene.add(stream.mesh)
  // Hoạt cảnh rót chỉ để nhìn: hóa học áp dụng ngay khi bấm (máy chậm vẫn đúng thứ tự thao tác).
  let pour: { src: View; dst: View; t: number; flow: number } | null = null
  const mouthWorld = (v: View, out: THREE.Vector3) => {
    if (v.vessel) return v.vessel.mouth.getWorldPosition(out)
    return v.p.group.getWorldPosition(out).add(new THREE.Vector3(0, (v.p.meta.footprint?.h ?? 1) * 0.9, 0))
  }

  const doUse = (src: View, dst: View, plan: UsePlan) => {
    const conc = (src.c.kind === 'stock' && /đặc/.test(src.c.name)) || /đặc/.test(src.p.meta.displayName)
    if (conc && !goggles) {
      ctx.warn('Đang dùng axit đặc mà chưa đeo kính bảo hộ – bấm vào kính bảo hộ trên bàn để đeo.', { title: 'An toàn' })
      hudTimers.set('warn', 8)
      labEvents.emit({ type: 'chemNote', kind: 'safety', text: 'Dùng axit đặc khi chưa đeo kính bảo hộ' })
    }
    const o = applyUse(src.c, dst.c, plan, condOf(dst), now)
    look(src)
    look(dst)
    if (plan.type === 'sample') ix?.consumeHeld()
    if (o.result) publish(dst, o.title, o.result, 'mix', o.indicatorOnly)
    else labEvents.emit({ type: 'chemNote', vessel: dst.p.id, kind: 'action', text: o.title })
    if (plan.type === 'drop') audio.sfx('lab/drip', { at: dst.p.group })
    else if (plan.type === 'scoop') audio.sfx('lab/scoop', { at: dst.p.group })
    else if (plan.type === 'sample') audio.sfx('lab/water-plop', { at: dst.p.group })
  }

  const start = (src: View, dst: View, auto = false): boolean => {
    const plan = planUse(src.c, dst.c)
    if ('error' in plan) {
      hub.toast.show(plan.error)
      audio.sfx('ui/wrong')
      return true
    }
    if (plan.type !== 'pour' || auto) {
      doUse(src, dst, plan)
      return true
    }
    pour = { src, dst, t: 0, flow: Math.min(1, 0.3 + plan.ml / 30) }
    stream.setColor(describe(src.c.mixture).colorHex)
    audio.sfx(plan.ml > 5 ? 'lab/water-pour-glass-cc0' : 'lab/pour-short', { at: dst.p.group, volume: 0.7 })
    doUse(src, dst, plan)
    return true
  }

  // ---------- Dụng cụ cầm tay ----------
  const useTool = (held: PlacedObject, v: View): boolean => {
    const k = held.meta.kind
    if (k === 'thermometer') {
      if (v.c.kind !== 'container' || volumeMl(v.c.mixture) < 0.5) {
        hub.toast.show('Nhúng nhiệt kế vào bình có dung dịch')
        return true
      }
      thermo = { p: held, t: held.meta.params!.thermometer as Thermometer, target: v }
      audio.sfx('lab/glass-tap', { at: v.p.group })
      const T = v.c.mixture.temperatureC
      labEvents.emit({ type: 'measure', key: 'temperature', label: `Nhiệt độ ${v.p.meta.displayName}`, value: T, unit: '°C', vessel: v.p.id })
      return true
    }
    if (k === 'splint') {
      const s = held.meta.params!.splint as Splint
      const r = splintTest(v.c, now)
      s.setState(r.flame)
      if (r.sound) audio.sfx(r.sound, { at: v.p.group })
      labEvents.emit({ type: 'chemNote', vessel: v.p.id, kind: 'action', text: `Que đóm vào miệng ${v.p.meta.displayName}: ${r.textVi}` })
      hub.toast.show(r.textVi)
      setTimeout(() => s.setState('ember'), 3000)
      return true
    }
    if (k === 'deliveryTube') {
      if (v.c.kind !== 'container') return false
      if (!tube || tube.p !== held || !tube.source) {
        tube = { p: held, source: v, target: null, seen: { ...v.c.mixture.gases }, reported: false }
        audio.sfx('lab/stopper-squeak', { at: v.p.group })
        hub.toast.show(`Đã lắp nút + ống dẫn vào ${v.p.meta.displayName} – bấm bình nhận để nhúng đầu ống`)
        labEvents.emit({ type: 'chemNote', vessel: v.p.id, kind: 'action', text: `Lắp ống dẫn khí vào ${v.p.meta.displayName}` })
        return true
      }
      if (v === tube.source) return true
      tube.target = v
      const src = tube.source
      ix?.attachHeld(src.vessel?.group ?? src.p.group, new THREE.Vector3(0, src.vessel?.mouthY ?? 1, 0))
      audio.sfx('lab/glass-clink', { at: v.p.group })
      labEvents.emit({ type: 'chemNote', vessel: v.p.id, kind: 'action', text: `Dẫn khí từ ${src.p.meta.displayName} vào ${v.p.meta.displayName} (${contentLabel(v.c.mixture)})` })
      return true
    }
    return false
  }

  const hooks: InteractionHooks = {
    use(held, target) {
      const v = views.get(target.id)
      if (!v) return false
      const src = views.get(held.id)
      if (src) return start(src, v)
      return useTool(held, v)
    },
    useHint(held, target) {
      const v = views.get(target.id)
      if (!v) return null
      const src = views.get(held.id)
      if (!src) {
        const k = held.meta.kind
        if (k === 'thermometer') return `Bấm để đo nhiệt độ ${target.meta.displayName}`
        if (k === 'splint') return `Bấm để đưa que đóm vào miệng ${target.meta.displayName}`
        if (k === 'deliveryTube') return tube?.source && tube.p === held ? `Bấm để nhúng đầu ống dẫn vào ${target.meta.displayName}` : `Bấm để lắp ống dẫn vào ${target.meta.displayName}`
        return null
      }
      const plan = planUse(src.c, v.c)
      if ('error' in plan) return plan.error
      const what = plan.type === 'pour' ? `rót ${fmt(plan.ml)} mL` : plan.type === 'drop' ? `nhỏ ${plan.drops} giọt` : plan.type === 'scoop' ? `cho ${fmt(plan.grams)} g` : 'thả'
      return `Bấm để ${what} vào ${target.meta.displayName} (${contentLabel(v.c.mixture)})`
    },
    activate(p, point) {
      const lamp = lamps.find((l) => l.p === p)
      if (lamp) {
        lamp.lamp.setLit(!lamp.lamp.lit)
        audio.sfx(lamp.lamp.lit ? 'lab/match-strike' : 'lab/lamp-cap', { at: p.group })
        labEvents.emit({ type: 'chemNote', kind: 'action', text: lamp.lamp.lit ? 'Châm đèn cồn' : 'Đậy nắp tắt đèn cồn' })
        updateFlameLoop()
        return true
      }
      const w = watches.find((x) => x.p === p)
      if (w) {
        if (w.running) w.running = false
        else if (w.t > 0) w.t = 0
        else w.running = true
        w.view.setTime(w.t, w.running)
        audio.sfx('lab/stopwatch', { at: p.group })
        if (!w.running && w.t > 0) labEvents.emit({ type: 'measure', key: 'stopwatch', label: 'Đồng hồ bấm giờ', value: w.t, unit: 's' })
        return true
      }
      if (p.meta.kind === 'goggles') {
        goggles = true
        ix?.consumeHeld()
        p.group.visible = false
        audio.sfx('ui/pick')
        labEvents.emit({ type: 'wear', item: 'goggles', on: true })
        ctx.hud.set('goggles', 'Kính bảo hộ', 'đang đeo')
        return true
      }
      // Bunsen của bộ đun trên bàn (nội thất): cần vòi gas của bàn đang mở.
      for (const s of sets) {
        if (s.p.parentId !== p.id) continue
        const b = s.burner.group.getWorldPosition(new THREE.Vector3())
        if (Math.hypot(b.x - point.x, b.z - point.z) > 1.3) continue
        const lit = setLit.has(s.p.id)
        if (!lit && !gasOn.has(p.id)) {
          hub.toast.show('Mở vòi gas trên bàn trước rồi mới châm đèn Bunsen')
          audio.sfx('ui/wrong')
          return true
        }
        if (lit) setLit.delete(s.p.id)
        else setLit.add(s.p.id)
        s.burner.setLit(!lit)
        audio.sfx(lit ? 'lab/knob-turn' : 'lab/lighter', { at: s.p.group })
        labEvents.emit({ type: 'chemNote', kind: 'action', text: lit ? 'Tắt đèn Bunsen' : 'Châm đèn Bunsen' })
        updateFlameLoop()
        return true
      }
      return false
    },
    activateHint(p) {
      const lamp = lamps.find((l) => l.p === p)
      if (lamp) return lamp.lamp.lit ? 'Bấm để đậy nắp tắt đèn cồn · kéo để dời' : 'Bấm để châm đèn cồn · kéo để dời'
      if (watches.some((x) => x.p === p)) return 'Bấm: chạy / dừng / về 0'
      if (p.meta.kind === 'goggles') return 'Bấm để đeo kính bảo hộ'
      return null
    },
  }

  labEvents.on((e) => {
    if (e.type === 'gas') {
      const owner = e.id.split('/')[0]!
      if (e.on) gasOn.add(owner)
      else {
        gasOn.delete(owner)
        for (const s of sets)
          if (s.p.parentId === owner && setLit.has(s.p.id)) {
            setLit.delete(s.p.id)
            s.burner.setLit(false)
            labEvents.emit({ type: 'chemNote', kind: 'action', text: 'Khóa gas – đèn Bunsen tắt' })
          }
        updateFlameLoop()
      }
    }
    if (e.type === 'pick' && tube && tube.p.id === e.id && tube.target) {
      tube = null
      labEvents.emit({ type: 'chemNote', kind: 'action', text: 'Tháo ống dẫn khí' })
    }
  })

  // ---------- Bước mô phỏng ----------
  const update = (dt: number) => {
    now += dt
    for (const v of views.values()) {
      if (v.c.kind !== 'container') continue
      const heater = heaterOf(v)
      const T0 = v.c.mixture.temperatureC
      if (heater || Math.abs(T0 - 25) > 0.05) heatStep(v.c, dt, heater)
      if (heater) {
        const before = contentLabel(v.c.mixture)
        const r = heatCheck(v.c, condOf(v), now)
        const quiet = r && !r.happened && (r.reasonCode === 'DILUTION_ONLY' || r.reasonCode === 'NO_NEW_ION_PAIR' || r.reasonCode === 'INERT')
        if (r && !quiet) {
          publish(v, `Đun ${v.p.meta.displayName} (${before}) tới ${Math.round(v.c.mixture.temperatureC)} °C`, r, 'heat')
          look(v)
        }
        if (volumeMl(v.c.mixture) > 0.5 && v.c.mixture.temperatureC >= 99.5) v.gas = Math.max(v.gas, 0.8)
      } else v.c.heatEvalC = Math.min(v.c.heatEvalC ?? 25, Math.max(25, v.c.mixture.temperatureC - 15))
      const k = kineticTick(v.c, dt, now)
      if (k.gas.length) render(v, k.gas, false)
      if (k.active || k.gas.length) {
        look(v, 0.3)
        v.lodDirty = 3
      }
      const hidden = v.p.group.parent?.userData.meta?.kind === 'crossCard' ? crossCheck(v.c, now) : null
      if (hidden !== null) {
        labEvents.emit({ type: 'crossHidden', vessel: v.p.id, seconds: hidden })
        audio.sfx('lab/device-beep', { at: v.p.group, volume: 0.5 })
      }
      // Bọt, khí màu, âm sủi tắt dần.
      v.gas *= Math.exp(-dt / 1.8)
      if (v.bubbles || v.gas > 0.03) {
        const b = ensureBubbles(v)
        if (b) b.rate = v.gas > 0.03 ? 15 + 120 * v.gas : 0
      }
      if (v.foam) v.foam.setHeight(v.gas > 0.6 ? 0.25 * v.gas : 0)
      if (v.gasCloud) v.gasCloud.density *= Math.exp(-dt / 20)
      const lvl = v.gas > 0.05 ? Math.min(1, v.gas) : 0
      if (lvl && !v.fizz) v.fizz = audio.loop(lvl > 0.6 ? 'lab/bubbles-strong' : 'lab/fizz', { at: v.p.group, level: 0, refDistance: 2 })
      v.fizz?.set(lvl * 0.6)
      if (!lvl && v.fizz) {
        v.fizz.stop(0.5)
        v.fizz = null
      }
      v.bubbles?.update(dt)
      v.precip?.update(dt)
      v.gasCloud?.update(dt)
      v.foam?.update(dt, now)
    }
    // Ống dẫn khí: khí mới sinh ra ở bình nguồn sục vào bình nhận.
    if (tube?.source && tube.target) {
      const gas = takeNewGas(tube.source.c, tube.seen)
      const sum = Object.values(gas).reduce((a, b) => a + b, 0)
      if (sum > 0) {
        tube.target.gas = Math.max(tube.target.gas, Math.min(1, sum * 4000))
        const r = bubbleGas(tube.target.c, gas, condOf(tube.target), now)
        if (r) look(tube.target, 0.4)
        if (r?.happened && !tube.reported) {
          tube.reported = true
          publish(tube.target, `Dẫn khí ${Object.keys(gas).map((id) => toDisplay(getSpecies(id).formula)).join(', ')} vào ${tube.target.p.meta.displayName}`, r, 'gas')
        }
      }
    }
    for (const w of watches)
      if (w.running) {
        w.t += dt
        w.view.setTime(w.t, true)
        ctx.hud.set('stopwatch', 'Đồng hồ', `${w.t.toFixed(1)} s`)
      }
    if (thermo) {
      const T = thermo.target.c.mixture.temperatureC
      thermo.t.setTemperature(T)
      thermo.t.update(dt)
      ctx.hud.set('thermo', `Nhiệt độ (${thermo.target.p.meta.displayName})`, `${T.toFixed(1)} °C`)
    }
    for (const [k, t] of hudTimers) {
      const left = t - dt
      if (left > 0) hudTimers.set(k, left)
      else {
        hudTimers.delete(k)
        if (k === 'warn') ctx.warn(null)
      }
    }
  }

  const tmpA = new THREE.Vector3()
  const tmpB = new THREE.Vector3()
  const frame = (dt: number) => {
    for (const l of lamps) l.lamp.update(dt)
    for (const s of sets) s.burner.update(dt)
    for (const v of views.values()) {
      v.liquid?.update(dt)
      if (v.lodDirty > 0) {
        v.lodDirty -= dt
        if (v.lodDirty <= 0) refreshLod(v.p.group)
      }
    }
    if (pour) {
      // 0–0,35 s nghiêng; 0,35–1,1 s chảy (áp dụng ở giữa); 1,1–1,45 s dựng lại.
      pour.t += dt
      const t = pour.t
      const tilt = t < 0.35 ? t / 0.35 : t < 1.1 ? 1 : Math.max(0, 1 - (t - 1.1) / 0.35)
      if (ix?.held === pour.src.p) ix.setHeldTilt(tilt * 1.15)
      const flowing = t > 0.3 && t < 1.15
      if (flowing) {
        mouthWorld(pour.src, tmpA)
        mouthWorld(pour.dst, tmpB)
        stream.set(tmpA, tmpB, pour.flow)
      } else stream.set(tmpA, tmpB, 0)
      if (t > 1.45) {
        ix?.setHeldTilt(0)
        pour = null
      }
    }
  }

  return {
    hooks,
    bind(i) {
      ix = i
    },
    update,
    frame,
    reset() {
      pour = null
      stream.set(tmpA, tmpB, 0)
      for (const v of views.values()) {
        v.c.mixture = cloneMixture(v.initial)
        v.c.recentGas = {}
        v.c.mixedAt = undefined
        v.c.crossHidden = false
        v.c.heatEvalC = undefined
        v.gas = 0
        v.bubbles?.clear()
        v.precip?.clear()
        if (v.gasCloud) v.gasCloud.density = 0
        v.foam?.setHeight(0, true)
        v.fizz?.stop(0.2)
        v.fizz = null
        look(v, 0)
      }
      for (const l of lamps) l.lamp.setLit(false)
      for (const s of sets) s.burner.setLit(false)
      setLit.clear()
      gasOn.clear()
      updateFlameLoop()
      for (const w of watches) {
        w.t = 0
        w.running = false
        w.view.setTime(0, false)
      }
      thermo = null
      tube = null
      goggles = false
      ctx.hud.clear()
      ctx.warn(null)
    },
    content: (id) => views.get(id)?.c,
    autoUse(from, to, plan) {
      const a = views.get(from)
      const b = views.get(to)
      if (!a || !b) return false
      if (plan) {
        doUse(a, b, plan)
        return true
      }
      return start(a, b, true)
    },
  }
}
