import * as THREE from 'three';
import { petriProfile } from '../glassware/shapes';
import { createVessel, latheFromProfile } from '../glassware/vessel';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import type { Tracker } from '../types';
import { setRimHinge } from '../geometry/rimHinge';
import { mm } from '../units';

/** A-DIA-THACH: đĩa Petri có lớp thạch đục; mặt thạch là canvas để vẽ vệt ria/thảm vi khuẩn; nắp có bản lề ảo để hé mở. */
export interface AgarPlate {
  /** Gốc ở đáy ngoài, tâm đĩa. */
  group: THREE.Group;
  /** Đáy đĩa + thạch (khuẩn lạc gắn vào đây để lật cùng đĩa). */
  base: THREE.Group;
  /** Trục bản lề của nắp (ở mép −z). */
  lidPivot: THREE.Group;
  /** Bán kính mặt thạch (mm). */
  radius: number;
  /** Độ cao mặt thạch trong `base` (đv cảnh). */
  agarY: number;
  surface: AgarSurface;
  /** Toạ độ đĩa (u, v mm) → điểm trên mặt thạch, toạ độ của `base`. */
  toLocal(u: number, v: number, out?: THREE.Vector3): THREE.Vector3;
  /** 0 = đậy kín, 1 = hé ~55° (cấy ria). */
  setLidOpen(k: number): void;
}

/** Canvas phủ mặt thạch: hàng (R − v)/(2R)·S, cột (u + R)/(2R)·S. */
export interface AgarSurface {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  size: number;
  /** mm → px. */
  px(mm: number): number;
  at(u: number, v: number): [number, number];
  /** Vẽ lại nền thạch (xoá vệt). */
  clear(): void;
  /** Báo texture đổi (gom lại, `flush` mỗi frame). */
  touch(): void;
  flush(): void;
}

export interface AgarPlateOptions {
  /** Đường kính đĩa (mm), mặc định 90. */
  diameter?: number;
  /** Màu thạch: đỏ như thạch máu ở H 20.4 (mặc định), vàng nhạt cho thạch dinh dưỡng thường. */
  agarColor?: THREE.ColorRepresentation;
  /** Độ dày lớp thạch (mm), mặc định 4. */
  depth?: number;
  canvasSize?: number;
}

export function createAgarPlate(ctx: Tracker, o: AgarPlateOptions = {}): AgarPlate {
  const D = o.diameter ?? 90;
  const depth = o.depth ?? 4;
  const color = new THREE.Color(o.agarColor ?? '#b3232f');
  const group = new THREE.Group();
  group.name = 'agar-plate';
  const base = new THREE.Group();
  group.add(base);
  const dish = createVessel(ctx, petriProfile(D, 13), { name: 'petri-base' });
  base.add(dish.group);
  const R = D / 2 - 1.3;
  const y0 = dish.profile.innerBottom;
  const agarY = y0 + mm(depth);
  const sideMat = ctx.track(new THREE.MeshPhysicalMaterial({ color: color.clone().multiplyScalar(0.8), roughness: 0.4, clearcoat: 0.5 }));
  const side = new THREE.Mesh(
    ctx.track(latheFromProfile([{ r: 0, y: y0 }, { r: mm(R), y: y0 }, { r: mm(R), y: agarY - mm(0.6) }, { r: mm(R - 0.8), y: agarY }, { r: 0, y: agarY }], 64)),
    sideMat,
  );
  side.receiveShadow = true;
  base.add(side);

  const S = o.canvasSize ?? 1024;
  const { canvas, g } = makeCanvas(S, S);
  const texture = ctx.track(canvasTexture(canvas));
  texture.anisotropy = 4;
  const css = `#${color.getHexString()}`;
  let dirty = true;
  const surface: AgarSurface = {
    canvas,
    g,
    texture,
    size: S,
    px: (v) => (v / (2 * R)) * S,
    at: (u, v) => [((u + R) / (2 * R)) * S, ((R - v) / (2 * R)) * S],
    clear() {
      const grad = g.createRadialGradient(S * 0.45, S * 0.42, S * 0.05, S / 2, S / 2, S * 0.52);
      grad.addColorStop(0, `#${color.clone().offsetHSL(0, 0, 0.05).getHexString()}`);
      grad.addColorStop(0.85, css);
      grad.addColorStop(1, `#${color.clone().multiplyScalar(0.75).getHexString()}`);
      g.fillStyle = grad;
      g.fillRect(0, 0, S, S);
      dirty = true;
    },
    touch: () => (dirty = true),
    flush() {
      if (!dirty) return;
      dirty = false;
      texture.needsUpdate = true;
    },
  };
  surface.clear();
  const top = new THREE.Mesh(
    ctx.track(new THREE.CircleGeometry(mm(R - 0.8), 96)),
    ctx.track(new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15 })),
  );
  // uv theo bán kính R của surface.at (đĩa vẽ nhỏ hơn 0,8 mm) – không thì hình vẽ bị co ~2 %.
  const uv = top.geometry.attributes.uv;
  const k = (R - 0.8) / R;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * k, 0.5 + (uv.getY(i) - 0.5) * k);
  top.rotation.x = -Math.PI / 2;
  top.position.y = agarY + mm(0.02);
  top.receiveShadow = true;
  base.add(top);

  // Nắp lớn hơn đáy 4 mm, úp xuống; bản lề ảo ở mép xa (−z) để hé nắp về phía người làm – quay quanh mép dưới vành sau (setRimHinge),
  // vành nắp không lùa vào thành đáy.
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, mm(15), -mm(D / 2 + 2));
  group.add(lidPivot);
  const lid = createVessel(ctx, petriProfile(D + 4, 9), { name: 'petri-lid' });
  lid.group.rotation.x = Math.PI;
  lid.group.position.z = mm(D / 2 + 2);
  lidPivot.add(lid.group);
  setRimHinge(lidPivot, 0, mm(9));

  return {
    group,
    base,
    lidPivot,
    radius: R,
    agarY,
    surface,
    toLocal: (u, v, out = new THREE.Vector3()) => out.set(mm(u), agarY, -mm(v)),
    setLidOpen(k) {
      setRimHinge(lidPivot, 0.95 * Math.max(0, Math.min(1, k)), mm(9));
    },
  };
}
