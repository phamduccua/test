import * as THREE from 'three'
import { addPickProxy, createHoverFx, movedBeyond, pointerHub } from '../../vendor/lab3d/interact/index'
import type { SoundLoop } from '../../vendor/lab3d/audio/types'
import type { SimContext } from '../../vendor/lab3d/sim/types'
import type { Movable, ObjectMeta } from '../builders/types'
import { resolveCollisions } from '../collision'
import { labEvents } from '../events'
import type { Box2 } from '../layout'
import type { RoomLighting } from '../lighting'
import { releaseMovable } from '../optimize'
import type { PlacedObject, Room } from '../room/roomBuilder'
import type { FreeWalk } from '../walk'
import { clampInto, freeSpot, nearestSocket, surfaceAt, type Disc, type SocketLike, type SurfaceLike } from './placement'

/**
 * Tương tác trong phòng (theo cách của kit: một `pointerHub` mỗi sim, viền sáng `createHoverFx`, toast, âm định vị).
 * - Đồ vật: BẤM = cầm lên tay (mang đi khắp phòng) · GIỮ ≥ 0,45 s = soi nhãn · KÉO = trượt trên mặt bàn tại chỗ.
 * - Đang cầm: bấm lên mặt bàn/kệ/khay để đặt (tự tìm chỗ trống), bấm gần giá ống nghiệm/kiềng/kẹp để cắm vào ổ; Q = trả chỗ cũ; E = soi nhãn.
 * - Nội thất: bấm cánh tủ, ngăn kéo, cửa kính tủ hút, cần vòi gas để mở/đóng; bấm xe đẩy để đẩy/thả.
 * Không dùng createGrabbable của kit vì nó mở phiên kéo ngay khi nhấn, nên không nhận được "bấm nhanh" để cầm mang đi.
 */
export interface Interaction {
  readonly held: PlacedObject | null
  frame(dt: number): void
  /** Đưa mọi đồ về chỗ ban đầu, đóng mọi cánh tủ, tắt gas, thả xe. */
  resetAll(): void
  /** Ổ đang cắm của vật (`${chủ}:${ổ}`) – hóa học dùng để biết bình có đang trên lửa không. */
  socketOf(id: string): string | undefined
  /** Nghiêng vật đang cầm (rad, quanh trục nhìn) – hoạt cảnh rót. */
  setHeldTilt(rad: number): void
  /** Vật đang cầm "dùng hết" (đinh thả vào ống, kính đã đeo): ẩn đi, tay trống; Làm lại đưa về chỗ cũ. */
  consumeHeld(): void
  /** Gắn vật đang cầm vào `parent` tại `pos` (cục bộ) – vd. ống dẫn khí lắp vào miệng bình. */
  attachHeld(parent: THREE.Object3D, pos: THREE.Vector3): void
}

/** Móc để tầng hóa học (chặng 7) gắn thao tác vào tương tác chung. Trả `true` = đã xử lý. */
export interface InteractionHooks {
  /** Đang cầm `held`, bấm vào đồ `target` (rót, nhỏ giọt, xúc, thử que đóm, đo nhiệt độ…). */
  use?(held: PlacedObject, target: PlacedObject): boolean
  useHint?(held: PlacedObject, target: PlacedObject): string | null
  /** Tay trống, bấm vào đồ hoặc nội thất có chức năng riêng (đèn cồn, Bunsen, đồng hồ, kính bảo hộ). */
  activate?(p: PlacedObject, point: THREE.Vector3): boolean
  activateHint?(p: PlacedObject): string | null
}

interface Home { parent: THREE.Object3D; pos: THREE.Vector3; quat: THREE.Quaternion; socket?: string }
interface MovableRef { owner: THREE.Object3D; ownerId: string; spec: Movable; node: THREE.Object3D; key: string }

const LONG_PRESS = 450
const up = new THREE.Vector3(0, 1, 0)

export function createInteraction(ctx: SimContext, room: Room, walk: FreeWalk, lighting: RoomLighting | null, hooks: InteractionHooks = {}): Interaction {
  const hub = pointerHub(ctx)
  const audio = ctx.audio
  audio.setSpatialScale(6)
  audio.ambient([{ id: 'lab/lab-ambience', level: 0.35 }, { id: 'lab/room-tone', level: 0.15 }], 2)
  const shadows = () => lighting?.invalidateShadows()

  const placed = room.placed
  const items = [...placed.values()].filter((p) => p.parentId && p.meta.grabbable)
  const owners = [...placed.values()].filter((p) => !p.parentId)
  const homes = new Map<string, Home>()
  /** Ổ cắm đang có vật: khóa `${chủ}:${tên ổ}` → id vật. */
  const occupied = new Map<string, string>()
  const socketOf = new Map<string, string>()
  for (const it of items) {
    const g = it.group
    const parentId = it.parentId!
    const socket = placed.get(parentId)?.meta.sockets?.find((s) => g.position.distanceTo(new THREE.Vector3(...s.pos)) < 1e-6)
    homes.set(it.id, { parent: g.parent!, pos: g.position.clone(), quat: g.quaternion.clone(), socket: socket ? `${parentId}:${socket.name}` : undefined })
    if (socket) {
      occupied.set(`${parentId}:${socket.name}`, it.id)
      socketOf.set(it.id, `${parentId}:${socket.name}`)
    }
  }

  let held: PlacedObject | null = null
  let heldTilt = 0
  let pushing: PlacedObject | null = null
  const radius = (m: ObjectMeta) => Math.max(0.25, (Math.max(m.footprint?.w ?? 0.6, m.footprint?.d ?? 0.6) / 2) * 0.9)
  const name = (p: PlacedObject) => p.meta.displayName

  // ---------- Ổ cắm, chỗ trống ----------
  const allSockets = (exclude: PlacedObject | null): SocketLike[] => {
    const out: SocketLike[] = []
    const v = new THREE.Vector3()
    for (const p of placed.values()) {
      if (!p.meta.sockets || p === exclude) continue
      if (exclude && exclude.group.getObjectById(p.group.id)) continue
      for (const s of p.meta.sockets) {
        p.group.localToWorld(v.set(...s.pos))
        const key = `${p.id}:${s.name}`
        out.push({ key, x: v.x, y: v.y, z: v.z, radius: s.radius, accepts: s.accepts, occupied: occupied.has(key) })
      }
    }
    return out
  }
  const discsOn = (parent: THREE.Object3D, s: SurfaceLike, except?: THREE.Object3D): Disc[] =>
    parent.children
      .filter((c) => c !== except && c.userData.meta && Math.abs(c.position.y - s.y) < 0.5)
      .map((c) => ({ u: c.position.x, v: c.position.z, r: radius(c.userData.meta as ObjectMeta) }))

  const faceCamera = (obj: THREE.Object3D, parent: THREE.Object3D) => {
    const d = ctx.camera.getWorldDirection(new THREE.Vector3())
    const worldYaw = Math.atan2(d.x, d.z) + Math.PI
    const pq = parent.getWorldQuaternion(new THREE.Quaternion())
    const parentYaw = new THREE.Euler().setFromQuaternion(pq, 'YXZ').y
    obj.quaternion.setFromAxisAngle(up, worldYaw - parentYaw)
  }

  const sfxPlace = (p: PlacedObject) => audio.sfx(p.meta.category === 'glassware' || p.meta.category === 'reagent' ? 'lab/glass-put' : 'ui/drop', { at: p.group, pitchJitter: 0.06 })

  // ---------- Cầm, đặt, trả ----------
  const pick = (it: PlacedObject) => {
    if (held || pushing) return
    const key = socketOf.get(it.id)
    if (key) {
      occupied.delete(key)
      socketOf.delete(it.id)
    }
    ctx.scene.attach(it.group)
    held = it
    it.group.traverse((o) => (o as THREE.Mesh).isMesh && (o.castShadow = false))
    audio.sfx('ui/pick', { at: it.group })
    shadows()
    labEvents.emit({ type: 'pick', id: it.id, name: name(it) })
  }

  const putInto = (it: PlacedObject, parent: THREE.Object3D, pos: THREE.Vector3, socketKey?: string, face = true) => {
    parent.add(it.group)
    it.group.position.copy(pos)
    if (face) faceCamera(it.group, parent)
    if (socketKey) {
      occupied.set(socketKey, it.id)
      socketOf.set(it.id, socketKey)
    }
    it.group.traverse((o) => (o as THREE.Mesh).isMesh && (o.castShadow = true))
    sfxPlace(it)
    shadows()
  }

  const placeHeld = (owner: PlacedObject, point: THREE.Vector3): boolean => {
    const it = held
    if (!it) return false
    const sock = nearestSocket(allSockets(it), it.meta.kind, point.x, point.y, point.z)
    if (sock) {
      const [ownerId, sName] = sock.key.split(':') as [string, string]
      const o = placed.get(ownerId)!
      const s = o.meta.sockets!.find((x) => x.name === sName)!
      held = null
      putInto(it, o.group, new THREE.Vector3(...s.pos), sock.key, false)
      it.group.quaternion.identity()
      labEvents.emit({ type: 'place', id: it.id, name: name(it), on: ownerId, onName: name(o), socket: sName })
      return true
    }
    const local = owner.group.worldToLocal(point.clone())
    const s = surfaceAt(owner.meta.surfaces ?? [], local.x, local.y, local.z)
    if (!s) {
      hub.toast.show('Không đặt được ở đây – bấm lên mặt bàn, kệ hoặc khay')
      audio.sfx('ui/wrong')
      return false
    }
    const spot = freeSpot(s, local.x, local.z, radius(it.meta), discsOn(owner.group, s))
    if (!spot) {
      hub.toast.show('Chỗ này đã kín, chọn chỗ khác')
      audio.sfx('ui/wrong')
      return false
    }
    held = null
    putInto(it, owner.group, new THREE.Vector3(spot[0], s.y, spot[1]))
    labEvents.emit({ type: 'place', id: it.id, name: name(it), on: owner.id, onName: name(owner) })
    return true
  }

  const returnHome = (it: PlacedObject) => {
    const h = homes.get(it.id)!
    if (held === it) held = null
    const key = socketOf.get(it.id)
    if (key) {
      occupied.delete(key)
      socketOf.delete(it.id)
    }
    const free = !h.socket || !occupied.has(h.socket)
    putInto(it, h.parent, h.pos, free ? h.socket : undefined, false)
    it.group.quaternion.copy(h.quat)
    labEvents.emit({ type: 'return', id: it.id, name: name(it) })
  }

  // ---------- Trượt tại chỗ ----------
  const slide = (it: PlacedObject) => {
    const g = it.group
    const parent = g.parent!
    const ownerMeta = parent.userData.meta as ObjectMeta | undefined
    const s = ownerMeta?.surfaces && surfaceAt(ownerMeta.surfaces, g.position.x, g.position.y + 0.1, g.position.z)
    if (!s || socketOf.has(it.id)) return null
    const plane = new THREE.Plane(up, -g.getWorldPosition(new THREE.Vector3()).y)
    const start = g.position.clone()
    const r = radius(it.meta)
    const w = new THREE.Vector3()
    return {
      move(ray: THREE.Ray) {
        if (!ray.intersectPlane(plane, w)) return
        const l = parent.worldToLocal(w)
        const [u, v] = clampInto(s, l.x, l.z, r)
        g.position.set(u, s.y, v)
      },
      end(cancelled: boolean) {
        if (cancelled) return g.position.copy(start)
        const wp = g.getWorldPosition(new THREE.Vector3())
        const sock = nearestSocket(allSockets(it), it.meta.kind, wp.x, wp.y, wp.z)
        if (sock) {
          const [ownerId, sName] = sock.key.split(':') as [string, string]
          const o = placed.get(ownerId)!
          putInto(it, o.group, new THREE.Vector3(...o.meta.sockets!.find((x) => x.name === sName)!.pos), sock.key, false)
          it.group.quaternion.identity()
          labEvents.emit({ type: 'place', id: it.id, name: name(it), on: ownerId, onName: name(o), socket: sName })
          return
        }
        const spot = freeSpot(s, g.position.x, g.position.z, r, discsOn(parent, s, g)) ?? [start.x, start.z]
        g.position.set(spot[0], s.y, spot[1])
        sfxPlace(it)
        shadows()
        const owner = [...placed.values()].find((p) => p.group === parent)
        labEvents.emit({ type: 'place', id: it.id, name: name(it), on: owner?.id ?? '', onName: owner ? name(owner) : '' })
      },
    }
  }

  // ---------- Đồ vật ----------
  // Đồ mảnh (que đóm, nhiệt kế, ống dẫn khí, ống nhỏ giọt): thêm hộp bắt vô hình ≥ 0,5 dm để bấm trúng.
  const bb = new THREE.Box3()
  for (const it of items) {
    it.group.updateMatrixWorld(true)
    bb.setFromObject(it.group)
    const size = bb.getSize(new THREE.Vector3())
    if (Math.min(size.x, size.y, size.z) >= 0.15) continue
    const c = it.group.worldToLocal(bb.getCenter(new THREE.Vector3()))
    const turned = Math.abs(Math.sin(it.group.rotation.y)) > 0.7
    const [sx, sz] = turned ? [size.z, size.x] : [size.x, size.z]
    addPickProxy(ctx.track, it.group, new THREE.Vector3(Math.max(sx, 0.5), Math.max(size.y, 0.5), Math.max(sz, 0.5)), c)
  }
  for (const it of items) {
    const hover = createHoverFx(ctx, it.group, {})
    const owner = () => placed.get(it.parentId!)!
    hub.add({
      object: it.group,
      priority: 2,
      hint: () =>
        pushing ? null
          : held ? hooks.useHint?.(held, it) ?? (it.meta.surfaces || it.meta.sockets ? `Bấm để đặt ${name(held)} vào ${name(it)}` : null)
            : hooks.activateHint?.(it) ?? `${name(it)} · bấm: cầm · giữ: xem nhãn · kéo: trượt`,
      enabled: () => !pushing && it.group.parent !== ctx.scene && it.group.visible,
      onHover: (s) => hover(s),
      onDown(h) {
        if (held) {
          // Đang cầm: bấm vào đồ = dùng đồ đang cầm lên nó; không dùng được thì đặt xuống (giá, khay, tấm giấy, bàn bên dưới).
          const point = h.point.clone()
          return {
            cursor: 'pointer',
            end(_q, cancelled) {
              if (cancelled || !held) return
              if (hooks.use?.(held, it)) return
              void placeHeld(it.meta.surfaces ? it : owner(), point)
            },
          }
        }
        const t0 = performance.now()
        let drag: ReturnType<typeof slide> | null | undefined
        return {
          cursor: 'grab',
          move(q) {
            if (drag === undefined && movedBeyond(q.totalX, q.totalY)) drag = slide(it)
            drag?.move(q.ray)
          },
          end(_q, cancelled) {
            if (drag) return drag.end(cancelled)
            if (drag === null || cancelled) return
            if (performance.now() - t0 >= LONG_PRESS) labEvents.emit({ type: 'inspect', id: it.id, meta: it.meta })
            else if (!hooks.activate?.(it, h.point)) pick(it)
          },
        }
      },
    })
  }

  // ---------- Phần di chuyển được (cánh tủ, ngăn kéo, cửa kính, cần gas) ----------
  const movableValue = new Map<string, number>()
  const base = new Map<string, number>()
  const gasLoops = new Map<string, SoundLoop>()
  const movablesOf = (p: PlacedObject): MovableRef[] => {
    const out: MovableRef[] = []
    const visit = (o: THREE.Object3D) => {
      if (o !== p.group && o.userData.instanceId) return
      const meta = o.userData.meta as ObjectMeta | undefined
      for (const spec of meta?.movables ?? []) {
        const node = o.getObjectByName(spec.node)
        if (node) out.push({ owner: o, ownerId: p.id, spec, node, key: `${p.id}/${o.uuid}/${spec.node}` })
      }
      o.children.forEach(visit)
    }
    visit(p.group)
    return out
  }
  const ownerMovables = new Map(owners.map((p) => [p.id, movablesOf(p)]))
  const setMovable = (m: MovableRef, v: number) => {
    const prop = m.spec.type === 'rotate' ? m.node.rotation : m.node.position
    if (!base.has(m.key)) base.set(m.key, prop[m.spec.axis] - m.spec.initial)
    prop[m.spec.axis] = base.get(m.key)! + v
    movableValue.set(m.key, v)
  }
  const SFX: Record<string, [string, string]> = {
    rotate: ['lab/incubator-door-open', 'lab/incubator-door-close'], translate: ['lab/tray-open', 'lab/tray-close'],
    sash: ['lab/lid-open', 'lab/lid-close'], lever: ['lab/knob-turn', 'lab/knob-turn'],
  }
  const toggleMovable = (m: MovableRef, force?: boolean) => {
    const v0 = movableValue.get(m.key) ?? m.spec.initial
    const open = force ?? Math.abs(v0 - m.spec.max) > Math.abs(v0 - m.spec.min)
    const v1 = open ? m.spec.max : m.spec.min
    releaseMovable(m.owner, m.spec.node)
    const kind = m.spec.name === 'sash' ? 'sash' : m.spec.name === 'lever' ? 'lever' : m.spec.type
    audio.sfx(SFX[kind]![open ? 0 : 1], { at: m.node })
    hub.tween(m.spec.name === 'lever' ? 0.25 : 0.6, (k) => setMovable(m, v0 + (v1 - v0) * k), shadows)
    if (m.spec.name === 'lever') {
      const loop = gasLoops.get(m.key)
      if (open && !loop) gasLoops.set(m.key, audio.loop('lab/gas-hiss', { at: m.node, level: 0.35, refDistance: 3 }))
      if (!open && loop) {
        loop.stop(0.3)
        gasLoops.delete(m.key)
      }
      labEvents.emit({ type: 'gas', id: m.key, on: open })
    }
    labEvents.emit({ type: 'movable', id: m.key, owner: m.ownerId, node: m.spec.node, open })
  }
  const box = new THREE.Box3()
  const movableNear = (p: PlacedObject, point: THREE.Vector3): MovableRef | null => {
    let best: MovableRef | null = null
    let bestD = 0.5
    for (const m of ownerMovables.get(p.id) ?? []) {
      box.setFromObject(m.node)
      const d = box.distanceToPoint(point)
      if (d < bestD) {
        bestD = d
        best = m
      }
    }
    return best
  }

  // ---------- Xe đẩy ----------
  const cartBox = room.colliders.find((b) => b.id === 'cart')
  const others = room.colliders.filter((b) => b.id !== 'cart')
  let cartLoop: SoundLoop | null = null
  const lastCart = new THREE.Vector3()
  const togglePush = (p: PlacedObject) => {
    if (pushing) {
      pushing = null
      cartLoop?.stop(0.3)
      cartLoop = null
      const c = p.group.position
      if (cartBox) Object.assign(cartBox, { minX: c.x - 4.5, maxX: c.x + 4.5, minZ: c.z - 4.5, maxZ: c.z + 4.5 })
      audio.sfx('lab/cart-bump', { at: p.group, volume: 0.6 })
      shadows()
      labEvents.emit({ type: 'cart', pushing: false })
      return
    }
    pushing = p
    if (cartBox) Object.assign(cartBox, { minX: 1e6, maxX: 1e6 + 1, minZ: 1e6, maxZ: 1e6 + 1 } satisfies Partial<Box2>)
    lastCart.copy(p.group.position)
    cartLoop = audio.loop('lab/cart-roll', { at: p.group, level: 0 })
    labEvents.emit({ type: 'cart', pushing: true })
  }

  // ---------- Nội thất ----------
  for (const p of owners) {
    const hasSurfaces = !!p.meta.surfaces?.length
    const movables = ownerMovables.get(p.id) ?? []
    if (!hasSurfaces && !movables.length && p.meta.kind !== 'cart') continue
    hub.add({
      object: p.group,
      priority: 0,
      cursor: 'pointer',
      hint: () =>
        held ? `Bấm để đặt ${name(held)} vào ${name(p)}` : pushing ? (pushing === p ? 'Bấm để thả xe' : null)
          : p.meta.kind === 'cart' ? 'Bấm để đẩy xe' : movables.length ? 'Bấm cánh tủ, ngăn kéo, vòi gas để mở/đóng' : null,
      enabled: () => !pushing || pushing === p,
      onTap(hit) {
        if (pushing === p) return togglePush(p)
        if (held) return void placeHeld(p, hit.point)
        if (p.meta.kind === 'cart') return togglePush(p)
        if (hooks.activate?.(p, hit.point)) return
        const m = movableNear(p, hit.point)
        if (m) toggleMovable(m)
      },
    })
  }

  // ---------- Phím ----------
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
    if (e.code === 'KeyQ' && held) returnHome(held)
    else if (e.code === 'KeyE' && held) labEvents.emit({ type: 'inspect', id: held.id, meta: held.meta })
    else return
    e.preventDefault()
  }
  window.addEventListener('keydown', onKey)
  ctx.track(() => window.removeEventListener('keydown', onKey))

  const camPos = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const want = new THREE.Vector3()
  const wantQ = new THREE.Quaternion()
  const tiltQ = new THREE.Quaternion()
  const zAxis = new THREE.Vector3(0, 0, 1)
  return {
    get held() {
      return held
    },
    socketOf: (id) => socketOf.get(id),
    setHeldTilt(rad) {
      heldTilt = rad
    },
    consumeHeld() {
      if (!held) return
      held.group.visible = false
      const it = held
      held = null
      heldTilt = 0
      labEvents.emit({ type: 'return', id: it.id, name: name(it) })
      // Về chỗ cũ nhưng vẫn ẩn – Làm lại hiện lại.
      const h = homes.get(it.id)!
      h.parent.add(it.group)
      it.group.position.copy(h.pos)
      it.group.quaternion.copy(h.quat)
    },
    attachHeld(parent, pos) {
      if (!held) return
      const it = held
      held = null
      heldTilt = 0
      parent.add(it.group)
      it.group.position.copy(pos)
      it.group.quaternion.identity()
      it.group.traverse((o) => (o as THREE.Mesh).isMesh && (o.castShadow = true))
      shadows()
      labEvents.emit({ type: 'place', id: it.id, name: name(it), on: parent.userData.instanceId ?? '', onName: (parent.userData.meta as ObjectMeta | undefined)?.displayName ?? '' })
    },
    frame(dt) {
      ctx.camera.getWorldPosition(camPos)
      ctx.camera.getWorldDirection(fwd)
      if (held) {
        // Cầm trước mặt, lệch phải – vật cao (buret, ống đong) đẩy ra xa hơn cho vừa khung nhìn.
        const h = held.meta.footprint?.h ?? 1
        want.set(2, -1.9 - h * 0.25, -4.5 - h * 0.9)
        ctx.camera.localToWorld(want)
        const yaw = Math.atan2(fwd.x, fwd.z) + Math.PI
        wantQ.setFromAxisAngle(up, yaw)
        // Rót: nghiêng sang trái (miệng bình về phía giữa khung nhìn).
        if (heldTilt) wantQ.multiply(tiltQ.setFromAxisAngle(zAxis, heldTilt))
        const k = 1 - Math.exp(-dt * 18)
        held.group.position.lerp(want, k)
        held.group.quaternion.slerp(wantQ, k)
      }
      if (pushing) {
        const flat = fwd.setY(0).normalize()
        const target = new THREE.Vector3(camPos.x + flat.x * 6.5, 0, camPos.z + flat.z * 6.5)
        ;[target.x, target.z] = resolveCollisions(target.x, target.z, 3.2, others)
        const g = pushing.group
        g.position.lerp(target, 1 - Math.exp(-dt * 10))
        g.rotation.y = Math.atan2(flat.x, flat.z) - Math.PI / 2
        const speed = g.position.distanceTo(lastCart) / Math.max(dt, 1e-3)
        lastCart.copy(g.position)
        cartLoop?.set(Math.min(1, speed / 15))
      }
      void walk
    },
    resetAll() {
      if (pushing) togglePush(pushing)
      for (const it of items) {
        if (it.group.parent !== homes.get(it.id)!.parent || held === it) returnHome(it)
        it.group.visible = true
      }
      heldTilt = 0
      for (const list of ownerMovables.values())
        for (const m of list) if ((movableValue.get(m.key) ?? m.spec.initial) !== m.spec.initial) {
          releaseMovable(m.owner, m.spec.node)
          setMovable(m, m.spec.initial)
        }
      for (const l of gasLoops.values()) l.stop(0.2)
      gasLoops.clear()
      held = null
      shadows()
    },
  }
}
