import * as THREE from 'three';
import type { VesselProfile } from '../glassware/profile';
import { levelForVolume, volumeBelow } from '../glassware/profile';
import { latheFromProfile, RENDER_ORDER } from '../glassware/vessel';
import type { Tracker } from '../types';
import { fromML, mm, toML } from '../units';
import { applyLiquidLook, createLiquidMaterial, type LiquidLook } from './liquidMaterial';
import { liquidInner, liquidShape } from './meniscus';

export interface LiquidOptions {
  /** Mực (độ cao cục bộ của dụng cụ) – hoặc dùng volumeML. */
  level?: number;
  volumeML?: number;
  color?: THREE.ColorRepresentation;
  /** Độ đậm màu 0…1 (mặc định 0,5). */
  opacity?: number;
  turbidity?: number;
  turbidColor?: THREE.ColorRepresentation;
  /** Huyền phù màu đậm giữ đúng màu `turbidColor` (không pha trắng). */
  turbidPure?: boolean;
  /** Chiều cao mặt khum (đơn vị cảnh); 0 = phẳng, âm = lồi. */
  meniscus?: number;
  ior?: number;
  /** Độ dày transmission (đơn vị cảnh); mặc định 1,6 × bán kính lớn nhất – lớp mỏng (đĩa Petri) nên đặt nhỏ để khỏi thấy ảnh lặp phía sau. */
  thickness?: number;
  /** Màu phát sáng (huỳnh quang/phát quang); cường độ đặt bằng `setGlow`. */
  glow?: THREE.ColorRepresentation;
}

export interface Liquid {
  mesh: THREE.Mesh;
  readonly level: number;
  readonly volumeML: number;
  setLevel(level: number): void;
  setVolume(ml: number): void;
  /** Đổi màu mượt trong `duration` giây (0 = tức thì). Cần gọi update(dt). */
  setColor(color: THREE.ColorRepresentation, duration?: number, opacity?: number): void;
  setTurbidity(t: number, duration?: number, color?: THREE.ColorRepresentation): void;
  /** Cường độ phát sáng 0… (cần `glow` khi tạo, hoặc truyền màu ở đây). */
  setGlow(intensity: number, color?: THREE.ColorRepresentation): void;
  update(dt: number): void;
}

/** A-CHAT-LONG – khối chất lỏng khớp lòng dụng cụ tới mực, có mặt khum. Thêm `mesh` vào vessel.group. */
export function createLiquid(ctx: Tracker, profile: VesselProfile, o: LiquidOptions = {}): Liquid {
  const inner = liquidInner(profile.inner);
  const mat = ctx.track(createLiquidMaterial(o.thickness ?? profile.maxRadius * 1.6));
  if (o.ior) mat.ior = o.ior;
  if (o.glow !== undefined) {
    mat.emissive.set(o.glow);
    mat.emissiveIntensity = 0;
  }
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.renderOrder = RENDER_ORDER.liquid;
  mesh.name = 'liquid';
  const meniscus = o.meniscus ?? mm(2.5);
  const look: LiquidLook = {
    color: new THREE.Color(o.color ?? 0xdff3ff),
    density: o.opacity ?? 0.5,
    turbidity: o.turbidity ?? 0,
    turbidColor: new THREE.Color(o.turbidColor ?? 0xf4f4f0),
    turbidPure: o.turbidPure,
  };
  const from = { color: look.color.clone(), density: look.density, turbidity: look.turbidity };
  const to = { color: look.color.clone(), density: look.density, turbidity: look.turbidity };
  let tColor = 1;
  let durColor = 0;
  let tTurb = 1;
  let durTurb = 0;
  let level = 0;

  const rebuild = (y: number) => {
    level = y;
    const shape = liquidShape(inner, y, meniscus);
    mesh.visible = !!shape;
    if (!shape) return;
    mesh.geometry.dispose();
    mesh.geometry = latheFromProfile(shape.points, 48);
  };

  const api: Liquid = {
    mesh,
    get level() {
      return level;
    },
    get volumeML() {
      return toML(volumeBelow(inner, level));
    },
    setLevel: rebuild,
    setVolume(ml) {
      rebuild(levelForVolume(inner, fromML(ml)));
    },
    setColor(color, duration = 0, opacity) {
      from.color.copy(look.color);
      from.density = look.density;
      to.color.set(color);
      to.density = opacity ?? look.density;
      durColor = duration;
      tColor = duration > 0 ? 0 : 1;
      if (duration <= 0) {
        look.color.copy(to.color);
        look.density = to.density;
        applyLiquidLook(mat, look);
      }
    },
    setGlow(intensity, color) {
      if (color !== undefined) mat.emissive.set(color);
      mat.emissiveIntensity = intensity;
    },
    setTurbidity(t, duration = 0, color) {
      if (color !== undefined) look.turbidColor.set(color);
      from.turbidity = look.turbidity;
      to.turbidity = t;
      durTurb = duration;
      tTurb = duration > 0 ? 0 : 1;
      if (duration <= 0) {
        look.turbidity = t;
        applyLiquidLook(mat, look);
      }
    },
    update(dt) {
      if (tColor >= 1 && tTurb >= 1) return;
      if (tColor < 1) {
        tColor = Math.min(1, tColor + dt / durColor);
        const e = tColor * tColor * (3 - 2 * tColor);
        look.color.copy(from.color).lerp(to.color, e);
        look.density = from.density + (to.density - from.density) * e;
      }
      if (tTurb < 1) {
        tTurb = Math.min(1, tTurb + dt / durTurb);
        look.turbidity = from.turbidity + (to.turbidity - from.turbidity) * tTurb;
      }
      applyLiquidLook(mat, look);
    },
  };
  applyLiquidLook(mat, look);
  if (o.volumeML !== undefined) api.setVolume(o.volumeML);
  else rebuild(o.level ?? profile.innerBottom + (profile.height - profile.innerBottom) * 0.4);
  return api;
}

/** Khí có màu lấp đầy dụng cụ (Cl2, Br2, I2 hơi…): khối "chất lỏng" rất loãng, không mặt khum. */
export function createGasFill(
  ctx: Tracker,
  profile: VesselProfile,
  o: { color: THREE.ColorRepresentation; density?: number; level?: number },
): Liquid {
  return createLiquid(ctx, profile, {
    color: o.color,
    opacity: o.density ?? 0.25,
    meniscus: 0,
    ior: 1.0,
    level: o.level ?? profile.height - mm(3),
  });
}
