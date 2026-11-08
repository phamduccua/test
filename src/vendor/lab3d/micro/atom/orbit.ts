import * as THREE from 'three';
import { createGlassMaterial } from '../../lab/materials/factories';
import type { Tracker } from '../../lab/types';
import { microMaterials } from '../materials';
import type { OrbitSpec } from './layout';

/** 'glow' = vòng mảnh phát sáng; 'glass' = ống thuỷ tinh trong suốt (bìa sách). */
export type OrbitStyle = 'glow' | 'glass';

export interface OrbitVisualOptions {
  style: OrbitStyle;
  tube: number;
  electronRadius: number;
  ringColor: THREE.ColorRepresentation;
  electronColor: THREE.ColorRepresentation;
  /** Vệt sáng phía sau electron (rad, 0 = tắt). */
  trail: number;
}

export interface Orbit {
  spec: OrbitSpec;
  /** Gốc của vòng (đã xoay theo pháp tuyến); vòng nằm trong mặt phẳng XY cục bộ. */
  group: THREE.Group;
  ring: THREE.Mesh;
  /** Mỗi electron là con của một pivot quay quanh trục z cục bộ. */
  pivots: THREE.Object3D[];
  electrons: THREE.Mesh[];
}

const Z = new THREE.Vector3(0, 0, 1);

function trailGeometry(radius: number, tube: number, arc: number): THREE.TorusGeometry {
  const g = new THREE.TorusGeometry(radius, tube, 6, 64, arc);
  g.rotateZ(-arc);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getY(i), pos.getX(i)); // −arc…0
    const k = Math.pow(THREE.MathUtils.clamp(1 + a / arc, 0, 1), 2.2);
    col.set([k, k, k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Dựng một vòng quỹ đạo + các electron trên đó. */
export function createOrbit(ctx: Tracker, spec: OrbitSpec, o: OrbitVisualOptions): Orbit {
  const kit = microMaterials(ctx);
  const group = new THREE.Group();
  group.quaternion.setFromUnitVectors(Z, new THREE.Vector3(...spec.normal).normalize());
  group.rotateZ(spec.spin);

  const ringMat =
    o.style === 'glass'
      ? createGlassMaterial({ thickness: o.tube * 2, tint: o.ringColor, attenuationDistance: o.tube * 6, envMapIntensity: 1.8 })
      : new THREE.MeshBasicMaterial({ color: o.ringColor, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(spec.radius, o.tube, o.style === 'glass' ? 20 : 8, 160)), ctx.track(ringMat));
  ring.name = 'orbit-ring';
  group.add(ring);

  const eMat =
    o.style === 'glass'
      ? kit.chrome(o.electronColor)
      : ctx.track(new THREE.MeshStandardMaterial({ color: o.electronColor, emissive: o.electronColor, emissiveIntensity: 1.6, roughness: 0.3 }));
  const glowMat = kit.glow(o.electronColor, o.style === 'glass' ? 0.35 : 0.9);
  const trailGeo = o.trail > 0 ? ctx.track(trailGeometry(spec.radius, o.tube * 1.8, o.trail)) : null;
  const trailMat = trailGeo
    ? ctx.track(new THREE.MeshBasicMaterial({ color: o.electronColor, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }))
    : null;

  const pivots: THREE.Object3D[] = [];
  const electrons: THREE.Mesh[] = [];
  for (let k = 0; k < spec.electrons; k++) {
    const pivot = new THREE.Object3D();
    pivot.rotation.z = spec.phase + (k * Math.PI * 2) / spec.electrons;
    const e = new THREE.Mesh(kit.sphere('low'), eMat);
    e.scale.setScalar(o.electronRadius);
    e.position.x = spec.radius;
    e.name = 'electron';
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(o.style === 'glass' ? 3.2 : 7);
    e.add(glow);
    pivot.add(e);
    if (trailGeo && trailMat) {
      const tr = new THREE.Mesh(trailGeo, trailMat);
      tr.name = 'electron-trail';
      pivot.add(tr);
    }
    group.add(pivot);
    pivots.push(pivot);
    electrons.push(e);
  }
  return { spec, group, ring, pivots, electrons };
}
