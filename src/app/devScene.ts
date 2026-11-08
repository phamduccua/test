import * as THREE from 'three'
import { createBeaker, createLabStage, createLiquid } from '../vendor/lab3d/lab/index'
import { createHoverFx, pointerHub } from '../vendor/lab3d/interact/index'
import type { SimModule } from '../vendor/lab3d/sim/types'

/** Cảnh thử chặng 0: bàn + cốc 250 mL của kit có chất lỏng, bấm cốc nghe tiếng đặt thủy tinh. */
export const devScene: SimModule = {
  meta: { id: 'dev', title: 'Cảnh thử kit', stage: 'lab' },
  create(ctx) {
    createLabStage(ctx, { lighting: 'bench', benchWidth: 8, benchDepth: 4, shelf: false, viewDistance: 7 })
    const beaker = createBeaker(ctx, 250)
    const liquid = createLiquid(ctx, beaker.profile, { volumeML: 120, color: 0x3a7bd5, opacity: 0.55 })
    beaker.group.add(liquid.mesh)
    ctx.scene.add(beaker.group)
    ctx.frameTo(new THREE.Vector3(0, 0.6, 0), 4)

    const hover = createHoverFx(ctx, beaker.group, { lift: 0.05 })
    pointerHub(ctx).add({
      object: beaker.group,
      hint: 'Bấm để nghe tiếng',
      onHover: (s) => hover(s),
      onTap: () => {
        ctx.audio.sfx('lab/glass-put', { at: beaker.group })
        ctx.caption('Đã bấm cốc 250 mL')
      },
    })
    ctx.caption('Cảnh thử: kéo chuột để xoay, bấm vào cốc')
    const params = { mL: 120 }
    ctx.gui.add(params, 'mL', 0, 220, 1).name('Thể tích (mL)').onChange((v: number) => liquid.setVolume(v))
    return { update: (dt) => liquid.update(dt) }
  },
}
