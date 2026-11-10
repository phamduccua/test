import * as THREE from 'three'
import type { SimModule, Simulation } from '../vendor/lab3d/sim/types'
import { buildBlockout } from './blockout'
import { setLodDistances } from './lod'
import { buildRoom } from './room/roomBuilder'
import { createRoomLighting, maxAnisotropy, prepareMaterialLook, tuneShadowCasters, type RoomLighting } from './lighting'
import { createRoomPost } from './post'
import { createShowroom } from './showroom'
import { createDebugOverlay } from './debug'
import { COMPARE_VIEWS } from './cameraPresets'
import { LAYOUT, ROOM, SPAWN, VIEWPOINTS } from './layout'
import { createFreeWalk } from './walk'
import { createInteraction, type Interaction } from './interact/index'
import { labEvents } from './events'
import { labApi } from './api'
import { createChemLab } from './chem/scene'

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
  if (ctx.quality === 'high') setLodDistances(20, 45)
  else setLodDistances(9, 25)
  if (!blockout) prepareMaterialLook(ctx)
  // ?mode=blockout: khối xám chặng 2; mặc định: phòng dựng đầy đủ.
  const room = blockout ? { ...buildBlockout(ctx, LAYOUT), placed: null } : { ...buildRoom(ctx, LAYOUT), labels: [] as THREE.Object3D[] }
  scene.add(room.group)
  let lighting: RoomLighting | null = null
  let post: ReturnType<typeof createRoomPost> = null
  if (blockout) {
    scene.background = new THREE.Color(0xdfe4ea)
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1)
    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(30, 60, 40)
    scene.add(hemi, sun)
  } else {
    tuneShadowCasters(room.group)
    const lit = createRoomLighting(ctx)
    lighting = lit
    post = createRoomPost(ctx)
    // Sau khung đầu (texture canvas đã lên GPU): chụp phòng làm môi trường, nâng lọc bất đẳng hướng cho mọi texture.
    requestAnimationFrame(() => {
      lit.bakeEnvironment()
      maxAnisotropy(scene, ctx.renderer, ctx.quality)
    })
  }

  const walk = createFreeWalk(ctx, { colliders: room.colliders, spawn: SPAWN })
  const debug = createDebugOverlay(ctx, walk, opts.mode === 'debug')
  const fullRoom = room.placed ? (room as Parameters<typeof createInteraction>[1]) : null
  const chem = fullRoom ? createChemLab(ctx, fullRoom) : null
  const ix: Interaction | null = fullRoom ? createInteraction(ctx, fullRoom, walk, lighting, chem!.hooks) : null
  if (ix) chem!.bind(ix)
  let labelsOn = opts.mode === 'debug'
  const showLabels = () => room.labels.forEach((l) => (l.visible = labelsOn))
  showLabels()
  // F5: điểm nhìn chung + góc đối chiếu ảnh mẫu.
  const views = [...VIEWPOINTS, ...COMPARE_VIEWS]
  const eye = new THREE.Vector3()
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
  ctx.caption('Cầm chai/lọ rồi bấm vào ống nghiệm, cốc để rót · bấm ghế đẩu để ngồi xem gần · con lăn: phóng to')
  labApi.resetView = () => {
    walk.setFly(false)
    walk.teleport(SPAWN)
  }
  labApi.resetAll = () => {
    ix?.resetAll()
    chem?.reset()
  }
  labApi.chem = chem
  if (import.meta.env.DEV) Object.assign(window, { __renderer: ctx.renderer, __camera: camera, __walk: walk, __viewpoints: views, __room: room, __lighting: lighting, __ix: ix, __labEvents: labEvents, __chem: chem })

  return {
    update(dt) {
      chem?.update(dt)
    },
    frame(dt) {
      walk.frame(dt)
      lighting?.frame(camera.getWorldPosition(eye))
      ix?.frame(dt)
      chem?.frame(dt)
      room.ceiling.visible = walk.position.y < ROOM.height - 1
      debug.frame(dt)
      post?.frame(dt)
    },
    reset() {
      ix?.resetAll()
      chem?.reset()
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
