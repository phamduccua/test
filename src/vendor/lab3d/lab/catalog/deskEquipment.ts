import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { createHand, type Hand, type HandOptions } from '../desk/hand';
import { createCable, sagPoints, type CableKind } from '../desk/cable';
import { createDeskCalendar } from '../desk/calendar';
import { createClock } from '../desk/clock';
import { createLabNotebook } from '../desk/notebook';
import { createPen } from '../desk/pen';
import { createSticker } from '../desk/sticker';
import { createDeskTimer } from '../desk/timer';
import { createDeliveryTube } from '../glassware/deliveryTube';
import { labMaterials } from '../materials/kit';
import { mm } from '../units';
import type { EquipmentEntry } from './equipment';
import { labText } from '../../text';

/** Nhóm "Bàn tay & đồ để bàn" của EQUIPMENT (tách file cho gọn; equipment.ts gộp vào cuối danh mục). */
/** Vật mẫu đặt vào neo (thấy tay ôm/kẹp đúng chỗ): que Ø 2r dọc x ở neo grip, lam kính ở neo pinch. */
const prop = (ctx: SimContext, h: Hand, o: HandOptions) => {
  const m = labMaterials(ctx);
  if (o.pose === 'grip') {
    const r = mm(o.grip ?? 10);
    const rod = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(r, r, mm(150), 20).rotateZ(Math.PI / 2)), m.plastic('orange'));
    h.anchors.grip.add(rod);
  }
  if (o.pose === 'pinch') {
    const slide = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(mm(76), mm(26), mm(o.width ?? 2))), m.clearPlastic());
    h.anchors.pinch.add(slide);
  }
};
const hand = (o: HandOptions, turn = 0) => (ctx: SimContext) => {
  const g = new THREE.Group();
  const h = createHand(ctx, { arm: 60, origin: 'wrist', ...o });
  prop(ctx, h, o);
  h.group.rotation.y = turn;
  g.add(h.group);
  return g;
};

/** Dây võng giữa hai đầu cách nhau ~0,9 đv, một đầu nhấc cao (như cắm vào máy). */
const cable = (kind: CableKind) => (ctx: SimContext) => {
  const c = createCable(ctx, sagPoints(new THREE.Vector3(-0.45, 0.35, 0), new THREE.Vector3(0.45, 0.03, 0.15), 0.4), { kind });
  if (kind === 'silicone') c.flow(1);
  return c.mesh;
};
const lying = (o: THREE.Object3D, r: number) => {
  o.rotation.z = -Math.PI / 2;
  o.position.y = r;
  const g = new THREE.Group();
  g.add(o);
  return g;
};

const d = (id: string, name: string, api: string, make: (ctx: SimContext) => THREE.Object3D): EquipmentEntry => ({ id, family: 'hand', name, api, make });

export const DESK_EQUIPMENT: EquipmentEntry[] = [
  d('wall-clock', labText('t_9ffd0138b17c'), "createClock(ctx, { kind: 'wall', size: 220 })", (c) => {
    const k = createClock(c, { kind: 'wall', size: 220, label: labText('t_0329a7849009') });
    k.group.rotation.x = -0.25;
    return k.group;
  }),
  d('hand-open', labText('t_b455070fce56'), "createHand(ctx, { pose: 'open' })", hand({ pose: 'open' }, Math.PI)),
  d('hand-grip', labText('t_8b5a4ff9beef'), "createHand(ctx, { glove: 'nitrile', pose: 'grip', grip: 8 })", hand({ glove: 'nitrile', pose: 'grip', grip: 8 }, -1.1)),
  d('hand-pinch', labText('t_647f917e359d'), "createHand(ctx, { glove: 'latex', pose: 'pinch' })", hand({ glove: 'latex', pose: 'pinch', side: 'left' }, 0.6)),
  d('hand-point', labText('t_9caa6bc3883c'), "createHand(ctx, { pose: 'point' })", hand({ pose: 'point', sleeve: '#b4bcc4', arm: 110 }, -0.5)),
  d('desk-clock', labText('t_8051ff40f063'), "createClock(ctx, { kind: 'desk' })", (c) => createClock(c).group),
  d('desk-timer', labText('t_acf2140dc014'), "createDeskTimer(ctx, { title })", (c) => {
    const t = createDeskTimer(c, { title: labText('t_28c978c80f41') });
    t.setTime(2 * 3600 + 15 * 60 + 40, labText('t_3610a3cb3019'));
    return t.group;
  }),
  d('calendar', labText('t_452f4b886605'), "createDeskCalendar(ctx, { title }).set({ day, target })", (c) => {
    const k = createDeskCalendar(c, { title: labText('t_eaaef54680fe') });
    k.set({ day: 3.4, target: 2, warnAfter: 2, note: labText('t_c3c6a696a98f') });
    return k.group;
  }),
  d('cable', labText('t_3e5a5429f307'), "createCable(ctx, sagPoints(a, b, sag))", cable('cable')),
  d('gas-hose', labText('t_15057d93012d'), "createCable(ctx, pts, { kind: 'gas' })", cable('gas')),
  d('silicone-hose', labText('t_ba3dab43df88'), "createCable(ctx, pts, { kind: 'silicone' })", cable('silicone')),
  d('delivery-tube', labText('t_4b04ae89f6f7'), 'createDeliveryTube(ctx, points)', (c) =>
    createDeliveryTube(c, [new THREE.Vector3(-0.3, 0.05, 0), new THREE.Vector3(-0.3, 0.5, 0), new THREE.Vector3(-0.22, 0.62, 0), new THREE.Vector3(0.22, 0.62, 0), new THREE.Vector3(0.3, 0.5, 0), new THREE.Vector3(0.3, 0.1, 0)]).group),
  d('marker', labText('t_a4267e26656f'), "createPen(ctx, { color, capped })", (c) => lying(createPen(c, { color: 'red' }).group, mm(7.5))),
  d('sticker', labText('t_cb8aa9fa6f94'), "createSticker(ctx, { text, sub, round })", (c) => {
    const g = new THREE.Group();
    const a = createSticker(c, { text: labText('t_7b30395bef21'), sub: '37 °C', width: 40, height: 20 });
    const b = createSticker(c, { text: 'A', round: true, color: 'green' });
    a.mesh.position.x = -mm(24);
    b.mesh.position.x = mm(24);
    g.add(a.mesh, b.mesh);
    return g;
  }),
  d('notebook', labText('t_39f7eb610d69'), "createLabNotebook(ctx, { title }).redraw(draw)", (c) => {
    const n = createLabNotebook(c, { title: labText('t_69fd7bc80776') });
    n.redraw((g) => {
      g.fillStyle = '#1f3f8f';
      g.font = '32px system-ui, sans-serif';
      [labText('t_414dd4fcf9ff'), labText('t_a8e7491330a7'), labText('t_634fcc1bb414')].forEach((t, i) => g.fillText(t, 104, 205 + i * 46));
    });
    return n.group;
  }),
];
