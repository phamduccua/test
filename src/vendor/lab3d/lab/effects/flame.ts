import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';
import { FLAME_FRAG, FLAME_VERT } from './flameShader';

export interface FlameOptions {
  /** Chiều cao ngọn lửa (đơn vị cảnh), mặc định 40 mm. */
  height?: number;
  width?: number;
  /** 'alcohol' = xanh lam nhạt (đèn cồn), 'candle' = vàng cam. */
  kind?: 'alcohol' | 'candle';
  light?: boolean;
}

export interface Flame {
  group: THREE.Group;
  light: THREE.PointLight | null;
  readonly lit: boolean;
  /** Châm (alpha tăng dần ~0,3 s) / tắt (co lại). */
  setLit(on: boolean): void;
  update(dt: number, elapsed?: number): void;
}

const PALETTE = {
  alcohol: { base: 0x1f3fff, mid: 0x6a5cff, tip: 0xff9a3a, core: 0x2a6bff, light: 0xffb070 },
  candle: { base: 0x4060ff, mid: 0xffa040, tip: 0xffe7a0, core: 0x80a0ff, light: 0xffa050 },
};

function teardrop(width: number, height: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = width * Math.sin(Math.min(1, t / 0.22) * Math.PI * 0.5) * Math.pow(1 - t, 0.75);
    pts.push(new THREE.Vector2(Math.max(r, i === N ? 0 : 1e-4), t * height));
  }
  return new THREE.LatheGeometry(pts, 32);
}

/** Ngọn lửa shader (2 lớp lồng nhau, additive) + PointLight nhấp nháy. Gốc ở chân lửa. */
export function createFlame(ctx: Tracker, o: FlameOptions = {}): Flame {
  const H = o.height ?? mm(40);
  const W = o.width ?? mm(6.5);
  const pal = PALETTE[o.kind ?? 'alcohol'];
  const group = new THREE.Group();
  group.name = 'flame';
  const layer = (w: number, h: number, base: number, mid: number, tip: number, alpha: number, sway: number) => {
    const mat = ctx.track(
      new THREE.ShaderMaterial({
        vertexShader: FLAME_VERT,
        fragmentShader: FLAME_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uHeight: { value: h },
          uSway: { value: sway },
          uIntensity: { value: 1 },
          uAlpha: { value: alpha },
          uBase: { value: new THREE.Color(base) },
          uMid: { value: new THREE.Color(mid) },
          uTip: { value: new THREE.Color(tip) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const mesh = new THREE.Mesh(teardrop(w, h), mat);
    mesh.renderOrder = 10;
    group.add(mesh);
    return mat;
  };
  const mats = [
    layer(W, H, pal.base, pal.mid, pal.tip, 0.42, W * 0.6),
    layer(W * 0.5, H * 0.38, pal.core, pal.core, pal.mid, 0.55, W * 0.2),
  ];
  let light: THREE.PointLight | null = null;
  if (o.light !== false) {
    light = new THREE.PointLight(pal.light, 0, 12, 2);
    light.position.y = H * 0.5;
    group.add(light);
  }
  let target = 1;
  let level = 1;
  const api: Flame = {
    group,
    light,
    get lit() {
      return target > 0;
    },
    setLit(on) {
      target = on ? 1 : 0;
    },
    update(dt, elapsed = 0) {
      const speed = target > level ? 3.5 : 5;
      level += Math.sign(target - level) * Math.min(Math.abs(target - level), speed * dt);
      group.visible = level > 0.001;
      const s = 0.25 + 0.75 * level;
      group.scale.set(s, s, s);
      for (const m of mats) {
        m.uniforms.uTime.value = elapsed;
        m.uniforms.uIntensity.value = level;
      }
      if (light) {
        const fl = 1 + 0.15 * Math.sin(elapsed * 13.7) * Math.sin(elapsed * 5.3 + 1.3);
        light.intensity = 1.6 * level * fl;
      }
    },
  };
  return api;
}
