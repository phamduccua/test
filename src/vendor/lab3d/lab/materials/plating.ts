import * as THREE from 'three';
import { labText } from '../../text';

export interface PlatedMaterial {
  material: THREE.MeshPhysicalMaterial;
  /** Độ phủ lớp mạ 0…1 trong vùng ngập. */
  setCoverage(c: number): void;
  /** Độ dày/xốp 0…1 (lớp dày → xỉn, nhám, sẫm hơn). */
  setThickness(t: number): void;
  /** Loang lổ 0 (đều) … 1 (từng mảng – bề mặt còn gỉ/bẩn). */
  setPatchy(p: number): void;
  /** Mặt phẳng ranh giới ngập (toạ độ CỤC BỘ của mesh): phần có n·p < d được mạ. */
  setWaterline(normal: THREE.Vector3, d: number): void;
  setCoatColor(c: THREE.ColorRepresentation): void;
}

const NOISE = /* glsl */ `
varying vec3 vPlLocal;
uniform float uCover; uniform float uThick; uniform float uPatchy; uniform vec4 uPlane; uniform vec3 uCoat;
float plHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float plNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(plHash(i), plHash(i + vec3(1,0,0)), f.x), mix(plHash(i + vec3(0,1,0)), plHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(plHash(i + vec3(0,0,1)), plHash(i + vec3(1,0,1)), f.x), mix(plHash(i + vec3(0,1,1)), plHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float plFbm(vec3 p) { return 0.55 * plNoise(p) + 0.3 * plNoise(p * 2.7) + 0.15 * plNoise(p * 7.1); }
`;

const APPLY = /* glsl */ labText('t_0b848d3cbc1e');

/**
 * Kim loại có lớp mạ/kết tủa kim loại khác mọc dần (Cu bám trên đinh Fe, Ag trên dây Cu…):
 * MeshPhysicalMaterial + shader nhiễu theo toạ độ cục bộ, chỉ phủ phần dưới mặt phẳng ngập.
 */
export function createPlatedMaterial(o: {
  base?: THREE.ColorRepresentation;
  coat?: THREE.ColorRepresentation;
  roughness?: number;
} = {}): PlatedMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: o.base ?? 0xb7bcc2,
    metalness: 1,
    roughness: o.roughness ?? 0.32,
    envMapIntensity: 1.3,
  });
  const uniforms = {
    uCover: { value: 0 },
    uThick: { value: 0 },
    uPatchy: { value: 0 },
    uPlane: { value: new THREE.Vector4(0, 1, 0, -1e3) },
    uCoat: { value: new THREE.Color(o.coat ?? 0xb5562e) },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPlLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlLocal = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${APPLY}`);
  };
  material.customProgramCacheKey = () => 'plated-metal-v1';
  return {
    material,
    setCoverage: (c) => void (uniforms.uCover.value = THREE.MathUtils.clamp(c, 0, 1)),
    setThickness: (t) => void (uniforms.uThick.value = THREE.MathUtils.clamp(t, 0, 1)),
    setPatchy: (p) => void (uniforms.uPatchy.value = THREE.MathUtils.clamp(p, 0, 1)),
    setWaterline(n, d) {
      uniforms.uPlane.value.set(n.x, n.y, n.z, d);
    },
    setCoatColor: (c) => void uniforms.uCoat.value.set(c),
  };
}
