import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createPlasticMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';
import { DIAL_H, DIAL_PIVOT, DIAL_W, drawDialFace, type DialFaceSpec } from './dialFace';
import { createBindingPost, electricMat, POLE_COLORS } from './parts';

export interface AmmeterOptions extends Partial<DialFaceSpec> {
  /** Màu vỏ. */
  color?: THREE.ColorRepresentation;
}

export interface Ammeter {
  group: THREE.Group;
  /** Điểm nối dây (cục bộ): cọc đỏ (+) và đen (−). */
  plus: THREE.Vector3;
  minus: THREE.Vector3;
  readonly value: number;
  max: number;
  /** Giá trị đích (cùng đơn vị mặt số); kim dao động tắt dần tới đó. */
  setValue(v: number, instant?: boolean): void;
  update(dt: number): void;
}

/** Đồng hồ đo kim (ampe kế/vôn kế): vỏ mặt nghiêng, mặt số canvas, kim có quán tính, 2 cọc đấu dây. Gốc ở đáy. */
export function createAmmeter(ctx: Tracker, o: AmmeterOptions = {}): Ammeter {
  const spec: DialFaceSpec = { max: 300, major: 50, minor: 10, unit: 'mA', symbol: 'A', sweep: 0.86, ...o };
  const group = new THREE.Group();
  group.name = 'ammeter';
  const W = mm(84);
  const D = mm(48);
  const L = mm(18);
  const h0 = mm(12);
  const h1 = mm(22);
  const h2 = mm(70);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (const [u, v] of [[D + L, 0], [D + L, h0], [D, h0], [D, h1], [0, h2]] as const) shape.lineTo(u, v);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: true, bevelSize: mm(1.5), bevelThickness: mm(1.5), bevelSegments: 3 });
  geo.rotateY(-Math.PI / 2);
  geo.translate(W / 2, 0, -(D + L) / 2);
  const body = new THREE.Mesh(geo, electricMat(ctx, `meter-${new THREE.Color(o.color ?? 0x2d3440).getHexString()}`, () => createPlasticMaterial(o.color ?? 0x2d3440, 0.45)));
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  // Mặt số trên mặt nghiêng.
  const { canvas, g } = makeCanvas(DIAL_W, DIAL_H);
  drawDialFace(g, spec);
  const faceW = W * 0.9;
  const faceH = (faceW * DIAL_H) / DIAL_W;
  const panel = new THREE.Group();
  const z0 = -(D + L) / 2;
  panel.position.set(0, (h1 + h2) / 2 + mm(1.6), z0 + D / 2 + mm(1.2));
  panel.rotation.x = -Math.atan2(D, h2 - h1);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(faceW, faceH),
    ctx.track(new THREE.MeshStandardMaterial({ map: ctx.track(canvasTexture(canvas)), roughness: 0.55 })),
  );
  const cover = new THREE.Mesh(
    new THREE.PlaneGeometry(faceW * 0.95, faceH * 0.92),
    ctx.track(new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1, depthWrite: false })),
  );
  cover.position.z = mm(3);
  const needle = new THREE.Group();
  needle.position.set(((DIAL_PIVOT.x - DIAL_W / 2) / DIAL_W) * faceW, (0.5 - DIAL_PIVOT.y / DIAL_H) * faceH, mm(1.2));
  const len = faceW * 0.44;
  const needleMat = electricMat(ctx, 'needle', () => new THREE.MeshStandardMaterial({ color: 0xb3171d, roughness: 0.4 }));
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(mm(0.9), len, mm(0.4)), needleMat);
  shaft.position.y = len / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(mm(3), mm(3), mm(1.5), 16), electricMat(ctx, 'hub', () => new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.35 })));
  hub.rotation.x = Math.PI / 2;
  needle.add(shaft, hub);
  panel.add(face, needle, cover);
  group.add(panel);
  const posts = [POLE_COLORS.minus, POLE_COLORS.plus].map((c, k) => {
    const p = createBindingPost(ctx, c);
    p.group.position.set((k ? 1 : -1) * W * 0.28, h0, z0 + D + L / 2);
    group.add(p.group);
    return p.group.position.clone().add(p.wirePoint);
  });
  let target = 0;
  let x = 0;
  let v = 0;
  const angle = (val: number) => spec.sweep - (2 * spec.sweep * val) / spec.max;
  const apply = () => (needle.rotation.z = angle(Math.max(-spec.max * 0.02, Math.min(spec.max * 1.04, x))));
  apply();
  return {
    group, minus: posts[0], plus: posts[1], max: spec.max,
    get value() {
      return x;
    },
    setValue(val, instant) {
      target = Math.max(0, Math.min(spec.max * 1.08, val));
      if (instant) {
        x = target;
        v = 0;
        apply();
      }
    },
    update(dt) {
      // Dao động tắt dần bậc hai (ω ≈ 14 rad/s, ζ ≈ 0,5) – như kim điện kế thật.
      const w = 14;
      const z = 0.5;
      const n = Math.max(1, Math.ceil(dt / 0.005));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        v += (w * w * (target - x) - 2 * z * w * v) * h;
        x += v * h;
      }
      apply();
    },
  };
}
