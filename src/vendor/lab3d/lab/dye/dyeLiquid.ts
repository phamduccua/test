import * as THREE from 'three';
import type { Tracker } from '../types';
import type { DyeField } from './dyeField';
import { labText } from '../../text';

export interface DyeLiquidOptions {
  /** Màu chất màu khi nhìn xuyên qua (vd. hồng phenolphtalein #ff3fa4) → hệ số hấp thụ từng kênh. */
  color?: THREE.ColorRepresentation;
  /** Độ hấp thụ (1/đv cảnh) khi giá trị ô sau `map` = 1. */
  strength?: number;
  /** Ánh xạ nồng độ ô → "lượng chất màu" 0…1 (vd. phần dạng hồng của chỉ thị theo pH). Mặc định clamp(c). */
  map?: (c: number) => number;
  /** Số bước raymarch trong khối chất lỏng (mặc định 16). */
  steps?: number;
}

export interface DyeLiquid {
  texture: THREE.Data3DTexture;
  /** Độ hấp thụ (1/đv) – đổi được lúc chạy (vd. theo số giọt chỉ thị). */
  strength: number;
  /** Đẩy trường nồng độ hiện tại lên GPU (gọi sau field.step). */
  upload(): void;
}

/** Hệ số hấp thụ tương đối từng kênh (tuyến tính) sao cho ánh sáng truyền qua có màu `color`. */
export function absorptionFor(color: THREE.ColorRepresentation): THREE.Vector3 {
  const c = new THREE.Color(color);
  const a = new THREE.Vector3(-Math.log(Math.max(c.r, 0.02)), -Math.log(Math.max(c.g, 0.02)), -Math.log(Math.max(c.b, 0.02)));
  return a.multiplyScalar(1 / Math.max(a.x, a.y, a.z, 1e-3));
}

const PARS = /* glsl */ labText('t_f8895d1270aa');

const MIX = 'totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );';

/**
 * (Chép từ nhánh tạm dừng sim/TN-038-01.)
 * Nhuộm màu chất lỏng (mesh của `createLiquid`, vật liệu transmission) theo trường nồng độ 3D `field`:
 * ánh sáng truyền qua bị hấp thụ Beer–Lambert theo tích phân nồng độ dọc tia nhìn (raymarch Data3DTexture).
 * Toạ độ trường = toạ độ cục bộ của mesh (cùng gốc với dụng cụ).
 */
export function attachDye(ctx: Tracker, mesh: THREE.Mesh, field: DyeField, o: DyeLiquidOptions = {}): DyeLiquid {
  const { nx, ny, nz, radius: R } = field;
  const data = new Uint8Array(nx * ny * nz);
  const texture = ctx.track(new THREE.Data3DTexture(data, nx, ny, nz));
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  const map = o.map ?? ((c: number) => c);
  const uniforms = {
    uDyeTex: { value: texture },
    uDyeInv: { value: new THREE.Matrix4() },
    uDyeMin: { value: new THREE.Vector3(-R, field.y0, -R) },
    uDyeSize: { value: new THREE.Vector3(2 * R, field.y1 - field.y0, 2 * R) },
    uDyeAbs: { value: absorptionFor(o.color ?? 0xff3fa4) },
    uDyeK: { value: o.strength ?? 6 },
  };
  const mat = mesh.material as THREE.MeshPhysicalMaterial;
  const steps = o.steps ?? 16;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n#define DYE_STEPS ${steps}\n${PARS}`)
      .replace(
        '#include <transmission_fragment>',
        THREE.ShaderChunk.transmission_fragment.replace(MIX, `transmitted.rgb *= dyeTransmittance(pos, v);\n${MIX}`),
      );
  };
  mat.customProgramCacheKey = () => `dye-liquid-${steps}`;
  mat.needsUpdate = true;
  const prev = mesh.onBeforeRender;
  mesh.onBeforeRender = function (...args) {
    uniforms.uDyeInv.value.copy(mesh.matrixWorld).invert();
    prev.apply(this, args);
  };
  return {
    texture,
    get strength() {
      return uniforms.uDyeK.value;
    },
    set strength(v: number) {
      uniforms.uDyeK.value = v;
    },
    upload() {
      const c = field.c;
      for (let n = 0; n < data.length; n++) data[n] = Math.round(255 * Math.min(1, Math.max(0, map(c[n]))));
      texture.needsUpdate = true;
    },
  };
}
