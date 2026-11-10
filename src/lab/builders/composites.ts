import * as THREE from 'three'
import { createBunsenBurner, createErlenmeyer, createLiquid, createPaperSheet, createRetortStand, createTripodGauze, mm } from '../../vendor/lab3d/lab/index'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import { build, register } from './registry'
import { group } from './helpers'
import type { Socket } from './types'

/** Bộ chuẩn độ: giá đỡ cao kẹp buret, bình tam giác trên tấm giấy trắng ngay dưới đầu buret. */
function titrationSet(ctx: Tracker) {
  const reach = mm(150)
  const stand = createRetortStand(ctx, { rodHeight: mm(900), clampHeight: mm(620), reach, clampRadius: mm(9) })
  const burette = build(ctx, 'burette')
  burette.position.set(reach, mm(620) - mm(330), 0)
  const flask = createErlenmeyer(ctx, 250)
  const liquid = createLiquid(ctx, flask.profile, { volumeML: 40, color: 0xf5f7fa, opacity: 0.25 })
  flask.group.add(liquid.mesh)
  flask.group.position.set(reach, mm(1), 0)
  const tile = createPaperSheet(ctx, { width: mm(140), depth: mm(140) })
  tile.position.set(reach, 0, 0)
  return group('titrationSet', {
    kind: 'titrationSet', displayName: 'Bộ chuẩn độ', category: 'apparatus', grabbable: false, footprint: { w: mm(260), d: mm(160), h: mm(950) },
    params: { stand, burette, flask },
  }, stand.group, burette, flask.group, tile)
}

/** Bộ đun: đèn Bunsen (dây gas tới `hoseTo`), kiềng lưới phía trên, cốc 250 mL nước trên lưới. */
function heatingSet(ctx: Tracker, p: Record<string, unknown> = {}) {
  const burner = createBunsenBurner(ctx, { lit: false, hoseTo: p.hoseTo as THREE.Vector3 | undefined })
  const tripod = createTripodGauze(ctx)
  // Kiềng để trống: học sinh đặt cốc/bình/bát sứ của mình lên ổ `top` để đun.
  // Nhấc kiềng ra (bấm vào kiềng) thì ngọn lửa thành ổ `flame`: kẹp ống nghiệm, chén nung, bát sứ trực tiếp trên lửa.
  const top: Socket = { name: 'top', pos: [0, tripod.topY, 0], accepts: ['beaker100', 'beaker250', 'beaker500', 'erlenmeyer250', 'roundFlask', 'evaporatingDish'], radius: mm(40) }
  burner.group.updateMatrixWorld(true)
  const hot = burner.hot.getWorldPosition(new THREE.Vector3())
  const flame: Socket = { name: 'flame', pos: [hot.x, hot.y, hot.z], accepts: ['testTube', 'crucible', 'evaporatingDish'], radius: mm(30) }
  return group('heatingSet', {
    kind: 'heatingSet', displayName: 'Bộ đun nóng', category: 'apparatus', grabbable: false, footprint: { w: mm(200), d: mm(200), h: tripod.topY + mm(95) },
    sockets: [top],
    params: { burner, tripod, sockets: { top, flame }, tripodAside: new THREE.Vector3(-mm(260), 0, 0) },
  }, burner.group, tripod.group)
}

register('titrationSet', 'apparatus', titrationSet)
register('heatingSet', 'apparatus', heatingSet)
