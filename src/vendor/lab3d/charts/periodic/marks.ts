import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { SimContext } from '../../sim/types';
import { subscript } from './layout';
import type { TrendDatum } from './types';

type Ctx = Pick<SimContext, 'track' | 'labels'>;

/** Một mark của lưới: quả cầu + cột cùng màu, nhãn kí hiệu và nhãn giá trị; tự nội suy vị trí/độ mờ/độ sáng. */
export interface Mark {
  datum: TrendDatum;
  group: THREE.Group;
  sphere: THREE.Mesh;
  bar: THREE.Mesh;
  tag: CSS2DObject;
  valueTag: CSS2DObject;
  target: THREE.Vector3;
  opacity: number;
  opacityTarget: number;
  glow: number;
  glowTarget: number;
  /** 0…1: hiệu ứng mọc lên (intro). */
  appear: number;
  setColor(c: number): void;
  /** Độ cao đỉnh hiện tại (đv cảnh, cục bộ). */
  top: number;
  apply(barT: number, sphereT: number, sphereScale: number, barScale: number, foot: number): void;
  step(dt: number): void;
}

export interface MarkGeometries {
  sphere: THREE.SphereGeometry;
  bar: THREE.BufferGeometry;
}

export function markGeometries(ctx: Pick<SimContext, 'track'>): MarkGeometries {
  const bar = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
  bar.translate(0, 0.5, 0);
  return { sphere: ctx.track(new THREE.SphereGeometry(1, 48, 32)), bar: ctx.track(bar) };
}

const makeMaterial = (ctx: Ctx, color: number, rough: number) =>
  ctx.track(
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: rough,
      metalness: 0.05,
      envMapIntensity: 0.4,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0,
    }),
  );

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

export function createMark(ctx: Ctx, geo: MarkGeometries, datum: TrendDatum, color: number, valueText: string, cell: number): Mark {
  const group = new THREE.Group();
  group.name = `mark-${datum.symbol}`;
  const sm = makeMaterial(ctx, color, 0.26);
  const bm = makeMaterial(ctx, color, 0.38);
  const sphere = new THREE.Mesh(geo.sphere, sm);
  const bar = new THREE.Mesh(geo.bar, bm);
  sphere.castShadow = bar.castShadow = true;
  sphere.receiveShadow = bar.receiveShadow = true;
  const anchor = new THREE.Object3D();
  const valueAnchor = new THREE.Object3D();
  valueAnchor.position.set(0, 0.03, cell * 0.36);
  group.add(sphere, bar, anchor, valueAnchor);
  const tag = ctx.labels.add(anchor, datum.symbol, { className: 'pt-tag' });
  tag.element.innerHTML = `<sub>${subscript(datum.Z)}</sub>${datum.symbol}<span class="pt-tag__v">${valueText}</span>`;
  const valueTag = ctx.labels.add(valueAnchor, valueText, { className: 'pt-value' });
  const mats = [sm, bm];
  let lastOpacity = -1;
  let barsOnly = false;

  const mark: Mark = {
    datum,
    group,
    sphere,
    bar,
    tag,
    valueTag,
    target: new THREE.Vector3(),
    opacity: 1,
    opacityTarget: 1,
    glow: 0,
    glowTarget: 0,
    appear: 1,
    top: 0,
    setColor(c) {
      for (const m of mats) {
        m.color.setHex(c);
        m.emissive.setHex(c);
      }
    },
    apply(barT, sphereT, sphereScale, barScale, foot) {
      const a = mark.appear;
      const r = datum.value * sphereScale * sphereT * a;
      const h = datum.value * barScale * barT * a;
      bar.visible = h > 1e-3;
      bar.scale.set(foot, Math.max(h, 1e-4), foot);
      sphere.visible = r > 1e-3;
      sphere.scale.setScalar(Math.max(r, 1e-4));
      sphere.position.y = h + r;
      mark.top = h + 2 * r;
      anchor.position.y = sphereT > 0.5 ? h + r : h + 0.32;
      if (barsOnly !== sphereT < 0.5) {
        barsOnly = sphereT < 0.5;
        tag.element.classList.toggle('pt-tag--bar', barsOnly);
        valueTag.element.classList.toggle('pt-hidden', barsOnly);
      }
    },
    step(dt) {
      group.position.lerp(mark.target, 1 - Math.exp(-6 * dt));
      mark.opacity = damp(mark.opacity, mark.opacityTarget, 7, dt);
      mark.glow = damp(mark.glow, mark.glowTarget, 9, dt);
      const op = mark.opacity;
      if (Math.abs(op - lastOpacity) > 1e-3) {
        const transparent = op < 0.985;
        for (const m of mats) {
          if (m.transparent !== transparent) {
            m.transparent = transparent;
            m.needsUpdate = true;
          }
          m.opacity = op;
          m.depthWrite = !transparent || op > 0.6;
        }
        tag.element.style.opacity = valueTag.element.style.opacity = String(Math.max(0.12, op));
        lastOpacity = op;
      }
      for (const m of mats) m.emissiveIntensity = 0.04 + mark.glow * 0.45;
    },
  };
  return mark;
}
