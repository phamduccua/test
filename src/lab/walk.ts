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

export interface FreeWalk {
  readonly position: THREE.Vector3
  readonly fly: boolean
  /** Hướng nhìn (độ, 0 = +Z, quay ngược chiều kim đồng hồ khi nhìn từ trên). */
  readonly yawDeg: number
  setEnabled(on: boolean): void
  setFly(on: boolean): void
  teleport(p: Pose): void
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
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  ctx.track(() => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
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

  const apply = () => {
    cam.position.copy(pos)
    ctl.target.copy(pos).addScaledVector(dir, LOOK)
    cam.lookAt(ctl.target)
  }
  const teleport = (p: Pose) => {
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
    setEnabled(on) {
      enabled = on
      if (!on) held.clear()
    },
    setFly(on) {
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
