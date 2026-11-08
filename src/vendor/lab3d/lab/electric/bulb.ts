import * as THREE from 'three';
import { kelvinToColor } from '../room/lighting';
import { createPlasticMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';
import { filamentKelvin } from './circuit';
import { createHalo } from './glow';
import { brass, createBindingPost, electricMat, nickel, POLE_COLORS } from './parts';

export interface BulbOptions {
  /** 'bulb' = bóng dây tóc (ánh vàng ấm); 'led' = đèn LED (màu `ledColor`). */
  kind?: 'bulb' | 'led';
  ledColor?: THREE.ColorRepresentation;
  /** Có đế + 2 cọc đấu dây (mặc định true). */
  base?: boolean;
  /** Cường độ PointLight khi sáng tối đa. */
  light?: number;
}

export interface Bulb {
  group: THREE.Group;
  /** Tâm vùng phát sáng (cục bộ). */
  glowCenter: THREE.Vector3;
  /** Điểm nối dây ở hai cọc (cục bộ; trái, phải). */
  terminals: [THREE.Vector3, THREE.Vector3];
  readonly brightness: number;
  /** Đặt độ sáng đích 0…1 (dây tóc có quán tính nhiệt – cần update). */
  setBrightness(b: number, instant?: boolean): void;
  update(dt: number, elapsed?: number): void;
}

/** Bóng đèn pin trên đế có cọc đấu dây: dây tóc xoắn, bóng thuỷ tinh, quầng sáng cộng màu + PointLight. Gốc ở đáy đế. */
export function createBulb(ctx: Tracker, o: BulbOptions = {}): Bulb {
  const led = o.kind === 'led';
  const group = new THREE.Group();
  group.name = led ? 'led' : 'bulb';
  const withBase = o.base !== false;
  const baseH = withBase ? mm(12) : 0;
  if (withBase) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(mm(64), baseH, mm(36)), electricMat(ctx, 'base-dark', () => createPlasticMaterial(0x2a3038, 0.5)));
    board.position.y = baseH / 2;
    board.castShadow = board.receiveShadow = true;
    group.add(board);
  }
  // Đui xoáy E10: vòng ren nhỏ (lathe răng cưa).
  const thread: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) thread.push(new THREE.Vector2(mm(i % 2 ? 5.2 : 4.7), mm(i * 1.1)));
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(mm(8), mm(9), mm(10), 24), electricMat(ctx, 'socket', () => createPlasticMaterial(0xece6d8, 0.4)));
  socket.position.y = baseH + mm(5);
  const screw = new THREE.Mesh(new THREE.LatheGeometry(thread, 24), brass(ctx));
  screw.position.y = baseH + mm(9);
  group.add(socket, screw);
  const neckY = baseH + mm(22);
  // Bóng thuỷ tinh hình quả lê.
  const R = mm(led ? 2.6 : 11);
  const r0 = led ? R : mm(4.8);
  const neckLen = mm(led ? 5 : 3);
  const cy = neckLen + Math.sqrt(Math.max(0, R * R - r0 * r0));
  const a0 = -Math.acos(Math.min(1, r0 / R));
  const prof: THREE.Vector2[] = [new THREE.Vector2(r0, 0), new THREE.Vector2(r0, neckLen)];
  for (let i = 1; i <= 24; i++) {
    const a = a0 + (Math.PI / 2 - a0) * (i / 24);
    prof.push(new THREE.Vector2(Math.max(0.0001, R * Math.cos(a)), cy + R * Math.sin(a)));
  }
  const glassMat = ctx.track(
    new THREE.MeshPhysicalMaterial({
      color: led ? o.ledColor ?? 0xff3030 : 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: led ? 0.55 : 0.24,
      clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, side: THREE.DoubleSide, emissive: 0x000000,
    }),
  );
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), glassMat);
  glass.position.y = neckY - mm(1);
  glass.renderOrder = 3;
  group.add(glass);
  const glowCenter = new THREE.Vector3(0, neckY - mm(1) + cy, 0);
  // Dây tóc xoắn giữa hai cọc đỡ.
  const filMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.6, emissive: 0x000000, toneMapped: false }));
  const span = mm(led ? 2 : 5);
  const cy0 = glowCenter.y;
  const coil = Array.from({ length: 177 }, (_, i) => {
    const t = i / 176;
    return new THREE.Vector3(-span / 2 + span * t, cy0 + mm(0.6) * Math.sin(t * Math.PI * 22), mm(0.6) * Math.cos(t * Math.PI * 22));
  });
  const helix = new THREE.CatmullRomCurve3(coil);
  const fil = new THREE.Mesh(new THREE.TubeGeometry(helix, 220, mm(0.16), 5), filMat);
  group.add(fil);
  for (const s of [-1, 1]) {
    const h = glowCenter.y - neckY + mm(2);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(mm(0.25), mm(0.25), h, 6), nickel(ctx));
    post.position.set((s * span) / 2, neckY - mm(2) + h / 2, 0);
    group.add(post);
  }
  const terminals: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  if (withBase)
    [-1, 1].forEach((s, k) => {
      const p = createBindingPost(ctx, k ? POLE_COLORS.plus : POLE_COLORS.minus);
      p.group.position.set(s * mm(23), baseH, 0);
      group.add(p.group);
      terminals[k].copy(p.group.position).add(p.wirePoint);
    });
  // Quầng sáng 2 lớp + đèn điểm.
  const warm = new THREE.Color();
  const core = createHalo(ctx, 0xffffff, mm(led ? 22 : 34));
  const halo = createHalo(ctx, 0xffffff, mm(led ? 80 : 150));
  core.position.copy(glowCenter);
  halo.position.copy(glowCenter);
  const light = new THREE.PointLight(0xffd59a, 0, 4, 2);
  light.position.copy(glowCenter);
  group.add(core, halo, light);
  const ledColor = new THREE.Color(o.ledColor ?? 0xff3030);
  let target = 0;
  let b = 0;
  const apply = (elapsed = 0) => {
    const flick = 1 + 0.015 * Math.sin(elapsed * 37) * b;
    const v = b * flick;
    if (led) warm.copy(ledColor);
    else kelvinToColor(filamentKelvin(v), warm);
    filMat.emissive.copy(warm).multiplyScalar(led ? 0 : 1.5 + 9 * v);
    filMat.emissiveIntensity = v > 0.001 ? 1 : 0;
    glassMat.emissive.copy(warm).multiplyScalar((led ? 1.4 : 0.6) * Math.pow(v, 0.7));
    (core.material as THREE.SpriteMaterial).color.copy(warm);
    (halo.material as THREE.SpriteMaterial).color.copy(warm);
    const vis = Math.pow(v, 0.7);
    (core.material as THREE.SpriteMaterial).opacity = Math.min(1, vis * 1.6);
    (halo.material as THREE.SpriteMaterial).opacity = Math.min(0.9, 0.85 * vis);
    core.scale.setScalar(mm(led ? 22 : 40) * (0.7 + 0.6 * vis));
    halo.scale.setScalar(mm(led ? 90 : 190) * (0.55 + 0.6 * vis));
    light.color.copy(warm);
    light.intensity = (o.light ?? 3.2) * v * v;
  };
  apply();
  return {
    group, glowCenter, terminals,
    get brightness() {
      return b;
    },
    setBrightness(v, instant) {
      target = Math.max(0, Math.min(1, v));
      if (instant) {
        b = target;
        apply();
      }
    },
    update(dt, elapsed) {
      // Quán tính nhiệt dây tóc: nóng nhanh (~60 ms), nguội chậm hơn (~150 ms); LED tức thì.
      const tau = led ? 0.01 : target > b ? 0.06 : 0.15;
      b += (target - b) * (1 - Math.exp(-dt / tau));
      apply(elapsed);
    },
  };
}
