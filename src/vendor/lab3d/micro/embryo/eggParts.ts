import * as THREE from 'three';
import type { Tracker } from '../../lab/types';

/** Màu trứng ếch: cực động vật có sắc tố (nâu đen), cực thực vật nhiều noãn hoàng (kem). */
export const EGG_COLORS = { animal: '#3a281c', band: '#7a5a3c', vegetal: '#e6d8ad', dead: '#cfcabb' };

export interface EmbryoKit {
  /** Cầu đơn vị hai tông màu theo y (vertex color). */
  egg: THREE.BufferGeometry;
  sphere: THREE.SphereGeometry;
  capsule: THREE.CapsuleGeometry;
  ring: THREE.TorusGeometry;
  mat: THREE.MeshStandardMaterial;
  plain(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial;
}

/** Tô màu theo độ cao: trên sẫm, dưới kem, dải chuyển ở xích đạo hơi lệch về phía thực vật. */
export function paintEgg(geo: THREE.BufferGeometry, lowY = -0.25, highY = 0.18) {
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const a = new THREE.Color(EGG_COLORS.animal);
  const b = new THREE.Color(EGG_COLORS.band);
  const v = new THREE.Color(EGG_COLORS.vegetal);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / Math.max(1e-6, Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)));
    const k = THREE.MathUtils.smoothstep(y, lowY, highY);
    if (k > 0.5) c.copy(b).lerp(a, (k - 0.5) * 2);
    else c.copy(v).lerp(b, k * 2);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const cache = new WeakMap<Tracker, EmbryoKit>();

export function embryoKit(ctx: Tracker): EmbryoKit {
  let k = cache.get(ctx);
  if (k) return k;
  const plains = new Map<string, THREE.MeshStandardMaterial>();
  k = {
    egg: ctx.track(paintEgg(new THREE.SphereGeometry(1, 40, 28))),
    sphere: ctx.track(new THREE.SphereGeometry(1, 20, 14)),
    capsule: ctx.track(new THREE.CapsuleGeometry(1, 1, 4, 14)),
    ring: ctx.track(new THREE.TorusGeometry(1, 0.12, 10, 36)),
    mat: ctx.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38 })),
    plain(color) {
      const key = new THREE.Color(color).getHexString();
      let m = plains.get(key);
      if (!m) plains.set(key, (m = ctx.track(new THREE.MeshStandardMaterial({ color, roughness: 0.45 }))));
      return m;
    },
  };
  cache.set(ctx, k);
  return k;
}

/** Điểm Fibonacci trên mặt cầu đơn vị (vị trí tế bào phôi nang). */
export function fibonacciSphere(n: number): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    out.push(new THREE.Vector3(Math.cos(ga * i) * r, y, Math.sin(ga * i) * r));
  }
  return out;
}
