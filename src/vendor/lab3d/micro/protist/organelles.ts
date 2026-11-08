import * as THREE from 'three';

/** Vật liệu thân tế bào trong trường sáng: bán trong, viền (pellicle) đậm hơn theo góc nhìn (fresnel). */
export function pellicleMaterial(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, transparent: true, opacity: 0.55, depthWrite: false });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
       gl_FragColor = vec4(outgoingLight * mix(1.0, 0.55, fres), diffuseColor.a * mix(0.45, 1.6, fres));`,
    );
  };
  return m;
}

export interface ContractileVacuole {
  group: THREE.Group;
  /** pha 0…1: 0–0,82 tâm trương (rãnh toả dồn nước vào, bọng to dần), 0,82–1 tâm thu (bọng xẹp, tống nước ra). */
  setPhase(ph: number, stalled: boolean): void;
}

/** Không bào co bóp + 8 rãnh toả hình sao (µm), nằm sát mặt lưng. */
export function createContractileVacuole(
  sphere: THREE.BufferGeometry,
  canalGeo: THREE.BufferGeometry,
  mat: THREE.Material,
  canalMat: THREE.Material,
): ContractileVacuole {
  const g = new THREE.Group();
  const bulb = new THREE.Mesh(sphere, mat);
  g.add(bulb);
  const canals: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 8) * Math.PI * 2 + 0.2;
    const c = new THREE.Mesh(canalGeo, canalMat);
    c.rotation.z = -Math.PI / 2 + 0.12;
    c.position.x = 4;
    pivot.add(c);
    g.add(pivot);
    canals.push(c);
  }
  return {
    group: g,
    setPhase(ph, stalled) {
      // Ngừng hoạt động (thiếu năng lượng): bọng căng to, không tống nước được.
      const fill = stalled ? 1.25 : ph < 0.82 ? 0.25 + 0.75 * (ph / 0.82) : 1 - (ph - 0.82) / 0.18;
      bulb.scale.setScalar(Math.max(0.12, fill) * 9);
      const canal = stalled ? 0.5 : ph < 0.82 ? 1.6 - 1.2 * (ph / 0.82) : 0.4 + 1.2 * ((ph - 0.82) / 0.18);
      canals.forEach((c) => c.scale.set(canal, 1, canal));
    },
  };
}

/** Không bào tiêu hoá trôi theo dòng tế bào chất (cyclosis) quanh một vòng elip trong thân. */
export interface FoodVacuoles {
  group: THREE.Group;
  update(dt: number, speed: number): void;
}

export function createFoodVacuoles(sphere: THREE.BufferGeometry, mats: THREE.Material[], count: number, seed: number): FoodVacuoles {
  const g = new THREE.Group();
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const items = Array.from({ length: count }, (_, i) => {
    const m = new THREE.Mesh(sphere, mats[i % mats.length]);
    m.scale.setScalar(4 + rnd() * 4);
    g.add(m);
    return { m, a: rnd() * Math.PI * 2, y: (rnd() - 0.5) * 14 };
  });
  return {
    group: g,
    update(dt, speed) {
      for (const it of items) {
        it.a += dt * speed * 0.35;
        const taper = Math.cos(it.a) < 0 ? 0.75 : 1;
        it.m.position.set(Math.cos(it.a) * 78, it.y, Math.sin(it.a) * 15 * taper - 3);
      }
    },
  };
}
