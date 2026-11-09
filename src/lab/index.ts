import * as THREE from 'three'
import type { SimModule, Simulation } from '../vendor/lab3d/sim/types'
import { buildBlockout } from './blockout'
import { buildRoom } from './room/roomBuilder'
import { createRoomLighting, prepareMaterialLook, tuneShadowCasters } from './lighting'
import { createRoomPost } from './post'
import { createShowroom } from './showroom'
import { createDebugOverlay } from './debug'
import { COMPARE_VIEWS } from './cameraPresets'
import { LAYOUT, ROOM, SPAWN, VIEWPOINTS } from './layout'
import { createFreeWalk } from './walk'
import { createInteraction, type Interaction } from './interact/index'
import { labEvents } from './events'
import { labApi } from './api'

export interface FreeLabOptions { mode?: 'play' | 'debug' | 'blockout' | 'showroom'; batch?: string }

/** Phòng thí nghiệm đi lại tự do (chặng 2: khối xám đúng tỉ lệ). */
export function createFreeLab(ctx: Parameters<SimModule['create']>[0], opts: FreeLabOptions = {}): Simulation {
  if (opts.mode === 'showroom') return createShowroom(ctx, opts.batch ?? 'glassware')
  const { scene, camera } = ctx
  camera.fov = 62
  camera.near = 0.1
  camera.far = 400
  camera.updateProjectionMatrix()
  const blockout = opts.mode === 'blockout'
  if (!blockout) prepareMaterialLook(ctx)
  // ?mode=blockout: khối xám chặng 2; mặc định: phòng dựng đầy đủ.
  const room = blockout ? { ...buildBlockout(ctx, LAYOUT), placed: null } : { ...buildRoom(ctx, LAYOUT), labels: [] as THREE.Object3D[] }
  scene.add(room.group)
  let lighting: { invalidateShadows(): void } | null = null
  if (blockout) {
    scene.background = new THREE.Color(0xdfe4ea)
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1)
    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(30, 60, 40)
    scene.add(hemi, sun)
  } else {
    tuneShadowCasters(room.group)
    lighting = createRoomLighting(ctx)
    createRoomPost(ctx)
  }

  const walk = createFreeWalk(ctx, { colliders: room.colliders, spawn: SPAWN })
  const debug = createDebugOverlay(ctx, walk, opts.mode === 'debug')
  const ix: Interaction | null = room.placed ? createInteraction(ctx, room as Parameters<typeof createInteraction>[1], walk, lighting) : null
  let labelsOn = opts.mode === 'debug'
  const showLabels = () => room.labels.forEach((l) => (l.visible = labelsOn))
  showLabels()
  // F5: điểm nhìn chung + góc đối chiếu ảnh mẫu.
  const views = [...VIEWPOINTS, ...COMPARE_VIEWS]
  let view = 0

  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'F3') debug.toggle()
    else if (e.code === 'F4') walk.setFly(!walk.fly)
    else if (e.code === 'F6') {
      labelsOn = !labelsOn
      showLabels()
    } else if (e.code === 'F5') {
      view = (view + 1) % views.length
      walk.setFly(false)
      walk.teleport(views[view]!.pose)
      ctx.caption(views[view]!.label)
    } else return
    e.preventDefault()
  }
  window.addEventListener('keydown', onKey)
  ctx.track(() => window.removeEventListener('keydown', onKey))
  ctx.caption('Bấm vào chai, cốc, ống nghiệm để cầm lên · giữ chuột để xem nhãn')
  labApi.resetView = () => {
    walk.setFly(false)
    walk.teleport(SPAWN)
  }
  labApi.resetAll = () => ix?.resetAll()
  if (import.meta.env.DEV) Object.assign(window, { __walk: walk, __viewpoints: views, __room: room, __lighting: lighting, __ix: ix, __labEvents: labEvents })

  return {
    update() {},
    frame(dt) {
      walk.frame(dt)
      ix?.frame(dt)
      room.ceiling.visible = walk.position.y < ROOM.height - 1
      debug.frame(dt)
    },
    reset() {
      ix?.resetAll()
      walk.setFly(false)
      walk.teleport(SPAWN)
    },
  }
}

export const freeLabModule: SimModule = {
  meta: { id: 'freelab', title: 'Phòng thí nghiệm Hóa học', stage: 'lab' },
  create: (ctx) => {
    const q = new URLSearchParams(location.search)
    const mode = q.get('mode')
    return createFreeLab(ctx, { mode: mode === 'debug' || mode === 'blockout' || mode === 'showroom' ? mode : 'play', batch: q.get('batch') ?? undefined })
  },
}
