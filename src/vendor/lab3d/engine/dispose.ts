import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/** Textures that must never be disposed (e.g. the shared PMREM environment). */
export type KeepSet = ReadonlySet<THREE.Texture>;

const EMPTY: KeepSet = new Set();

export function disposeTexture(tex: THREE.Texture | null | undefined, keep: KeepSet = EMPTY): void {
  if (tex && !keep.has(tex)) tex.dispose();
}

/** Dispose a material and every texture referenced by its properties/uniforms. */
export function disposeMaterial(mat: THREE.Material, keep: KeepSet = EMPTY): void {
  for (const value of Object.values(mat)) {
    if (value instanceof THREE.Texture) disposeTexture(value, keep);
  }
  const uniforms = (mat as Partial<THREE.ShaderMaterial>).uniforms;
  if (uniforms) {
    for (const u of Object.values(uniforms)) {
      const v: unknown = u?.value;
      if (v instanceof THREE.Texture) disposeTexture(v, keep);
    }
  }
  mat.dispose();
}

function disposeMaterials(m: THREE.Material | THREE.Material[] | undefined, keep: KeepSet): void {
  if (!m) return;
  if (Array.isArray(m)) m.forEach((x) => disposeMaterial(x, keep));
  else disposeMaterial(m, keep);
}

/**
 * Traverse an object tree and free GPU resources: geometries, materials, textures,
 * shadow maps of lights, render targets and CSS2D label elements. Detaches the root from its parent.
 */
export function disposeObject(root: THREE.Object3D, keep: KeepSet = EMPTY): void {
  root.traverse((obj) => {
    const mesh = obj as Partial<THREE.Mesh> & { isMesh?: boolean; isLine?: boolean; isPoints?: boolean };
    if (mesh.geometry instanceof THREE.BufferGeometry) mesh.geometry.dispose();
    if (mesh.material) disposeMaterials(mesh.material as THREE.Material | THREE.Material[], keep);
    if (obj instanceof THREE.InstancedMesh) obj.dispose();
    if (obj instanceof THREE.Light) {
      const shadow = (obj as THREE.Light & { shadow?: THREE.LightShadow }).shadow;
      shadow?.map?.dispose();
    }
    if (obj instanceof CSS2DObject) obj.element.remove();
  });
  if (root instanceof THREE.Scene) {
    if (root.background instanceof THREE.Texture) disposeTexture(root.background, keep);
    if (root.environment) disposeTexture(root.environment, keep);
  }
  root.removeFromParent();
}

/** Anything with a dispose() method. */
export interface Disposable {
  dispose(): void;
}

export function isDisposable(x: unknown): x is Disposable {
  return typeof x === 'object' && x !== null && typeof (x as Disposable).dispose === 'function';
}

/** Dispose a tracked value of unknown kind (Object3D, geometry, material, texture, render target, …). */
export function disposeAny(x: unknown, keep: KeepSet = EMPTY): void {
  if (x instanceof THREE.Object3D) disposeObject(x, keep);
  else if (x instanceof THREE.Material) disposeMaterial(x, keep);
  else if (x instanceof THREE.Texture) disposeTexture(x, keep);
  else if (typeof x === 'function') (x as () => void)();
  else if (isDisposable(x)) x.dispose();
}
