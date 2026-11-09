import type { SimContext } from '../vendor/lab3d/sim/types'
import type { FreeWalk } from './walk'

/** Ô số liệu gỡ lỗi góc dưới phải: FPS, draw call, tam giác, vị trí, hướng. Bật/tắt F3. */
export function createDebugOverlay(ctx: SimContext, walk: FreeWalk, visible: boolean) {
  const el = document.createElement('pre')
  el.className = 'pointer-events-none absolute bottom-2 right-2 m-0 rounded bg-black/60 px-2 py-1 font-mono text-[11px] leading-4 text-lime-300'
  el.hidden = !visible
  ctx.overlay.appendChild(el)
  let acc = 0
  let frames = 0
  let fps = 0
  return {
    toggle() {
      el.hidden = !el.hidden
    },
    frame(dt: number) {
      acc += dt
      frames++
      if (acc >= 0.5) {
        fps = frames / acc
        acc = 0
        frames = 0
      }
      if (el.hidden) return
      const r = ctx.renderer.info.render
      const p = walk.position
      el.textContent = `FPS ${fps.toFixed(0)}  calls ${r.calls}  tris ${(r.triangles / 1000).toFixed(1)}k\npos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} dm  yaw ${walk.yawDeg.toFixed(0)}°${walk.fly ? '  FLY' : ''}\nquality ${ctx.quality}`
    },
    get fps() {
      return fps
    },
  }
}
