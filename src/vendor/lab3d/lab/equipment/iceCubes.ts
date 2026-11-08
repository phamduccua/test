import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { seededRandom } from '../solids/crystalFlakes';
import type { Tracker } from '../types';

export interface IceCubesOptions {
  count?: number;
  /** Cạnh viên đá (đv cảnh). */
  size?: number;
  /** Bán kính vùng xếp đá (đv) – trên mặt phẳng y = 0 cục bộ. */
  spread?: number;
  /** Hàm độ cao đáy tại bán kính r (đĩa lòng chảo). */
  floor?: (r: number) => number;
  seed?: number;
  /**
   * 'frosted' (mặc định): đá đục mờ nằm trong danh sách ĐỤC với alpha blending → nhìn thấy được XUYÊN QUA kính (chén, cốc).
   * 'clear': transmission thật (ior 1,31) – chỉ đẹp khi không có kính che phía trước.
   */
  look?: 'frosted' | 'clear';
}

export interface IceCubes {
  group: THREE.Group;
  /** 0 = nguyên, 1 = tan hết (co theo căn bậc ba thể tích, hạ xuống đáy). */
  setMelt(f: number): void;
}

/** A-DA-VIEN – đá viên: hộp bo cạnh méo nhiễu, MeshPhysical transmission (ior 1,31), tan dần. */
export function createIceCubes(ctx: Tracker, o: IceCubesOptions = {}): IceCubes {
  const n = o.count ?? 5;
  const size = o.size ?? 0.16;
  const spread = o.spread ?? size * 1.2;
  const floor = o.floor ?? (() => 0);
  const rnd = seededRandom(o.seed ?? 21);
  const clear = o.look === 'clear';
  const mat = ctx.track(
    new THREE.MeshPhysicalMaterial({
      color: clear ? 0xf4fbff : 0xe2f1ff,
      transmission: clear ? 1 : 0,
      ior: 1.31,
      roughness: clear ? 0.14 : 0.22,
      thickness: size * 0.8,
      attenuationColor: new THREE.Color(0xcfe9ff),
      attenuationDistance: size * 2.5,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.5,
      sheen: clear ? 0 : 0.6,
      sheenColor: new THREE.Color(0xbfe4ff),
    }),
  );
  if (!clear) {
    // Không `transparent` → vẽ vào render target transmission; CustomBlending giữ alpha (three không ép OPAQUE).
    mat.blending = THREE.CustomBlending;
    mat.blendSrc = THREE.SrcAlphaFactor;
    mat.blendDst = THREE.OneMinusSrcAlphaFactor;
    mat.opacity = 0.78;
  }
  const group = new THREE.Group();
  group.name = 'ice-cubes';
  const cubes: { mesh: THREE.Mesh; base: THREE.Vector3; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const geo = new RoundedBoxGeometry(1, 0.85 + rnd() * 0.25, 0.9 + rnd() * 0.2, 3, 0.16);
    const p = geo.attributes.position as THREE.BufferAttribute;
    const ph = rnd() * 10;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
      const w = 1 + 0.05 * Math.sin(x * 7 + ph) * Math.cos(z * 6 - ph) + 0.03 * Math.sin(y * 9 + ph);
      p.setXYZ(k, x * w, y * w, z * w);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(ctx.track(geo), mat);
    mesh.renderOrder = clear ? -1 : 3;
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    const r = i === 0 && n > 3 ? 0 : spread * (0.65 + rnd() * 0.35);
    mesh.rotation.set((rnd() - 0.5) * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.5);
    const base = new THREE.Vector3(Math.cos(a) * r, floor(r), Math.sin(a) * r);
    cubes.push({ mesh, base, r });
    group.add(mesh);
  }
  const ice: IceCubes = {
    group,
    setMelt(f) {
      const k = Math.cbrt(Math.max(0, 1 - f));
      for (const c of cubes) {
        const s = size * k;
        c.mesh.visible = k > 0.04;
        c.mesh.scale.setScalar(s);
        c.mesh.position.set(c.base.x * (0.6 + 0.4 * k), c.base.y + s * 0.45 + (c.r === 0 ? size * 0.35 * k : 0), c.base.z * (0.6 + 0.4 * k));
      }
    },
  };
  ice.setMelt(0);
  return ice;
}
