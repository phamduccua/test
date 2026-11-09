import * as THREE from 'three'
import type { SimContext } from '../vendor/lab3d/sim/types'
import { resolveCollisions } from './collision'
import { BODY_RADIUS, ROOM, type Box2, type Pose } from './layout'

const WALK = 20 // dm/s
const RUN = 36
const FLY = 40
const TURN = 1.6 // rad/s (phím mũi tên trái/phải, nút cảm ứng)
const LOOK = 0.5 // khoảng từ mắt tới tâm quay của OrbitControls (dm)
const BOB = 0.2 // biên độ nhún đầu (dm)

const KEYS: Record<string, string> = {
  KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', KeyD: 'right',
  ArrowLeft: 'turnL', ArrowRight: 'turnR', Space: 'up', KeyC: 'down', ControlLeft: 'down',
}

const SEAT_EYE = 13.4 // mắt khi ngồi ghế đẩu cao 6,5 dm (mặt bàn 9 dm → mắt cao hơn mặt bàn ~4,4 dm)
const LEAN_MAX = 2.6 // cúi người về phía bàn tối đa (dm)
const FOV_MIN = 22
const FOV_MAX = 62

/** Ghế để ngồi: tâm mặt ghế và hướng về phía bàn (đã chuẩn hoá trên mặt phẳng XZ). */
export interface Seat { x: number; z: number; dirX: number; dirZ: number }

export interface FreeWalk {
  readonly position: THREE.Vector3
  readonly fly: boolean
  /** Hướng nhìn (độ, 0 = +Z, quay ngược chiều kim đồng hồ khi nhìn từ trên). */
  readonly yawDeg: number
  /** Ghế đang ngồi (null = đang đứng). */
  readonly seated: Seat | null
  setEnabled(on: boolean): void
  setFly(on: boolean): void
  teleport(p: Pose): void
  /** Ngồi vào ghế (mắt hạ thấp sát bàn, W/S cúi gần/ngả ra) – `null` = đứng dậy. */
  sit(seat: Seat | null): void
  frame(dt: number): void
}

/**
 * Đi bộ góc nhìn thứ nhất theo cách của kit (history/walk.ts): kéo chuột trên chỗ trống để nhìn quanh (OrbitControls có tâm quay sát mắt),
 * W A S D đi/bước ngang, mũi tên trái/phải quay, Shift chạy, nút ▲▼◀▶ cho cảm ứng. Không khóa con trỏ để các cử chỉ kéo thả của kit dùng được.
 */
export function createFreeWalk(ctx: SimContext, o: { colliders: readonly Box2[]; spawn: Pose }): FreeWalk {
  const cam = ctx.camera
  const ctl = ctx.controls
  const held = new Set<string>()
  const pos = new THREE.Vector3(o.spawn.x, ROOM.eyeY, o.spawn.z)
  const dir = new THREE.Vector3(0, 0, 1)
  let enabled = true
  let fly = false
  let run = false
  let bobT = 0
  let seat: Seat | null = null
  let lean = 0
  /** Chuyển tư thế ngồi/đứng mượt: mắt đi từ `from` tới vị trí đích trong ~0,6 s. */
  let blend = 1
  const from = new THREE.Vector3()
  let fov = cam.fov

  Object.assign(ctl, { enableZoom: false, enablePan: false, minDistance: LOOK, maxDistance: LOOK, minPolarAngle: 0.08, maxPolarAngle: Math.PI - 0.08, rotateSpeed: 0.45 })

  const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
  const down = (e: KeyboardEvent) => {
    run = e.shiftKey
    const k = KEYS[e.code]
    if (!k || typing(e)) return
    e.preventDefault()
    held.add(k)
  }
  const up = (e: KeyboardEvent) => {
    run = e.shiftKey
    const k = KEYS[e.code]
    if (k) held.delete(k)
  }
  const blur = () => held.clear()
  const escape = (e: KeyboardEvent) => {
    if (e.code !== 'Escape' || !seat || typing(e)) return
    e.preventDefault()
    sit(null)
  }
  // Con lăn: phóng to/thu nhỏ (đổi góc nhìn) để quan sát kỹ hiện tượng – đứng hay ngồi đều dùng được.
  const canvas = ctx.renderer.domElement
  const wheel = (e: WheelEvent) => {
    e.preventDefault()
    fov = THREE.MathUtils.clamp(fov * Math.exp(e.deltaY * 0.0012), FOV_MIN, FOV_MAX)
  }
  window.addEventListener('keydown', down)
  window.addEventListener('keydown', escape)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  canvas.addEventListener('wheel', wheel, { passive: false })
  ctx.track(() => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keydown', escape)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
    canvas.removeEventListener('wheel', wheel)
  })

  // Nút cảm ứng (giữ để đi).
  const pad = document.createElement('div')
  pad.className = 'pointer-events-auto absolute bottom-24 left-4 grid grid-cols-3 gap-1 select-none'
  const buttons: [string, string, string, string][] = [
    ['fwd', '▲', 'col-start-2', 'Đi tới'], ['turnL', '◀', 'col-start-1 row-start-2', 'Quay trái'],
    ['back', '▼', 'col-start-2 row-start-2', 'Lùi'], ['turnR', '▶', 'col-start-3 row-start-2', 'Quay phải'],
  ]
  for (const [k, ch, place, tip] of buttons) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `${place} h-11 w-11 rounded-lg bg-black/45 text-lg text-white shadow backdrop-blur active:bg-black/70`
    b.textContent = ch
    b.title = tip
    b.setAttribute('aria-label', tip)
    const on = (e: PointerEvent) => {
      e.preventDefault()
      b.setPointerCapture(e.pointerId)
      held.add(k)
    }
    const off = () => held.delete(k)
    b.addEventListener('pointerdown', on)
    b.addEventListener('pointerup', off)
    b.addEventListener('pointercancel', off)
    b.addEventListener('lostpointercapture', off)
    pad.appendChild(b)
  }
  ctx.overlay.appendChild(pad)

  // Nút đứng dậy (hiện khi đang ngồi) + gợi ý.
  const standBtn = document.createElement('button')
  standBtn.type = 'button'
  standBtn.className = 'pointer-events-auto absolute bottom-24 left-1/2 -translate-x-1/2 hidden rounded-lg bg-black/55 px-4 py-2 text-sm text-white shadow backdrop-blur hover:bg-black/70'
  standBtn.textContent = 'Đứng dậy (Esc)'
  standBtn.addEventListener('click', () => sit(null))
  ctx.overlay.appendChild(standBtn)

  const eye = new THREE.Vector3()
  const apply = () => {
    // Mắt: chỗ đứng, hoặc chỗ ngồi; đang chuyển tư thế thì nội suy từ vị trí cũ.
    if (seat) seatEye(eye)
    else eye.copy(pos)
    if (blend < 1) {
      const e = blend * blend * (3 - 2 * blend)
      eye.lerpVectors(from, eye, e)
    }
    cam.position.copy(eye)
    ctl.target.copy(eye).addScaledVector(dir, LOOK)
    cam.lookAt(ctl.target)
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * 0.25
      cam.updateProjectionMatrix()
    }
  }
  const seatEye = (out: THREE.Vector3) => {
    const s = seat!
    // Ngồi hơi nhô về phía bàn; cúi người thì đầu vừa tiến vừa hạ.
    const d = 0.4 + lean
    return out.set(s.x + s.dirX * d, SEAT_EYE - lean * 0.5, s.z + s.dirZ * d)
  }
  function sit(s: Seat | null) {
    if (s === seat) return
    from.copy(pos)
    blend = 0
    held.clear()
    if (s) {
      seat = s
      lean = 0.8
      fly = false
      // Nhìn xuống mặt bàn trước mặt.
      const pitch = THREE.MathUtils.degToRad(-32)
      dir.set(s.dirX * Math.cos(pitch), Math.sin(pitch), s.dirZ * Math.cos(pitch)).normalize()
      ctx.caption('Đang ngồi · W/S: cúi sát / ngả ra · con lăn: phóng to · Esc: đứng dậy')
    } else if (seat) {
      // Đứng dậy lùi ra sau ghế.
      const back = seat
      seat = null
      pos.set(back.x - back.dirX * 4.2, ROOM.eyeY, back.z - back.dirZ * 4.2)
      ;[pos.x, pos.z] = resolveCollisions(pos.x, pos.z, BODY_RADIUS, o.colliders)
      fov = FOV_MAX
      ctx.caption('Cầm chai/lọ rồi bấm vào ống nghiệm, cốc để rót · bấm ghế đẩu để ngồi xem gần')
    }
    standBtn.classList.toggle('hidden', !seat)
  }
  const teleport = (p: Pose) => {
    if (seat) {
      seat = null
      standBtn.classList.add('hidden')
    }
    blend = 1
    const yaw = THREE.MathUtils.degToRad(p.yawDeg)
    const pitch = THREE.MathUtils.degToRad(p.pitchDeg ?? 0)
    dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).normalize()
    pos.set(p.x, p.y ?? ROOM.eyeY, p.z)
    if (p.y !== undefined && p.y !== ROOM.eyeY) fly = true
    held.clear()
    apply()
    ctl.update()
  }
  teleport(o.spawn)

  const fwd = new THREE.Vector3()
  const right = new THREE.Vector3()
  const move = new THREE.Vector3()
  return {
    position: pos,
    get fly() {
      return fly
    },
    get yawDeg() {
      return THREE.MathUtils.radToDeg(Math.atan2(dir.x, dir.z))
    },
    get seated() {
      return seat
    },
    sit,
    setEnabled(on) {
      enabled = on
      if (!on) held.clear()
    },
    setFly(on) {
      if (seat) sit(null)
      fly = on
      if (!on) {
        pos.y = ROOM.eyeY
        ;[pos.x, pos.z] = resolveCollisions(pos.x, pos.z, BODY_RADIUS, o.colliders)
        apply()
      }
    },
    teleport,
    frame(dt) {
      // OrbitControls vừa xoay quanh tâm sát mắt: lấy hướng nhìn mới, rồi đặt lại mắt đúng chỗ đứng.
      dir.subVectors(ctl.target, cam.position)
      if (dir.lengthSq() < 1e-10) dir.set(0, 0, 1)
      dir.normalize()
      if (blend < 1) blend = Math.min(1, blend + dt / 0.6)
      if (seat) {
        // Ngồi: không đi; W/S cúi sát / ngả ra, mũi tên quay đầu.
        if (enabled && held.size) {
          const turn = (held.has('turnL') ? 1 : 0) - (held.has('turnR') ? 1 : 0)
          if (turn) dir.applyAxisAngle(THREE.Object3D.DEFAULT_UP, turn * TURN * dt)
          const l = (held.has('fwd') ? 1 : 0) - (held.has('back') ? 1 : 0)
          lean = THREE.MathUtils.clamp(lean + l * 2.2 * dt, 0, LEAN_MAX)
        }
        apply()
        return
      }
      let moving = false
      if (enabled && held.size) {
        const turn = (held.has('turnL') ? 1 : 0) - (held.has('turnR') ? 1 : 0)
        if (turn) dir.applyAxisAngle(THREE.Object3D.DEFAULT_UP, turn * TURN * dt)
        fwd.set(dir.x, 0, dir.z).normalize()
        right.set(-fwd.z, 0, fwd.x)
        move.set(0, 0, 0)
          .addScaledVector(fwd, (held.has('fwd') ? 1 : 0) - (held.has('back') ? 1 : 0))
          .addScaledVector(right, (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0))
        if (fly) move.y = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0)
        if (move.lengthSq() > 0) {
          moving = true
          move.normalize().multiplyScalar((fly ? FLY : run ? RUN : WALK) * dt)
          // Chia bước nhỏ để chạy nhanh/khung chậm không xuyên vật mỏng.
          const n = Math.max(1, Math.ceil(move.length() / (BODY_RADIUS * 0.4)))
          move.divideScalar(n)
          for (let i = 0; i < n; i++) {
            pos.add(move)
            if (!fly) [pos.x, pos.z] = resolveCollisions(pos.x, pos.z, BODY_RADIUS, o.colliders)
          }
        }
      }
      if (!fly) {
        bobT = moving ? bobT + dt * (run ? 2.6 : 2) : 0
        pos.y = ROOM.eyeY + (moving ? Math.sin(bobT * Math.PI * 2) * BOB : 0)
      }
      apply()
    },
  }
}
