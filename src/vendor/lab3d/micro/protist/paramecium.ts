import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { createContractileVacuole, createFoodVacuoles, pellicleMaterial, type ContractileVacuole } from './organelles';
import { ciliaAnchors, macronucleusGeometry, parameciumGeometry } from './parameciumShape';

/**
 * A-TRUNG-GIAY: trùng giày theo µm (dài 250 µm theo +x, mặt lưng +y) – thân bán trong viền đậm, lông bơi đập theo sóng,
 * nhân lớn hình hạt đậu + nhân bé (`nucleus`, gỡ ra/gắn lại được), 2 không bào co bóp có rãnh toả, không bào tiêu hoá trôi.
 * Trạng thái: `vit` (sức sống 0…1: tần số đập lông, nhịp không bào co bóp, dòng tế bào chất), `swell` (trương nước), `lysis` (vỡ tan).
 */
export interface ParameciumState {
  vit: number;
  swell: number;
  lysis: number;
}

export interface Paramecium {
  group: THREE.Group;
  /** Nhân lớn + nhân bé (con của `body` ở `nucleusHome` khi còn trong tế bào). */
  nucleus: THREE.Group;
  nucleusHome: THREE.Vector3;
  /** Khung chứa thân + bào quan (gắn nhân trở lại vào đây). */
  body: THREE.Group;
  state: ParameciumState;
  /** Chu kì không bào co bóp lúc khoẻ (s). */
  vacuolePeriod: number;
  update(dt: number): void;
}

interface Shared {
  body: THREE.BufferGeometry;
  macro: THREE.BufferGeometry;
  sphere: THREE.BufferGeometry;
  canal: THREE.BufferGeometry;
  cilium: THREE.BufferGeometry;
  mats: Record<'macro' | 'micro' | 'vac' | 'canal' | 'cilia' | 'granule', THREE.Material>;
  food: THREE.Material[];
}
const cache = new WeakMap<object, Shared>();

function shared(ctx: SimContext): Shared {
  let s = cache.get(ctx.track);
  if (s) return s;
  const std = (color: string, o: THREE.MeshStandardMaterialParameters = {}) => ctx.track(new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o }));
  const canal = ctx.track(new THREE.CylinderGeometry(1, 1.4, 20, 6, 1, true).translate(0, 10, 0));
  const cilium = ctx.track(new THREE.CylinderGeometry(0.5, 0.8, 1, 4, 1).translate(0, 0.5, 0));
  s = {
    body: ctx.track(parameciumGeometry()),
    macro: ctx.track(macronucleusGeometry()),
    sphere: ctx.track(new THREE.SphereGeometry(1, 16, 12)),
    canal,
    cilium,
    mats: {
      macro: std('#9c86cf', { roughness: 0.35 }),
      micro: std('#5b3d9c', { roughness: 0.35 }),
      vac: std('#c9ecff', { roughness: 0.15, emissive: '#5aa9d6', emissiveIntensity: 0.25 }),
      canal: std('#a8d8f5', { roughness: 0.2 }),
      cilia: std('#e4e9df', { roughness: 0.6 }),
      granule: std('#8d8a6c', { roughness: 0.7 }),
    },
    food: [std('#b5823f'), std('#7c9b45'), std('#a35d3a')],
  };
  cache.set(ctx.track, s);
  return s;
}

export function createParamecium(ctx: SimContext, o: { cilia?: number; seed?: number; color?: THREE.ColorRepresentation } = {}): Paramecium {
  const S = shared(ctx);
  const seed = o.seed ?? 1;
  const group = new THREE.Group();
  group.name = 'paramecium';
  const body = new THREE.Group();
  group.add(body);
  const pellMat = ctx.track(pellicleMaterial(o.color ?? '#c9d6aa'));
  const healthy = pellMat.color.clone();
  const sick = new THREE.Color('#b3a98a');
  const shell = new THREE.Mesh(S.body, pellMat);
  shell.renderOrder = 1;
  body.add(shell);

  const nucleus = new THREE.Group();
  nucleus.add(new THREE.Mesh(S.macro, S.mats.macro));
  const mic = new THREE.Mesh(S.sphere, S.mats.micro);
  mic.scale.setScalar(4.5);
  mic.position.set(2, 1, -12.5);
  nucleus.add(mic);
  const nucleusHome = new THREE.Vector3(6, -1, 2);
  nucleus.position.copy(nucleusHome);
  nucleus.rotation.y = 0.12;
  body.add(nucleus);

  const vacuoles: ContractileVacuole[] = [-1, 1].map((s) => {
    const v = createContractileVacuole(S.sphere, S.canal, S.mats.vac, S.mats.canal);
    v.group.position.set(s * 70, 13, -4);
    body.add(v.group);
    return v;
  });
  const food = createFoodVacuoles(S.sphere, S.food, 7, seed);
  body.add(food.group);

  // Hạt tế bào chất: tản ra khi tế bào vỡ.
  const GR = 70;
  const granules = new THREE.InstancedMesh(S.sphere, S.mats.granule, GR);
  const home: THREE.Vector3[] = [];
  let r = seed * 7919;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < GR; i++) home.push(new THREE.Vector3((rnd() * 2 - 1) * 95, (rnd() * 2 - 1) * 12, (rnd() * 2 - 1) * 18 - 3));
  ctx.track(() => granules.dispose());
  body.add(granules);

  const anchors = ciliaAnchors(o.cilia ?? 0);
  const cilia = anchors.length ? new THREE.InstancedMesh(S.cilium, S.mats.cilia, anchors.length) : null;
  if (cilia) {
    ctx.track(() => cilia.dispose());
    body.add(cilia);
  }
  const base = anchors.map((a) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.normal));

  const state: ParameciumState = { vit: 1, swell: 0, lysis: 0 };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const vPhase = [rnd(), rnd()];
  let beat = rnd() * 10;
  const p: Paramecium = {
    group,
    nucleus,
    nucleusHome,
    body,
    state,
    vacuolePeriod: 7,
    update(dt) {
      const { vit, swell, lysis } = state;
      const alive = lysis < 1e-3;
      // Trương nước: tròn ra theo bề ngang, ngắn lại chút.
      body.scale.set(1 - 0.15 * swell, 1 + 0.6 * swell, 1 + 0.8 * swell);
      pellMat.color.copy(healthy).lerp(sick, Math.min(1, (1 - vit) * 1.2 + swell * 0.3));
      pellMat.opacity = 0.55 * (1 - lysis);
      shell.visible = lysis < 0.98;
      const stalled = vit < 0.35;
      vacuoles.forEach((v, i) => {
        if (alive && !stalled) vPhase[i] = (vPhase[i] + dt / (p.vacuolePeriod / Math.max(0.2, vit))) % 1;
        v.setPhase(vPhase[i], stalled || !alive);
        v.group.visible = lysis < 0.4;
      });
      food.update(alive ? dt : 0, vit);
      food.group.visible = lysis < 0.6;
      nucleus.visible = lysis < 0.7 || nucleus.parent !== body;
      for (let i = 0; i < GR; i++) {
        pos.copy(home[i]).multiplyScalar(1 + lysis * 2.6);
        m.compose(pos, q.identity(), sc.setScalar(1.6 * (1 - 0.5 * lysis)));
        granules.setMatrixAt(i, m);
      }
      granules.instanceMatrix.needsUpdate = true;
      if (!cilia) return;
      cilia.visible = lysis < 0.3;
      // Sóng đập lệch pha dọc thân (metachronal); tần số thật ~20–30 Hz, hiển thị chậm lại ~3 Hz.
      beat += dt * 3 * Math.PI * 2 * vit;
      const amp = 0.75 * Math.min(1, vit * 1.4);
      anchors.forEach((a, i) => {
        const ph = beat - a.u * 9;
        const s = Math.sin(ph);
        q.setFromAxisAngle(a.axis, amp * (s > 0 ? s : s * 0.45)).multiply(base[i]);
        m.compose(a.pos, q, sc.set(1, 10 * (1 - 0.3 * (1 - vit)), 1));
        cilia.setMatrixAt(i, m);
      });
      cilia.instanceMatrix.needsUpdate = true;
    },
  };
  p.update(0);
  return p;
}
