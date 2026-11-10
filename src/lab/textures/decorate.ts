import * as THREE from 'three'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import type { PlacedObject } from '../room/roomBuilder'
import { safetySignTexture, type SignType } from './draw'
import { boxFace, corrosiveLabel, flammableLabel, fumeSign, hazardPoster, periodicTable, rulesPoster, whiteboardContent } from './posters'

/** Phủ nội dung (vẽ canvas) lên các mặt đã đặt tên của đồ vật: biển báo, poster, bảng tuần hoàn, bảng trắng, nhãn tủ. */
export function decorateRoom(ctx: Tracker, placed: Map<string, PlacedObject>): void {
  const tex = new Map<string, THREE.Material>()
  const material = (key: string, make: () => THREE.Texture, glossy = false) => {
    let m = tex.get(key)
    if (!m) {
      const map = ctx.track(make())
      map.anisotropy = 8
      m = ctx.track(glossy ? new THREE.MeshPhysicalMaterial({ map, roughness: 0.22, clearcoat: 0.6 }) : new THREE.MeshStandardMaterial({ map, roughness: 0.75 }))
      tex.set(key, m)
    }
    return m
  }
  const setFace = (root: THREE.Object3D, name: string, m: THREE.Material) => {
    root.traverse((o) => {
      if (o.name === name && (o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = m
    })
  }
  const posters: Record<string, () => THREE.Texture> = { poster_hazard: hazardPoster, poster_rules: rulesPoster, poster_periodic: periodicTable }
  for (const [id, p] of placed) {
    const kind = p.meta.kind
    if (posters[id]) setFace(p.group, 'posterFace', material(id, posters[id]!))
    else if (kind === 'whiteboard') setFace(p.group, 'boardFace', material('whiteboard', whiteboardContent, true))
    else if (kind === 'safetySign') {
      const type = (p.meta.params?.type as SignType) ?? 'firstAid'
      setFace(p.group, 'signFace', material(`sign:${type}`, () => safetySignTexture(type)))
    } else if (kind === 'firstAidBox') setFace(p.group, 'signFace', material('box:firstAid', () => boxFace('firstAid')))
    else if (kind === 'fireBlanketBox') setFace(p.group, 'signFace', material('box:fireBlanket', () => boxFace('fireBlanket')))
    else if (kind === 'fireExtinguisher') setFace(p.group, 'label', material('box:extinguisher', () => boxFace('extinguisher')))
    else if (kind === 'fumeCupboard') {
      setFace(p.group, 'signFace', material('fumeSign', fumeSign))
      setFace(p.group, 'label_acid', material('corrosive', corrosiveLabel))
    }
    else if (kind === 'flammablesCabinet') for (const n of ['label_L', 'label_R']) setFace(p.group, n, material('flammable', flammableLabel))
  }
}
