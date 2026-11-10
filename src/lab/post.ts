import * as THREE from 'three'
import { N8AOPostPass } from 'n8ao'
import {
  BloomEffect, BrightnessContrastEffect, EffectComposer, EffectPass, HueSaturationEffect, RenderPass, SMAAEffect, SMAAPreset,
  ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from 'postprocessing'
import type { SimContext } from '../vendor/lab3d/sim/types'

export interface RoomPost {
  /** Tỉ lệ độ phân giải hiện tại (0,6…1) – tự hạ khi khung hình tụt, tự nâng khi dư. */
  readonly scale: number
  frame(dt: number): void
}

/**
 * Hậu kỳ phòng (thay createLabPost của kit để có AO):
 * render HDR → AO (N8AO; medium: nửa độ phân giải) → bloom ngưỡng cao (đèn trần, cửa sổ, ngọn lửa) → tone mapping Neutral
 * (giữ đúng màu dung dịch; ACES làm dung dịch ngả xám/tím) → tương phản/bão hoà nhẹ → vignette → SMAA.
 * 'low' → không hậu kỳ.
 *
 * Độ phân giải động: GPU tích hợp (Intel UHD) nghẽn ở số điểm ảnh phải tô – giảm độ phân giải là cách rẻ nhất giữ ≥ 30 khung/s.
 * Đo khung hình mỗi 1,5 s: < 28 → hạ 0,1; > 50 → nâng 0,05 (tối đa = pixelRatio gốc, tối thiểu 0,6 lần).
 */
export function createRoomPost(ctx: SimContext): RoomPost | null {
  const { renderer, scene, camera } = ctx
  const base = renderer.getPixelRatio()
  // Kính của kit dùng transmission: three vẽ lại cả cảnh đục vào một render target. Nửa độ phân giải là đủ cho phần khúc xạ mờ.
  ;(renderer as THREE.WebGLRenderer & { transmissionResolutionScale?: number }).transmissionResolutionScale = 0.5
  let scale = 1
  const size = new THREE.Vector2()
  let composer: EffectComposer | null = null

  if (ctx.quality !== 'low') {
    const high = ctx.quality === 'high'
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
    renderer.getSize(size)
    composer.addPass(new RenderPass(scene, camera))
    // 1 đơn vị = 1 dm, phòng ~100 dm: bán kính AO 6 dm – tối mềm dưới kệ, gầm bàn, góc tường, chân tủ (như ảnh mẫu).
    const ao = new N8AOPostPass(scene, camera, size.x, size.y)
    Object.assign(ao.configuration, {
      aoRadius: 6, distanceFalloff: 1.0, intensity: 3.2, color: new THREE.Color(0x1a1c20), halfRes: !high, aoSamples: high ? 16 : 12,
      // Khử nhiễu mạnh: mặt tủ trắng phẳng rất lộ hạt AO.
      denoiseSamples: 8, denoiseRadius: 12,
    })
    composer.addPass(ao)
    if (import.meta.env.DEV) Object.assign(window, { __ao: ao, __composer: composer })
    composer.addPass(new EffectPass(camera,
      new BloomEffect({ mipmapBlur: true, intensity: 0.55, luminanceThreshold: 0.88, luminanceSmoothing: 0.1, radius: 0.6 }),
      new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      new BrightnessContrastEffect({ contrast: 0.08 }),
      new HueSaturationEffect({ saturation: 0.04 }),
      new VignetteEffect({ offset: 0.35, darkness: 0.22 }),
    ))
    composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })))
    ctx.track(composer)
    const c = composer
    ctx.setRenderHook({ render: (dt) => c.render(dt), setSize: (w, h) => c.setSize(w, h) })
  }

  const apply = (s: number) => {
    scale = s
    renderer.setPixelRatio(base * s)
    renderer.getSize(size)
    composer?.setSize(size.x, size.y)
  }
  let acc = 0
  let frames = 0
  // Nấc cao: luôn đủ độ phân giải (ưu tiên hình); nấc vừa/thấp: tự hạ khi khung hình tụt.
  const auto = ctx.quality !== 'high' && !new URLSearchParams(location.search).has('fixedres')
  return {
    get scale() {
      return scale
    },
    frame(dt) {
      if (!auto) return
      acc += dt
      frames++
      if (acc < 1.5) return
      const fps = frames / acc
      acc = 0
      frames = 0
      if (fps < 28 && scale > 0.6) apply(Math.max(0.6, +(scale - 0.1).toFixed(2)))
      else if (fps > 50 && scale < 1) apply(Math.min(1, +(scale + 0.05).toFixed(2)))
    },
  }
}
