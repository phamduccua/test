import * as THREE from 'three';
import type { Tracker } from '../types';

/** Găng tay: không găng (da), nitrile xanh, latex kem, nitrile tím, hoặc mã màu tuỳ ý. */
export type GloveKind = 'none' | 'nitrile' | 'latex' | 'purple' | (string & {});

/** Màu găng đậm vừa – trên mặt bàn sáng dưới preset bench vẫn tách rõ (găng latex không để kem nhạt như thật). */
export const GLOVE_COLORS = { nitrile: '#2f62c4', latex: '#b8925a', purple: '#6247b8' } as const;
export const SKIN_TONE = '#c58c5f';

/** Vật liệu bàn tay: da (sheen nhẹ) hoặc găng (bóng mờ, viền cổ găng đậm hơn); tay áo vải mờ. */
export function handMaterial(ctx: Tracker, glove: GloveKind, skin?: string) {
  const gloved = glove !== 'none';
  const color = gloved ? ((GLOVE_COLORS as Record<string, string>)[glove] ?? glove) : (skin ?? SKIN_TONE);
  const hand = ctx.track(
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: gloved ? 0.42 : 0.6,
      sheen: gloved ? 0.2 : 0.5,
      sheenColor: new THREE.Color(gloved ? '#ffffff' : '#f0c4a0'),
      sheenRoughness: 0.6,
      clearcoat: gloved ? 0.25 : 0,
      clearcoatRoughness: 0.5,
    }),
  );
  const cuff = gloved ? ctx.track(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color).multiplyScalar(0.72), roughness: 0.45 })) : null;
  const sleeves = new Map<string, THREE.Material>();
  return {
    hand,
    cuff,
    sleeve(c: string): THREE.Material {
      let m = sleeves.get(c);
      if (!m) {
        m = ctx.track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, side: THREE.DoubleSide }));
        sleeves.set(c, m);
      }
      return m;
    },
  };
}
