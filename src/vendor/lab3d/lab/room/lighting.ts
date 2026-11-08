import * as THREE from 'three';
import type { LightLevels } from './lightingPresets';

export interface LightRig {
  group: THREE.Group;
  key: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fill: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  /** Đặt cường độ gốc từng đèn (preset createLabLighting); setIntensity nhân trên mức này. */
  setLevels(l: LightLevels): void;
  /** Nhân cường độ toàn bộ (0…2). */
  setIntensity(k: number): void;
  /** Nhiệt độ màu ánh sáng (K, 4000–7000). */
  setColorTemperature(kelvin: number): void;
}

/** Màu xấp xỉ của vật đen tuyệt đối (Tanner Helland), 1000–40000 K. */
export function kelvinToColor(k: number, out = new THREE.Color()): THREE.Color {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = (v: number) => THREE.MathUtils.clamp(v, 0, 255) / 255;
  return out.setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}

/** Đèn phòng thí nghiệm: key (đổ bóng mềm) + fill + rim + hemisphere. Kích thước theo `span` (đơn vị cảnh). */
export function createLightRig(span = 20, levels?: LightLevels): LightRig {
  const group = new THREE.Group();
  group.name = 'light-rig';
  const hemi = new THREE.HemisphereLight(0xeef3ff, 0x3a3630, 0.45);
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(span * 0.25, span * 0.75, span * 0.45);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const s = key.shadow.camera;
  s.left = s.bottom = -span * 0.55;
  s.right = s.top = span * 0.55;
  s.near = 1;
  s.far = span * 2.5;
  key.shadow.radius = 6;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55);
  fill.position.set(-span * 0.5, span * 0.3, span * 0.4);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.1);
  rim.position.set(-span * 0.15, span * 0.4, -span * 0.6);
  group.add(hemi, key, key.target, fill, rim);
  const base = [hemi.intensity, key.intensity, fill.intensity, rim.intensity];
  let gain = 1;
  const tmp = new THREE.Color();
  const rig: LightRig = {
    group,
    key,
    hemi,
    fill,
    rim,
    setLevels(l) {
      base.splice(0, 4, l.hemi, l.key, l.fill, l.rim);
      rig.setIntensity(gain);
    },
    setIntensity(k) {
      gain = k;
      [hemi, key, fill, rim].forEach((l, i) => (l.intensity = base[i] * k));
    },
    setColorTemperature(kelvin) {
      kelvinToColor(kelvin, tmp);
      key.color.copy(tmp);
      fill.color.copy(tmp).lerp(new THREE.Color(0xdfe8ff), 0.4);
    },
  };
  if (levels) rig.setLevels(levels);
  return rig;
}
