import * as THREE from 'three';
import type { VesselProfile } from '../glassware/profile';
import { levelForVolume, radiusAt } from '../glassware/profile';
import { latheFromProfile, RENDER_ORDER } from '../glassware/vessel';
import type { P2, Tracker } from '../types';
import { fromML, mm } from '../units';
import { applyLiquidLook, createLiquidMaterial, type LiquidLook } from './liquidMaterial';
import { liquidInner, liquidShape } from './meniscus';

export interface LayerSpec {
  volumeML: number;
  color?: THREE.ColorRepresentation;
  /** Độ đậm 0…1. */
  opacity?: number;
  turbidity?: number;
}

export interface LiquidLayer {
  mesh: THREE.Mesh;
  readonly volumeML: number;
  /** Đổi màu mượt (smoothstep) trong `duration` giây. */
  setColor(color: THREE.ColorRepresentation, duration?: number, opacity?: number, turbidity?: number): void;
}

export interface LayeredLiquid {
  /** Nhóm chứa các lớp – thêm vào vessel.group. */
  group: THREE.Group;
  /** Các lớp từ dưới lên. */
  layers: LiquidLayer[];
  /** Mực mặt thoáng trên cùng (độ cao cục bộ). */
  readonly level: number;
  readonly totalML: number;
  /** Đặt lại thể tích từng lớp (cùng số lớp, dưới → trên); lớp 0 mL thì ẩn. */
  setVolumes(ml: number[]): void;
  update(dt: number): void;
}

/** Profile kín cho một dải chất lỏng giữa y0 và y1 (dải trên cùng có mặt khum). */
function bandShape(inner: P2[], y0: number, y1: number, top: boolean, meniscus: number): P2[] | null {
  if (y1 - y0 < mm(0.2)) return null;
  const bottom = inner[0].y;
  if (top) {
    const s = liquidShape(inner, y1, meniscus);
    if (!s) return null;
    if (y0 <= bottom + mm(0.05)) return s.points;
    return [{ r: 0, y: y0 }, { r: radiusAt(inner, y0), y: y0 }, ...s.points.filter((p) => p.y > y0)];
  }
  const pts: P2[] = y0 <= bottom + mm(0.05) ? [] : [{ r: 0, y: y0 }, { r: radiusAt(inner, y0), y: y0 }];
  const lo = pts.length ? y0 : -Infinity;
  for (const p of inner) if (p.y > lo && p.y < y1) pts.push(p);
  pts.push({ r: radiusAt(inner, y1), y: y1 }, { r: 0, y: y1 });
  return pts;
}

/**
 * Chất lỏng nhiều lớp xếp chồng trong một dụng cụ tròn xoay (vd. lớp hexane nổi trên nước, hay
 * dải màu loang từ mặt thoáng xuống). Mỗi lớp một vật liệu transmission riêng, đổi màu mượt.
 */
export function createLayeredLiquid(
  ctx: Tracker,
  profile: VesselProfile,
  specs: LayerSpec[],
  o: { meniscus?: number } = {},
): LayeredLiquid {
  const inner = liquidInner(profile.inner);
  const meniscus = o.meniscus ?? mm(2.5);
  const group = new THREE.Group();
  group.name = 'layered-liquid';
  const vols = specs.map((s) => s.volumeML);
  let level = inner[0].y;

  const layers = specs.map((s, i) => {
    const mat = ctx.track(createLiquidMaterial(profile.maxRadius * 1.6));
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.renderOrder = RENDER_ORDER.liquid - (specs.length - i) * 0.01;
    mesh.name = `liquid-layer-${i}`;
    group.add(mesh);
    const look: LiquidLook = {
      color: new THREE.Color(s.color ?? 0xdff3ff),
      density: s.opacity ?? 0.1,
      turbidity: s.turbidity ?? 0,
      turbidColor: new THREE.Color(0xf4f4f0),
    };
    const from = { c: look.color.clone(), d: look.density, t: look.turbidity };
    const to = { c: look.color.clone(), d: look.density, t: look.turbidity };
    let k = 1;
    let dur = 0;
    applyLiquidLook(mat, look);
    const layer: LiquidLayer & { step(dt: number): void } = {
      mesh,
      get volumeML() {
        return vols[i];
      },
      setColor(color, duration = 0, opacity, turbidity) {
        from.c.copy(look.color);
        from.d = look.density;
        from.t = look.turbidity;
        to.c.set(color);
        to.d = opacity ?? look.density;
        to.t = turbidity ?? look.turbidity;
        dur = duration;
        k = duration > 0 ? 0 : 1;
        if (k >= 1) {
          look.color.copy(to.c);
          look.density = to.d;
          look.turbidity = to.t;
          applyLiquidLook(mat, look);
        }
      },
      step(dt) {
        if (k >= 1) return;
        k = Math.min(1, k + dt / dur);
        const e = k * k * (3 - 2 * k);
        look.color.copy(from.c).lerp(to.c, e);
        look.density = from.d + (to.d - from.d) * e;
        look.turbidity = from.t + (to.t - from.t) * e;
        applyLiquidLook(mat, look);
      },
    };
    return layer;
  });

  const rebuild = () => {
    const topIdx = vols.reduce((m, v, i) => (v > 0.001 ? i : m), -1);
    let cum = 0;
    let y0 = inner[0].y;
    layers.forEach((l, i) => {
      cum += Math.max(0, vols[i]);
      const y1 = vols[i] > 0.001 ? levelForVolume(inner, fromML(cum)) : y0;
      const pts = vols[i] > 0.001 ? bandShape(inner, y0, y1, i === topIdx, meniscus) : null;
      l.mesh.visible = !!pts;
      if (pts) {
        l.mesh.geometry.dispose();
        l.mesh.geometry = latheFromProfile(pts, 48);
      }
      y0 = y1;
    });
    level = y0;
  };
  rebuild();
  ctx.track(() => layers.forEach((l) => l.mesh.geometry.dispose()));

  return {
    group,
    layers,
    get level() {
      return level;
    },
    get totalML() {
      return vols.reduce((a, b) => a + b, 0);
    },
    setVolumes(ml) {
      ml.forEach((v, i) => i < vols.length && (vols[i] = v));
      rebuild();
    },
    update(dt) {
      for (const l of layers) l.step(dt);
    },
  };
}
