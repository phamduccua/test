import * as THREE from 'three'
import type { SimContext, Simulation } from '../vendor/lab3d/sim/types'
import '../lab/room/roomBuilder'
import { build, listKinds } from './builders/registry'
import { metaOf, type Category } from './builders/types'
import { setOpen } from '../vendor/lab3d/ui/collapse'

const BATCHES: Record<string, Category[]> = {
  furniture: ['furniture'], fixtures: ['fixture'], safety: ['safety'], glassware: ['glassware'], apparatus: ['apparatus'], reagents: ['reagent'],
  all: ['furniture', 'fixture', 'safety', 'glassware', 'apparatus', 'reagent'],
}

/** Phòng trưng bày: xếp lưới mọi vật của một lô kèm tên, xoay quanh bằng chuột, phím [ ] nhảy giữa các vật. */
export function createShowroom(ctx: SimContext, batch: string): Simulation {
  const { scene, camera, controls } = ctx
  // Phòng trưng bày: hiện mọi nhãn (kit mặc định chỉ hiện nhãn gần con trỏ).
  setOpen('labels', true)
  document.querySelector('.labels-layer')?.classList.remove('is-quiet')
  scene.background = new THREE.Color(0xe3e7ec)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a96a3, 1.2))
  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(20, 40, 30)
  scene.add(sun)
  const cats = BATCHES[batch] ?? BATCHES.glassware!
  const items = listKinds().filter((e) => cats.includes(e.category)).flatMap((e) => (e.showroom ?? [undefined]).map((p) => ({ kind: e.kind, params: p })))
  const big = cats.includes('furniture') || cats.includes('fixture')
  // Xếp theo hàng dựa trên kích thước thật của từng vật (không chồng nhau).
  const built = items.map(({ kind, params }) => {
    const obj = build(ctx, kind, params)
    const box = new THREE.Box3().setFromObject(obj)
    return { obj, box, size: box.getSize(new THREE.Vector3()) }
  })
  const total = built.reduce((a, b) => a + b.size.x * b.size.z, 0)
  const rowWidth = Math.max(Math.sqrt(total) * 2.2, ...built.map((b) => b.size.x))
  const spots: THREE.Vector3[] = []
  let x = 0
  let z = 0
  let rowDepth = 0
  for (const { obj, box, size } of built) {
    const margin = Math.max(0.6, Math.max(size.x, size.z) * 0.35)
    if (x > 0 && x + size.x > rowWidth) {
      x = 0
      z += rowDepth
      rowDepth = 0
    }
    obj.position.set(x + size.x / 2 - (box.min.x + box.max.x) / 2, 0, z + size.z / 2 - (box.min.z + box.max.z) / 2)
    scene.add(obj)
    const cx = x + size.x / 2
    const cz = z + size.z / 2
    const anchor = new THREE.Object3D()
    anchor.position.set(cx, box.max.y + Math.max(0.3, size.y * 0.08), cz)
    scene.add(anchor)
    ctx.labels.add(anchor, metaOf(obj)?.displayName ?? obj.name)
    spots.push(new THREE.Vector3(cx, (box.max.y + box.min.y) / 2, cz))
    x += size.x + margin
    rowDepth = Math.max(rowDepth, size.z + margin)
  }
  const floor = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(400, 400)), ctx.track(new THREE.MeshStandardMaterial({ color: 0xd5dae0, roughness: 0.9 })))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.01
  scene.add(floor)
  const center = new THREE.Box3().setFromPoints(spots).getCenter(new THREE.Vector3())
  camera.near = 0.05
  camera.far = 2000
  camera.updateProjectionMatrix()
  ctx.frameTo(center, Math.max(rowWidth, z + rowDepth) * 1.15 + 2)
  controls.maxDistance = 1000
  let at = -1
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== '[' && e.key !== ']') return
    at = (at + (e.key === ']' ? 1 : spots.length - 1)) % spots.length
    ctx.frameTo(spots[at]!, big ? 25 : 3)
    ctx.caption(metaOf(built[at]!.obj)?.displayName ?? '')
  }
  window.addEventListener('keydown', onKey)
  ctx.track(() => window.removeEventListener('keydown', onKey))
  ctx.caption(`Phòng trưng bày: ${items.length} vật · kéo để xoay, cuộn để phóng · [ ] chuyển vật`)
  if (import.meta.env.DEV) Object.assign(window, { __showroom: { count: items.length, spots } })
  return { update() {} }
}
