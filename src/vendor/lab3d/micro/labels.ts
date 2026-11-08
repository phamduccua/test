import type * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { LabelOptions } from '../engine/labels';
import type { SimContext } from '../sim/types';

export interface LabelSet {
  items: CSS2DObject[];
  setVisible(v: boolean): void;
}

/** Gắn nhãn CSS2D (ctx.labels) cho nhiều vật – vd. kí hiệu nguyên tử, Na⁺/Cl⁻. */
export function labelObjects(
  ctx: Pick<SimContext, 'labels'>,
  objects: THREE.Object3D[],
  text: (i: number) => string,
  opts: LabelOptions | ((i: number) => LabelOptions) = { variant: 'small' },
): LabelSet {
  const items = objects.map((o, i) => ctx.labels.add(o, text(i), typeof opts === 'function' ? opts(i) : opts));
  return {
    items,
    setVisible(v) {
      for (const l of items) l.visible = v;
    },
  };
}

/** Màu hex số → chuỗi CSS. */
export const cssColor = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
