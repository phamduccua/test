import * as THREE from 'three'
import { canvasTexture, makeCanvas } from '../vendor/lab3d/lab/materials/canvas'
import { tileTexture } from '../vendor/lab3d/lab/materials/textures'
import type { Tracker } from '../vendor/lab3d/lab/types'
import { brushedMap, grainMap, mottleTexture, woodTexture } from './textures/surface'

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
  g.strokeStyle = '#dcdcd8'
  g.lineWidth = 2
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
    case 'worktop':
      // Phenolic xám đen: vân loang mờ (ô 14 dm), hạt mịn trên độ nhám và bump (ô 1,5–2 dm) – mặt bàn bắt sáng loang, không bóng nhựa.
      mat = phys({
        map: ctx.track(mottleTexture('#2e3033', 0.06, 0.8, 14, 7)), roughness: 0.62, roughnessMap: ctx.track(grainMap(150, 45, 2, 5)),
        bumpMap: ctx.track(grainMap(128, 40, 3, 6)), bumpScale: 0.06, clearcoat: 0.12, clearcoatRoughness: 0.5,
      })
      break
    case 'cabinet': mat = std({ map: ctx.track(mottleTexture('#eceef0', 0.015, 0.15, 20, 11)), roughness: 0.55 }); break
    case 'cabinetFront': mat = phys({ map: ctx.track(mottleTexture('#f1f3f4', 0.012, 0.1, 20, 12)), roughness: 0.4, clearcoat: 0.2 }); break
    case 'handle': mat = std({ color: 0x9aa1a8, metalness: 0.8, roughness: 0.3 }); break
    case 'steel': mat = std({ color: 0xb8bec5, metalness: 0.85, roughness: 0.38, roughnessMap: ctx.track(brushedMap(3, 9)) }); break
    case 'chrome': mat = std({ color: 0xe8ecef, metalness: 1, roughness: 0.12 }); break
    case 'brass': mat = std({ color: 0xc9a24a, metalness: 1, roughness: 0.3 }); break
    case 'yellowPaint': mat = phys({ color: 0xf2c21b, roughness: 0.45, clearcoat: 0.3 }); break
    case 'safetyRed': mat = phys({ color: 0xd32f2f, roughness: 0.4, clearcoat: 0.4 }); break
    case 'safetyGreen': mat = phys({ color: 0x1f9d55, roughness: 0.5 }); break
    // Tường sơn: loang rất nhẹ (ô 40 dm); tự sáng nhẹ thay cho ánh hắt. (Bump hạt sơn không thấy ở tầm nhìn, chỉ lộ mối ô.)
    case 'wall':
      mat = std({
        map: ctx.track(mottleTexture('#f6f7f4', 0.018, 0, 40, 3)),
        roughness: 0.92, emissive: 0xf4f5f2, emissiveIntensity: 0.06,
      })
      break
    case 'floor': {
      // Sàn vinyl xám nhạt liền mặt (ảnh mẫu): ron gần như không thấy.
      const t = tileTexture('#c2c6ca', '#b9bdc1', 8, 0.015)
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
    case 'skirting': mat = std({ color: 0x464c53, roughness: 0.6 }); break
    case 'doorWood': mat = std({ color: 0xcfd3d6, roughness: 0.5 }); break
    case 'frame': mat = std({ color: 0xf4f5f5, roughness: 0.5 }); break
    case 'blind': mat = std({ color: 0xe6e0d4, roughness: 0.95, side: THREE.DoubleSide }); break
    case 'lightPanel': mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf4f8ff).multiplyScalar(2.2), toneMapped: false }); break
    case 'vent': mat = std({ color: 0xd4d7da, roughness: 0.6, emissive: 0xd4d7da, emissiveIntensity: 0.4 }); break
    case 'paper': mat = std({ color: 0xf4f1e8, roughness: 0.9 }); break
    case 'cork': mat = std({ color: 0xb98a5a, roughness: 0.95 }); break
    case 'whiteboard': mat = phys({ color: 0xfbfbfb, roughness: 0.25, clearcoat: 0.6 }); break
    case 'wood': mat = std({ map: ctx.track(woodTexture('#d4b07e', 4, 13)), roughness: 0.6 }); break
    case 'blackPlastic': mat = std({ color: 0x23262b, roughness: 0.5 }); break
    case 'rubberOrange': mat = std({ color: 0xe0782a, roughness: 0.6 }); break
    case 'fabric': mat = std({ color: 0xf6f6f2, roughness: 1, side: THREE.DoubleSide }); break
    case 'sinkSteel': mat = std({ color: 0xc4cad0, metalness: 0.9, roughness: 0.32, roughnessMap: ctx.track(brushedMap(2, 10)) }); break
    case 'striping': {
      const t = ctx.track(stripes())
      t.repeat.set(3, 3)
      mat = std({ map: t, roughness: 0.7 })
      break
    }
    case 'glassPane': mat = std({ color: 0xdfeaf2, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18, depthWrite: false }); break
    case 'hoodGlass': mat = phys({ color: 0xe8f0f4, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }); break
  }
  ctx.track(mat)
  m.set(key, mat)
  return mat
}
