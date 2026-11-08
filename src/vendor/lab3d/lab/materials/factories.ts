import * as THREE from 'three';
import { mm } from '../units';
import { LOOK_UNIFORMS } from './look';
import { woodTexture } from './textures';

export interface GlassOptions {
  /** Độ dày quang học (đơn vị cảnh) – ≈ 2× bề dày thành. */
  thickness?: number;
  tint?: THREE.ColorRepresentation;
  /** Khoảng suy giảm màu (đơn vị cảnh) – nhỏ = màu đậm (kính nâu). */
  attenuationDistance?: number;
  roughness?: number;
  envMapIntensity?: number;
}

/**
 * Thuỷ tinh borosilicate vật lý: transmission=1, ior=1,47.
 * FrontSide – profile Lathe kín (mặt ngoài + mặt trong) cho 2 lần khúc xạ đúng.
 */
export function createGlassMaterial(o: GlassOptions = {}): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: o.roughness ?? 0.03,
    transmission: 1,
    ior: 1.47,
    thickness: o.thickness ?? mm(5),
    attenuationColor: new THREE.Color(o.tint ?? 0xe4f5ee),
    attenuationDistance: o.attenuationDistance ?? 0.15,
    specularIntensity: 1,
    envMapIntensity: o.envMapIntensity ?? 1.4,
  });
  thickenAtGrazing(mat);
  return mat;
}

/**
 * Thành kính nhìn xiên dày hơn (quãng đường ánh sáng ∝ 1/cosθ) → viền kính tối/xanh nhẹ và khúc xạ mạnh như thật.
 * three mặc định dùng `thickness` cố định nên kính mỏng gần như vô hình trên nền sáng.
 * Thêm viền mép mảnh theo `LOOK_UNIFORMS.uGlassEdge` (0 = tắt – mặc định; createLabLighting bật) để thấy rõ thành/miệng ống.
 */
export function thickenAtGrazing(mat: THREE.MeshPhysicalMaterial, maxFactor = 7): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGlassEdge = LOOK_UNIFORMS.uGlassEdge;
    shader.uniforms.uGlassEdgeColor = LOOK_UNIFORMS.uGlassEdgeColor;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlassEdge;\nuniform vec3 uGlassEdgeColor;')
      .replace(
        '#include <transmission_fragment>',
        THREE.ShaderChunk.transmission_fragment.replace(
          'material.thickness = thickness;',
          `material.thickness = thickness / max(${(1 / maxFactor).toFixed(3)}, abs(dot(normal, normalize(vViewPosition))));`,
        ),
      )
      .replace(
        '#include <opaque_fragment>',
        `{
  float ndv = abs(dot(normalize(normal), normalize(vViewPosition)));
  float edge = uGlassEdge * (1.0 - smoothstep(0.06, 0.42, ndv));
  outgoingLight = mix(outgoingLight, uGlassEdgeColor, edge);
}
#include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `glass-grazing-${maxFactor}-edge`;
}

/** Kim loại: thép/inox/sơn tĩnh điện. */
export function createMetalMaterial(color: THREE.ColorRepresentation = 0xc8ccd2, roughness = 0.3, metalness = 0.95) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 1.1 });
}

export function createRubberMaterial(color: THREE.ColorRepresentation = 0x9a3b2a) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
}

export function createPlasticMaterial(color: THREE.ColorRepresentation = 0xf2f4f6, roughness = 0.38) {
  return new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 });
}

export function createWoodMaterial(light?: string, dark?: string, seed?: number) {
  return new THREE.MeshStandardMaterial({ map: woodTexture(light, dark, seed), roughness: 0.62, metalness: 0 });
}
