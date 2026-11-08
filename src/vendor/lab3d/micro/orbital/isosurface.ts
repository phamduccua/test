import * as THREE from 'three';
import type { ScalarGrid } from './grid';
import { polygonize } from './marching';
import { createLobeMaterial, createRimMaterial, type RimMaterial } from './materials';

export interface IsosurfaceOptions {
  /** |ψ| đẳng trị (cùng đơn vị với lưới). */
  level: number;
  /** Màu thuỳ ψ > 0 và ψ < 0. */
  pos?: THREE.ColorRepresentation;
  neg?: THREE.ColorRepresentation;
  opacity?: number;
  /** Độ sáng viền fresnel (0 = tắt). */
  rim?: number;
}

export interface Isosurface {
  group: THREE.Group;
  /** Dựng lại mặt ở đẳng trị mới (marching tetrahedra trên CPU). */
  setLevel(level: number): void;
  setColors(pos: THREE.ColorRepresentation, neg: THREE.ColorRepresentation): void;
  setOpacity(o: number): void;
  setClipping(planes: THREE.Plane[] | null): void;
  triangles(): number;
  dispose(): void;
}

interface Lobe {
  mesh: THREE.Mesh;
  rim: THREE.Mesh;
  mat: THREE.MeshPhysicalMaterial;
  rimMat: RimMaterial;
  sign: 1 | -1;
}

/** Mặt đẳng trị ±|ψ| của một lưới ψ: hai "pha" (thuỳ dương/âm) tô hai màu, trong mờ + viền sáng. */
/** Không tự `track`: người gọi gọi `dispose()` khi dựng lại / huỷ (vd. `ctx.track(() => s.dispose())` một lần). */
export function createIsosurface(grid: ScalarGrid, o: IsosurfaceOptions): Isosurface {
  const group = new THREE.Group();
  group.name = 'isosurface';
  const lobes: Lobe[] = ([1, -1] as const).map((sign) => {
    const color = sign > 0 ? (o.pos ?? 0x3b82f6) : (o.neg ?? 0xf59e0b);
    const mat = createLobeMaterial(color, o.opacity ?? 0.5);
    const rimMat = createRimMaterial(color, o.rim ?? 0.75);
    const geo = new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(geo, mat);
    const rim = new THREE.Mesh(geo, rimMat);
    mesh.renderOrder = 1;
    rim.renderOrder = 2;
    group.add(mesh, rim);
    return { mesh, rim, mat, rimMat, sign };
  });
  let tris = 0;
  const setLevel = (level: number) => {
    tris = 0;
    for (const L of lobes) {
      const s = polygonize(grid, level, L.sign);
      L.mesh.geometry.dispose();
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(s.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(s.normals, 3));
      geo.computeBoundingSphere();
      L.mesh.geometry = geo;
      L.rim.geometry = geo;
      L.mesh.visible = L.rim.visible = s.triangles > 0;
      tris += s.triangles;
    }
  };
  setLevel(o.level);
  const surf: Isosurface = {
    group,
    setLevel,
    setColors(pos, neg) {
      for (const L of lobes) {
        const c = new THREE.Color(L.sign > 0 ? pos : neg);
        L.mat.color.copy(c);
        L.mat.emissive.copy(c).multiplyScalar(0.12);
        L.rimMat.uniforms.uColor.value.copy(c);
      }
    },
    setOpacity(op) {
      for (const L of lobes) L.mat.opacity = op;
    },
    setClipping(planes) {
      for (const L of lobes) {
        L.mat.clippingPlanes = planes;
        L.rimMat.clippingPlanes = planes;
        L.mat.needsUpdate = L.rimMat.needsUpdate = true;
      }
    },
    triangles: () => tris,
    dispose() {
      for (const L of lobes) {
        L.mesh.geometry.dispose();
        L.mat.dispose();
        L.rimMat.dispose();
      }
      group.removeFromParent();
    },
  };
  return surf;
}
