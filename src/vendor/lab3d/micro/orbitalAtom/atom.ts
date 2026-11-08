import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { microMaterials } from '../materials';
import { createOrbitalAxes } from '../orbital/axes';
import { radiusEnclosing } from '../orbital/hydrogen';
import { createOrbitalModel, type OrbitalDisplay, type OrbitalModel } from '../orbital/orbitalModel';
import { rng, sampleDensity } from '../orbital/sampling';
import type { FillingModel } from '../orbitalDiagram/filling';
import { spinColor, SUB_COLORS } from '../orbitalDiagram/kit';
import { aoOpacity, shellRadius, slotColor, slotQN } from './occupancy';

export interface OccupiedAtomOptions {
  /** Bán kính hiển thị lớp K (đv cảnh). */
  r1?: number;
  resolution?: number;
  display?: OrbitalDisplay;
  /** Hiện mờ AO chưa có electron. */
  ghost?: boolean;
  /** Xác suất bao của mặt AO (mặc định 0,75 – thuỳ p tách rõ hơn mặt 90 %). */
  enclosed?: number;
}

interface Ao {
  model: OrbitalModel | null;
  op: number;
  goal: number;
  pulse: number;
  pts: Float32Array | null;
  dots: { sp: THREE.Sprite; goal: THREE.Vector3; t: number }[];
}

/**
 * Nguyên tử 3D đồng bộ với sơ đồ ô orbital: mỗi ô ↔ một AO thật (1s, 2s, 2px, 2py, 2pz, …) quanh hạt nhân, hiện theo
 * số electron trong ô (electron = chấm sáng màu spin nhảy trong vùng AO). `focus(slot)` làm nổi một AO, mờ các AO khác.
 * Mặt AO dựng lười, mỗi khung tối đa một AO. KHÔNG tự track → `ctx.track(() => atom.dispose())`.
 */
export function createOccupiedAtom(ctx: SimContext, fill: FillingModel, o: OccupiedAtomOptions = {}) {
  const r1 = o.r1 ?? 0.45;
  const kit = microMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'occupied-atom';
  const nucleus = new THREE.Mesh(kit.sphere('low'), kit.atom(0xff4a3d));
  nucleus.scale.setScalar(r1 * 0.13);
  const halo = new THREE.Sprite(kit.glow(0xff6a4a, 0.9));
  halo.scale.setScalar(r1 * 0.75);
  group.add(nucleus, halo);
  const axes = createOrbitalAxes(ctx, { length: shellRadius(4, r1) * 1.08, labels: true, small: true });
  group.add(axes.group);
  const tag = new THREE.Object3D();
  tag.position.set(0, -r1 * 0.32, 0);
  group.add(tag);
  const zLabel = ctx.labels.add(tag, '', { variant: 'small', color: '#ff9f8f' });
  let display: OrbitalDisplay = o.display ?? 'surface';
  let ghost = o.ghost ?? false;
  let focus: number | null = null;
  let emph: number | null = null;
  const aos: Ao[] = fill.slots.map(() => ({ model: null, op: 0, goal: 0, pulse: 0, pts: null, dots: [] }));
  const queue: number[] = [];

  const build = (i: number) => {
    const sl = fill.slots[i];
    const sub = fill.subs[sl.sub];
    const qn = slotQN(sub, sl.k);
    const c = new THREE.Color(slotColor(sub, sl.k, SUB_COLORS[sub.l]));
    const m = createOrbitalModel(qn, {
      unitsPerA0: shellRadius(qn.n, r1) / radiusEnclosing(qn.n, 0, 0.9),
      resolution: o.resolution ?? 44,
      outerPositive: true,
      enclosed: o.enclosed ?? 0.75,
      display,
      pos: c,
      neg: c.clone().offsetHSL(-0.06, 0, -0.22),
      opacity: 0.001,
      points: 9000,
    });
    group.add(m.group);
    aos[i].model = m;
    aos[i].pts = sampleDensity(m.field.grid, 400, rng(i * 31 + 3)).positions;
  };
  const want = (i: number) => fill.slots[i].spins.length > 0 || ghost || focus === i;

  const atom = {
    group,
    sync() {
      fill.slots.forEach((sl, i) => {
        const a = aos[i];
        if (!a.model && want(i) && !queue.includes(i)) queue.push(i);
        const f = focus === null ? 'none' : focus === i ? 'on' : 'off';
        const dim = f === 'none' && emph !== null && sl.sub !== emph ? 0.32 : 1;
        a.goal = aoOpacity(sl.spins.length, f, ghost, fill.subs[sl.sub].l) * dim;
        // Chấm electron theo spin trong ô.
        while (a.dots.length < sl.spins.length) {
          const sp = new THREE.Sprite(kit.glow(0xffffff, 1));
          sp.scale.setScalar(r1 * 0.32);
          group.add(sp);
          a.dots.push({ sp, goal: new THREE.Vector3(), t: 0 });
        }
        a.dots.forEach((d, k) => {
          d.sp.visible = k < sl.spins.length;
          if (d.sp.visible) d.sp.material = kit.glow(spinColor(sl.spins[k]), focus === null || focus === i ? 1 : 0.35);
        });
      });
    },
    setZ(Z: number) {
      zLabel.element.textContent = `+${Z}`;
    },
    focus(slot: number | null) {
      focus = slot;
      atom.sync();
    },
    /** Làm nổi một phân lớp (vd. phân lớp đang điền) khi không có AO nào được focus; null = như nhau. */
    emphasize(sub: number | null) {
      if (sub === emph) return;
      emph = sub;
      atom.sync();
    },
    pulse(slot: number) {
      aos[slot].pulse = 1;
    },
    setDisplay(d: OrbitalDisplay) {
      display = d;
      aos.forEach((a) => a.model?.setDisplay(d));
    },
    setGhost(v: boolean) {
      ghost = v;
      atom.sync();
    },
    setAxes(v: boolean) {
      axes.setVisible(v);
    },
    /** Còn AO đang chờ dựng. */
    get building() {
      return queue.length > 0;
    },
    update(dt: number) {
      const i = queue.shift();
      if (i !== undefined) build(i);
      aos.forEach((a) => {
        if (!a.model) return;
        a.pulse = Math.max(0, a.pulse - dt * 1.2);
        a.op += (a.goal - a.op) * Math.min(1, dt * 5);
        const op = a.op + a.pulse * 0.25;
        a.model.group.visible = op > 0.004;
        a.model.setOpacity(op);
        for (const d of a.dots) {
          if (!d.sp.visible || !a.pts) continue;
          d.t -= dt;
          if (d.t <= 0) {
            const k = Math.floor(Math.random() * (a.pts.length / 3)) * 3;
            d.goal.set(a.pts[k], a.pts[k + 1], a.pts[k + 2]);
            d.t = 0.14 + Math.random() * 0.22;
          }
          d.sp.position.lerp(d.goal, Math.min(1, dt * 10));
        }
      });
      halo.material.rotation += dt * 0.3;
    },
    dispose() {
      aos.forEach((a) => a.model?.dispose());
      axes.dispose();
      group.removeFromParent();
    },
  };
  return atom;
}
export type OccupiedAtom = ReturnType<typeof createOccupiedAtom>;
