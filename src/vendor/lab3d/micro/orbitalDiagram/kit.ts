import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Tracker } from '../../lab/types';
import type { SubL } from './subshell';

/** Màu theo phân lớp (spec TN-023-01: s đỏ, p vàng, d lam, f lục) – sáng vừa để nổi trên nền tối. */
export const SUB_COLORS: Record<SubL, number> = { s: 0xff6161, p: 0xffc94a, d: 0x55a9ff, f: 0x52d98f };
/** Spin ↑ lam, ↓ cam (A-ELECTRON). */
export const SPIN_COLORS = { up: 0x5cc8ff, down: 0xff9d42 } as const;
export const spinColor = (s: number) => (s > 0 ? SPIN_COLORS.up : SPIN_COLORS.down);
export const FLAG_COLORS = { bad: 0xff3b5c, good: 0x5dffa0, hint: 0xfff07a } as const;
export const cssHex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export interface DiagramKit {
  /** Khung 12 cạnh (thanh hộp mảnh) của ô kích thước w × h × d, tâm ở gốc. */
  frame(w: number, h: number, d: number, t: number): THREE.BufferGeometry;
  /** Hộp đơn vị (lòng ô, mặt trong). */
  unitBox(): THREE.BoxGeometry;
  /** Mũi tên spin đùn khối, cao 1, hướng +y, tâm ở gốc. */
  arrow(): THREE.ExtrudeGeometry;
}

const kits = new WeakMap<object, DiagramKit>();

function frameGeometry(w: number, h: number, d: number, t: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bar = (sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(x, y, z);
    parts.push(g);
  };
  for (const a of [-1, 1])
    for (const b of [-1, 1]) {
      bar(w + t, t, t, 0, (a * h) / 2, (b * d) / 2);
      bar(t, h + t, t, (a * w) / 2, 0, (b * d) / 2);
      bar(t, t, d + t, (a * w) / 2, (b * h) / 2, 0);
    }
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

function arrowGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  const sw = 0.055, hw = 0.17, neck = 0.16;
  s.moveTo(-sw, -0.5);
  s.lineTo(sw, -0.5);
  s.lineTo(sw, neck);
  s.lineTo(hw, neck);
  s.lineTo(0, 0.5);
  s.lineTo(-hw, neck);
  s.lineTo(-sw, neck);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.014, bevelSegments: 2 });
  g.translate(0, 0, -0.03);
  g.computeVertexNormals();
  return g;
}

/** Geometry dùng chung của bộ ô orbital (nhớ đệm theo ctx, tự track). */
export function diagramKit(ctx: Tracker): DiagramKit {
  const found = kits.get(ctx);
  if (found) return found;
  const cache = new Map<string, THREE.BufferGeometry>();
  const once = <T extends THREE.BufferGeometry>(key: string, make: () => T): T => {
    let g = cache.get(key) as T | undefined;
    if (!g) {
      g = ctx.track(make());
      cache.set(key, g);
    }
    return g;
  };
  const kit: DiagramKit = {
    frame: (w, h, d, t) => once(`frame-${w}-${h}-${d}-${t}`, () => frameGeometry(w, h, d, t)),
    unitBox: () => once('unit', () => new THREE.BoxGeometry(1, 1, 1)),
    arrow: () => once('arrow', arrowGeometry),
  };
  kits.set(ctx, kit);
  return kit;
}
