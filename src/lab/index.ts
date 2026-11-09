import * as THREE from 'three'
import type { SimModule, Simulation } from '../vendor/lab3d/sim/types'
import { buildBlockout } from './blockout'
import { createDebugOverlay } from './debug'
import { LAYOUT, ROOM, SPAWN, VIEWPOINTS } from './layout'
import { createFreeWalk } from './walk'

export interface FreeLabOptions { mode?: 'play' | 'debug' }

/** Phòng thí nghiệm đi lại tự do (chặng 2: khối xám đúng tỉ lệ). */
export function createFreeLab(ctx: Parameters<SimModule['create']>[0], opts: FreeLabOptions = {}): Simulation {
  const { scene, camera } = ctx
  camera.fov = 62
  camera.near = 0.1
  camera.far = 400
  camera.updateProjectionMatrix()
  scene.background = new THREE.Color(0xdfe4ea)

  const room = buildBlockout(ctx, LAYOUT)
  scene.add(room.group)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1)
  const sun = new THREE.DirectionalLight(0xffffff, 1.4)
  sun.position.set(30, 60, 40)
  scene.add(hemi, sun)

  const walk = createFreeWalk(ctx, { colliders: room.colliders, spawn: SPAWN })
  const debug = createDebugOverlay(ctx, walk, opts.mode === 'debug')
  let labelsOn = opts.mode === 'debug'
  const showLabels = () => room.labels.forEach((l) => (l.visible = labelsOn))
  showLabels()
  let view = 0

  // Bảng phím ngắn, bấm để ẩn.
  const help = document.createElement('div')
  help.className = 'pointer-events-auto absolute right-4 top-16 max-w-xs cursor-pointer rounded-xl bg-black/55 px-4 py-3 text-sm leading-6 text-white shadow-lg backdrop-blur'
  help.innerHTML = '<b>Điều khiển</b><br>W A S D: đi · Shift: chạy<br>Kéo chuột chỗ trống: nhìn quanh<br>← →: quay · F5: điểm nhìn<br>F4: bay · F6: nhãn · F3: số liệu<br><span class="opacity-70">Bấm để ẩn</span>'
  help.addEventListener('click', () => help.remove())
  ctx.overlay.appendChild(help)

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'F3') debug.toggle()
    else if (e.code === 'F4') walk.setFly(!walk.fly)
    else if (e.code === 'F6') {
      labelsOn = !labelsOn
      showLabels()
    } else if (e.code === 'F5') {
      view = (view + 1) % VIEWPOINTS.length
      walk.setFly(false)
      walk.teleport(VIEWPOINTS[view]!.pose)
      ctx.caption(VIEWPOINTS[view]!.label)
    } else return
    e.preventDefault()
  }
  window.addEventListener('keydown', onKey)
  ctx.track(() => window.removeEventListener('keydown', onKey))
  ctx.caption('Phòng thí nghiệm Hóa học – đi lại để làm quen')
  if (import.meta.env.DEV) Object.assign(window, { __walk: walk, __viewpoints: VIEWPOINTS })

  return {
    update() {},
    frame(dt) {
      walk.frame(dt)
      room.ceiling.visible = walk.position.y < ROOM.height - 1
      debug.frame(dt)
    },
    reset() {
      walk.setFly(false)
      walk.teleport(SPAWN)
    },
  }
}

export const freeLabModule: SimModule = {
  meta: { id: 'freelab', title: 'Phòng thí nghiệm Hóa học', stage: 'lab' },
  create: (ctx) => createFreeLab(ctx, { mode: new URLSearchParams(location.search).get('mode') === 'debug' ? 'debug' : 'play' }),
}
