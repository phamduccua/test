import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createPlasticMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface StopwatchView {
  group: THREE.Group;
  /** Hiển thị thời gian (s); `running` đổi màu chấm báo. */
  setTime(seconds: number, running?: boolean): void;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** < 1 giờ: "mm:ss.s"; từ 1 giờ (tua thời gian dài – cố định mẫu, ủ…): "h:mm:ss". */
const fmt = (s: number) => {
  if (s >= 3600) {
    const t = Math.floor(s);
    return `${Math.floor(t / 3600)}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`;
  }
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${pad(m)}:${r.toFixed(1).padStart(4, '0')}`;
};

/** A-DONG-HO-BAM-GIAY – đồng hồ bấm giờ điện tử (thân tròn dẹt, màn LCD, 3 nút). Đặt nghiêng trên bàn, gốc ở đáy. */
export function createStopwatch(ctx: Tracker, o: { color?: THREE.ColorRepresentation; title?: string } = {}): StopwatchView {
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'stopwatch';
  const R = mm(30);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, mm(12), 48), ctx.track(createPlasticMaterial(o.color ?? 0xe8543a, 0.4)));
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, mm(2), 10, 48), mats.darkPlastic());
  rim.position.z = mm(6);
  const { canvas, g } = makeCanvas(256, 128);
  const tex = ctx.track(canvasTexture(canvas));
  const lcdMat = ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 }));
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(mm(42), mm(21)), lcdMat);
  lcd.position.set(0, -mm(2), mm(6.1));
  const face = new THREE.Group();
  face.add(body, rim, lcd);
  for (const [x, y] of [[0, R + mm(3)], [-mm(18), R - mm(2)], [mm(18), R - mm(2)]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(mm(4), mm(4), mm(6), 16), mats.chrome());
    b.position.set(x, y, 0);
    b.rotation.z = -Math.atan2(x, y);
    face.add(b);
  }
  // Đặt đứng hơi ngả ra sau, đáy chạm bàn.
  face.position.y = R + mm(2);
  face.rotation.x = -0.35;
  group.add(face);
  let last = '';
  const draw = (text: string, running: boolean) => {
    g.fillStyle = '#b8c7a6';
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#a6b594';
    g.fillRect(0, 96, 256, 32);
    g.fillStyle = '#1d2418';
    g.font = '700 64px "DejaVu Sans Mono", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // "h:mm:ss" dài hơn "mm:ss.s" → nén ngang cho vừa màn LCD (định dạng cũ giữ nguyên).
    if (text.length > 7) g.fillText(text, 128, 54, 236);
    else g.fillText(text, 128, 54);
    g.font = '600 20px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText(o.title ?? 'STOPWATCH', 12, 112);
    g.fillStyle = running ? '#c0261a' : '#4c5a40';
    g.beginPath();
    g.arc(236, 112, 7, 0, Math.PI * 2);
    g.fill();
    tex.needsUpdate = true;
  };
  const api: StopwatchView = {
    group,
    setTime(s, running = false) {
      const text = fmt(s);
      const key = text + running;
      if (key === last) return;
      last = key;
      draw(text, running);
    },
  };
  api.setTime(0);
  return api;
}
