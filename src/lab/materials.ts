import * as THREE from 'three'
import { canvasTexture, makeCanvas } from '../vendor/lab3d/lab/materials/canvas'
import { tileTexture } from '../vendor/lab3d/lab/materials/textures'
import type { Tracker } from '../vendor/lab3d/lab/types'

/** Vật liệu riêng của phòng (kit chưa có): mặt bàn phenolic, thân tủ, đồng thau, sơn an toàn, tường, sàn, trần. */
export type RoomMaterialKey =
  | 'worktop' | 'cabinet' | 'cabinetFront' | 'handle' | 'steel' | 'chrome' | 'brass' | 'yellowPaint' | 'safetyRed' | 'safetyGreen'
  | 'wall' | 'floor' | 'ceiling' | 'skirting' | 'doorWood' | 'frame' | 'blind' | 'lightPanel' | 'vent' | 'paper' | 'cork'
  | 'whiteboard' | 'wood' | 'blackPlastic' | 'rubberOrange' | 'fabric' | 'sinkSteel' | 'striping' | 'glassPane' | 'hoodGlass'

const cache = new WeakMap<Tracker, Map<string, THREE.Material>>()

function stripes(): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(256, 256)
  g.fillStyle = '#f2c21b'
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#1e1e1e'
  for (let i = -256; i < 512; i += 64) {
    g.beginPath()
    g.moveTo(i, 0)
    g.lineTo(i + 32, 0)
    g.lineTo(i + 32 + 256, 256)
    g.lineTo(i + 256, 256)
    g.fill()
  }
  const t = canvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function ceilingTile(): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(256, 256)
  g.fillStyle = '#f1f1ee'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(120,120,110,${0.05 + Math.random() * 0.12})`
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5)
  }
  g.strokeStyle = '#c9cac6'
  g.lineWidth = 4
  g.strokeRect(0, 0, 256, 256)
  const t = canvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export function roomMaterial(ctx: Tracker, key: RoomMaterialKey): THREE.Material {
  let m = cache.get(ctx)
  if (!m) cache.set(ctx, (m = new Map()))
  const hit = m.get(key)
  if (hit) return hit
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)
  const phys = (o: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(o)
  let mat: THREE.Material
  switch (key) {
    case 'worktop': mat = phys({ color: 0x1d1f22, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.35 }); break
    case 'cabinet': mat = std({ color: 0xe9ecee, roughness: 0.55 }); break
    case 'cabinetFront': mat = phys({ color: 0xf1f3f4, roughness: 0.4, clearcoat: 0.2 }); break
    case 'handle': mat = std({ color: 0x9aa1a8, metalness: 0.8, roughness: 0.3 }); break
    case 'steel': mat = std({ color: 0xb8bec5, metalness: 0.85, roughness: 0.35 }); break
    case 'chrome': mat = std({ color: 0xe8ecef, metalness: 1, roughness: 0.12 }); break
    case 'brass': mat = std({ color: 0xc9a24a, metalness: 1, roughness: 0.3 }); break
    case 'yellowPaint': mat = phys({ color: 0xf2c21b, roughness: 0.45, clearcoat: 0.3 }); break
    case 'safetyRed': mat = phys({ color: 0xd32f2f, roughness: 0.4, clearcoat: 0.4 }); break
    case 'safetyGreen': mat = phys({ color: 0x1f9d55, roughness: 0.5 }); break
    case 'wall': mat = std({ color: 0xf1f2ee, roughness: 0.9, }); break
    case 'floor': {
      const t = tileTexture('#b4b9bf', '#9ea4ab', 8, 0.04)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(96 / 12, 84 / 12)
      mat = std({ map: ctx.track(t), roughness: 0.55 })
      break
    }
    case 'ceiling': {
      const t = ctx.track(ceilingTile())
      t.repeat.set(96 / 6, 84 / 6)
      // Trần tự sáng nhẹ: ánh đèn tấm hắt lên (đèn chính chiếu từ trên nên không rọi mặt dưới trần).
      mat = std({ map: t, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xd8d8d2, emissiveIntensity: 0.28 })
      break
    }
    case 'skirting': mat = std({ color: 0x5d6873, roughness: 0.6 }); break
    case 'doorWood': mat = std({ color: 0xcfd3d6, roughness: 0.5 }); break
    case 'frame': mat = std({ color: 0xf4f5f5, roughness: 0.5 }); break
    case 'blind': mat = std({ color: 0xe6e0d4, roughness: 0.95, side: THREE.DoubleSide }); break
    case 'lightPanel': mat = new THREE.MeshBasicMaterial({ color: 0xf4f8ff, toneMapped: false }); break
    case 'vent': mat = std({ color: 0xd4d7da, roughness: 0.6, emissive: 0xd4d7da, emissiveIntensity: 0.4 }); break
    case 'paper': mat = std({ color: 0xf4f1e8, roughness: 0.9 }); break
    case 'cork': mat = std({ color: 0xb98a5a, roughness: 0.95 }); break
    case 'whiteboard': mat = phys({ color: 0xfbfbfb, roughness: 0.25, clearcoat: 0.6 }); break
    case 'wood': mat = std({ color: 0xd9b98a, roughness: 0.6 }); break
    case 'blackPlastic': mat = std({ color: 0x23262b, roughness: 0.5 }); break
    case 'rubberOrange': mat = std({ color: 0xe0782a, roughness: 0.6 }); break
    case 'fabric': mat = std({ color: 0xf6f6f2, roughness: 1, side: THREE.DoubleSide }); break
    case 'sinkSteel': mat = std({ color: 0xc4cad0, metalness: 0.9, roughness: 0.28 }); break
    case 'striping': {
      const t = ctx.track(stripes())
      t.repeat.set(3, 3)
      mat = std({ map: t, roughness: 0.7 })
      break
    }
    case 'glassPane': mat = phys({ color: 0xdfeaf2, roughness: 0.05, transmission: 0.9, thickness: 0.05, transparent: true, opacity: 0.35 }); break
    case 'hoodGlass': mat = phys({ color: 0xe8f0f4, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }); break
  }
  ctx.track(mat)
  m.set(key, mat)
  return mat
}
