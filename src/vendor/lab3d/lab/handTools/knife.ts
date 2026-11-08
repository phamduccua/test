import * as THREE from 'three';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';
import { anchor, handleMaterial, part, toolFrame, type HandTool, type HandleColor, toolSteel } from './common';

export interface KnifeOptions {
  /** 'chef' = dao bếp mũi nhọn (mặc định), 'cleaver' = dao thái bản chữ nhật (thái hành, rau củ), 'paring' = dao gọt nhỏ. */
  kind?: 'chef' | 'cleaver' | 'paring';
  /** Chiều dài lưỡi (đơn vị cảnh – như createKitchenKnife), mặc định 170 / 165 / 90 mm. */
  blade?: number;
  /** Màu cán, mặc định 'dark' (đen nâu) – 'red'/'blue'… cho dao nhựa màu. */
  handle?: HandleColor;
}

export interface Knife extends HandTool {
  /** Chiều dài lưỡi (đv). */
  blade: number;
}

/**
 * A-DAO – dao: lưỡi trong mặt phẳng x–y, cạnh sắc trên trục x tại y = 0 (gốc ở giữa cạnh sắc), mũi về −x, cán về +x, sống dao y > 0.
 * (Đặt nằm trên bàn: `group.rotation.x = -Math.PI / 2`; cán về −x: `group.rotation.y = Math.PI`.) `tip` = mũi dao, `grip` = giữa cán.
 */
export function createKnife(ctx: Tracker, o: KnifeOptions = {}): Knife {
  const kind = o.kind ?? 'chef';
  const L = o.blade ?? mm(kind === 'paring' ? 90 : kind === 'cleaver' ? 165 : 170);
  const H = mm(kind === 'cleaver' ? 48 : kind === 'paring' ? 20 : 42);
  const { group, body } = toolFrame('kitchen-knife');
  const s = new THREE.Shape();
  if (kind === 'cleaver') {
    s.moveTo(-L / 2, mm(4)).quadraticCurveTo(-L / 2, 0, -L / 2 + mm(6), 0).lineTo(L / 2, 0).lineTo(L / 2, H).lineTo(-L / 2 + mm(4), H).quadraticCurveTo(-L / 2, H, -L / 2, H - mm(6)).closePath();
  } else {
    s.moveTo(-L / 2, H * 0.55);
    s.quadraticCurveTo(-L / 2 + mm(8), mm(2), -L / 2 + L * 0.18, 0);
    s.lineTo(L / 2, 0).lineTo(L / 2, H);
    s.lineTo(-L / 2 + L * 0.24, H * 0.95);
    s.quadraticCurveTo(-L / 2 + L * 0.06, H * 0.85, -L / 2, H * 0.55);
  }
  const t = kind === 'cleaver' ? mm(2) : mm(1.4);
  const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: mm(0.4), bevelSize: mm(0.6), bevelSegments: 1, curveSegments: 12 });
  part(ctx, body, geo.translate(0, 0, -t / 2), toolSteel(ctx));
  // Cán: khối bo tròn dẹt + 2 đinh tán.
  const hl = kind === 'paring' ? mm(85) : mm(110);
  const hr = kind === 'paring' ? mm(8) : mm(11);
  const hy = kind === 'cleaver' ? H * 0.62 : H * 0.55;
  const handle = part(ctx, body, new THREE.CapsuleGeometry(hr, hl - 2 * hr, 6, 16), handleMaterial(ctx, o.handle ?? 'dark'), L / 2 + hl / 2 + mm(3), hy);
  handle.rotation.z = Math.PI / 2;
  handle.scale.set(1, 1, 0.75);
  const rivet = new THREE.CylinderGeometry(mm(2.4), mm(2.4), hr * 1.55, 12).rotateX(Math.PI / 2);
  for (const k of [0.3, 0.68]) part(ctx, body, rivet.clone(), labMaterials(ctx).chrome(), L / 2 + hl * k, hy);
  rivet.dispose();
  const tip = anchor(body, 'tip', -L / 2, kind === 'cleaver' ? mm(2) : H * 0.4);
  const grip = anchor(body, 'grip', L / 2 + hl / 2 + mm(3), hy);
  return { group, tip, grip, blade: L };
}
