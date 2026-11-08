import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createPlasticMaterial } from '../materials/factories';
import type { Tracker } from '../types';
import { mm } from '../units';

/** A-KHOANH-KS: khoanh giấy kháng sinh Ø6 × 0,8 mm in mã thuốc + liều; gốc ở tâm mặt dưới. */
export interface DiscSpec {
  code: string;
  dose?: string;
  /** Màu vạch/mực của hãng (để phân biệt). */
  color?: string;
}

export function createAntibioticDisc(ctx: Tracker, d: DiscSpec): THREE.Mesh {
  const { canvas, g } = makeCanvas(128, 128);
  g.fillStyle = '#fbfaf5';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(150,140,120,${0.05 + Math.random() * 0.06})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1);
  }
  g.fillStyle = d.color ?? '#20242c';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${d.code.length > 2 ? 38 : 46}px system-ui, sans-serif`;
  g.fillText(d.code, 64, d.dose ? 54 : 64);
  if (d.dose) {
    g.fillStyle = '#20242c';
    g.font = 'bold 24px system-ui, sans-serif';
    g.fillText(d.dose.replace(' µg', '').replace(' IU', ' IU'), 64, 88);
  }
  const top = ctx.track(new THREE.MeshStandardMaterial({ map: ctx.track(canvasTexture(canvas)), roughness: 0.95 }));
  const edge = ctx.track(new THREE.MeshStandardMaterial({ color: '#f4f2ea', roughness: 1 }));
  const geo = ctx.track(new THREE.CylinderGeometry(mm(3), mm(3), mm(0.8), 32));
  geo.translate(0, mm(0.4), 0);
  const m = new THREE.Mesh(geo, [edge, top, edge]);
  m.name = `disc-${d.code}`;
  m.castShadow = true;
  return m;
}

/** Hộp đựng ống khoanh (cartridge): mỗi ống nhựa Ø12 × 40 mm đứng trên khay, nắp màu, nhãn mã thuốc. `tips` = miệng ống (toạ độ group). */
export function createDiscCartridges(ctx: Tracker, list: DiscSpec[]): { group: THREE.Group; tips: THREE.Vector3[]; setCodes(list: DiscSpec[]): void } {
  const group = new THREE.Group();
  group.name = 'disc-cartridges';
  const n = list.length;
  const pitch = mm(17);
  const tray = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(pitch * n + mm(8), mm(6), mm(24))), ctx.track(createPlasticMaterial('#e9edf1', 0.5)));
  tray.position.y = mm(3);
  tray.castShadow = tray.receiveShadow = true;
  group.add(tray);
  const body = ctx.track(createPlasticMaterial('#f4f6f8', 0.3));
  const tubeGeo = ctx.track(new THREE.CylinderGeometry(mm(6), mm(6), mm(40), 24));
  const capGeo = ctx.track(new THREE.CylinderGeometry(mm(6.6), mm(6.6), mm(7), 24));
  const tips: THREE.Vector3[] = [];
  const caps: THREE.Mesh[] = [];
  const tags: { tex: THREE.CanvasTexture; g: CanvasRenderingContext2D }[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * pitch;
    const tube = new THREE.Mesh(tubeGeo, body);
    tube.position.set(x, mm(26), 0);
    tube.castShadow = true;
    const cap = new THREE.Mesh(capGeo, ctx.track(createPlasticMaterial('#888', 0.4)));
    cap.position.set(x, mm(49.5), 0);
    const { canvas, g } = makeCanvas(64, 128);
    const tex = ctx.track(canvasTexture(canvas));
    const tag = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(mm(10), mm(20))), ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })));
    tag.position.set(x, mm(28), mm(6.1));
    group.add(tube, cap, tag);
    caps.push(cap);
    tags.push({ tex, g });
    tips.push(new THREE.Vector3(x, mm(53), 0));
  }
  const setCodes = (l: DiscSpec[]) =>
    l.forEach((d, i) => {
      if (!caps[i]) return;
      (caps[i].material as THREE.MeshStandardMaterial).color.set(d.color ?? '#888');
      const { g, tex } = tags[i];
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 64, 128);
      g.fillStyle = d.color ?? '#333';
      g.fillRect(0, 0, 64, 18);
      g.fillStyle = '#1d2128';
      g.textAlign = 'center';
      g.font = `bold ${d.code.length > 2 ? 22 : 28}px system-ui`;
      g.fillText(d.code, 32, 62);
      g.font = '15px system-ui';
      g.fillText(d.dose ?? '', 32, 92);
      tex.needsUpdate = true;
    });
  setCodes(list);
  return { group, tips, setCodes };
}
