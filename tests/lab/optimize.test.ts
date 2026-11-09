import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { optimizeObject, releaseMovable } from '../../src/lab/optimize'

const ctx = { track: <T,>(o: T) => o }
const white = new THREE.MeshStandardMaterial({ color: 0xffffff })
const metal = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 1 })
const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })

function cabinet() {
  const root = new THREE.Group()
  root.userData.meta = { kind: 'wallBench', movables: [{ node: 'door_a' }, { node: 'door_b' }] }
  const box = () => new THREE.BoxGeometry(1, 1, 1)
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(box(), white)
    m.position.set(i, 0, 0)
    root.add(m)
  }
  for (const name of ['door_a', 'door_b']) {
    const n = new THREE.Group()
    n.name = name
    n.position.set(name === 'door_a' ? 0 : 3, 0, 1)
    n.add(new THREE.Mesh(box(), white), new THREE.Mesh(box(), metal), new THREE.Mesh(box(), glass))
    root.add(n)
  }
  // Đồ bày (có instanceId) không được đụng tới.
  const bottle = new THREE.Group()
  bottle.userData = { meta: { kind: 'reagentBottle' }, instanceId: 'b1' }
  bottle.add(new THREE.Mesh(box(), white), new THREE.Mesh(box(), white))
  root.add(bottle)
  root.updateMatrixWorld(true)
  return { root, bottle }
}
const visibleMeshes = (o: THREE.Object3D) => {
  let n = 0
  const walk = (x: THREE.Object3D) => {
    if (!x.visible) return
    if ((x as THREE.Mesh).isMesh) n++
    x.children.forEach(walk)
  }
  walk(o)
  return n
}

describe('gộp mesh', () => {
  it('tĩnh gộp theo vật liệu, cánh tủ gộp chung, đồ bày giữ nguyên', () => {
    const { root, bottle } = cabinet()
    expect(visibleMeshes(root)).toBe(4 + 6 + 2)
    optimizeObject(ctx, root)
    // tĩnh: 1 · cánh đóng: 1 mesh màu đỉnh + 1 mesh kính · chai: 2
    expect(visibleMeshes(root)).toBe(1 + 2 + 2)
    expect(bottle.children).toHaveLength(2)
  })
  it('tách một cánh để mở, cánh còn lại vẫn gộp', () => {
    const { root } = cabinet()
    optimizeObject(ctx, root)
    const door = releaseMovable(root, 'door_a')!
    expect(door.visible).toBe(true)
    expect(visibleMeshes(door)).toBe(3)
    expect(visibleMeshes(root)).toBe(1 + 3 + 2 + 2)
    // Vị trí giữ đúng: hộp gộp của door_b nằm quanh x = 3.
    const merged = (root.userData.movablesMeshes as THREE.Mesh[]).find((m) => m.name === 'merged:vertexColor')!
    merged.geometry.computeBoundingBox()
    expect(merged.geometry.boundingBox!.min.x).toBeCloseTo(2.5)
    expect(merged.geometry.boundingBox!.max.x).toBeCloseTo(3.5)
  })
})
