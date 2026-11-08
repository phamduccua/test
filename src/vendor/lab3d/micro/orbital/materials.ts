import * as THREE from 'three';

/** Vật liệu thuỳ orbital: nhựa trong mờ có clearcoat, tự phát sáng nhẹ (nhìn xuyên được các thuỳ chồng nhau). */
export function createLobeMaterial(color: THREE.ColorRepresentation, opacity = 0.5): THREE.MeshPhysicalMaterial {
  const c = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({
    color: c,
    emissive: c.clone().multiplyScalar(0.12),
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.2,
  });
}

const RIM_VERT = /* glsl */ `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vN;
varying vec3 vV;
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mvPosition.xyz);
}`;

const RIM_FRAG = /* glsl */ `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uColor;
uniform float uPower;
uniform float uStrength;
varying vec3 vN;
varying vec3 vV;
void main() {
  #include <clipping_planes_fragment>
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
  gl_FragColor = vec4(uColor * f * uStrength, 1.0);
}`;

export type RimMaterial = THREE.ShaderMaterial & { uniforms: { uColor: { value: THREE.Color }; uStrength: { value: number } } };

/** Viền fresnel cộng màu (vầng sáng mép thuỳ) – đặt cùng geometry với thuỳ. */
export function createRimMaterial(color: THREE.ColorRepresentation, strength = 0.9, power = 2.6): RimMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uStrength: { value: strength },
    },
    vertexShader: RIM_VERT,
    fragmentShader: RIM_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    clipping: true,
  }) as RimMaterial;
}
