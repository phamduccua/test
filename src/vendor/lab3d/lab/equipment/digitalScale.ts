import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface DigitalScale {
  group: THREE.Group;
  /** Mặt đĩa cân (đặt vật lên đây). */
  panTop: THREE.Object3D;
  /** Hiển thị khối lượng (g) trên màn LCD. */
  setValue(grams: number): void;
}

/** A-CAN-DIEN-TU – cân điện tử: thân xám xanh (LAB_PALETTE.device) bo góc, đĩa inox Ø120, màn LCD CanvasTexture. */
export function createDigitalScale(ctx: Tracker, o: { decimals?: number; unit?: string } = {}): DigitalScale {
  const mats = labMaterials(ctx);
  const group = new THREE.Group();
  group.name = 'digital-scale';
  const W = mm(200);
  const D = mm(260);
  const H = mm(62);
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, mm(10)), mats.device());
  body.position.y = H / 2;
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(mm(14), mm(18), mm(8), 24), mats.darkPlastic());
  stem.position.set(0, H + mm(4), -mm(25));
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(mm(62), mm(60), mm(4), 64), mats.steel());
  pan.position.set(0, H + mm(10), -mm(25));
  pan.castShadow = pan.receiveShadow = true;
  group.add(stem, pan);
  const panTop = new THREE.Object3D();
  panTop.position.set(0, H + mm(12), -mm(25));
  group.add(panTop);

  // Bảng điều khiển nghiêng ở mặt trước
  const panel = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, mm(26), mm(10)), mats.darkPlastic());
  panel.position.set(0, H - mm(8), D / 2 - mm(16));
  panel.rotation.x = -0.9;
  group.add(panel);
  const { canvas, g } = makeCanvas(512, 128);
  const tex = canvasTexture(canvas);
  const lcdMat = ctx.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(mm(96), mm(24)), lcdMat);
  lcd.position.set(-mm(22), 0, mm(5.1));
  panel.add(lcd);
  for (let i = 0; i < 2; i++) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(mm(5), mm(5), mm(3), 16), i ? mats.bluePlastic() : mats.plastic('red'));
    btn.rotation.x = Math.PI / 2;
    btn.position.set(mm(46 + i * 18), 0, mm(5.5));
    panel.add(btn);
  }
  const dec = o.decimals ?? 2;
  const unit = o.unit ?? 'g';
  const setValue = (v: number) => {
    g.fillStyle = '#0d1a14';
    g.fillRect(0, 0, 512, 128);
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'rgba(120,255,200,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#7dffc4';
    g.font = '700 86px "DejaVu Sans Mono", ui-monospace, monospace';
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.fillText(v.toFixed(dec), 440, 68);
    g.font = '600 44px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText(unit, 452, 76);
    tex.needsUpdate = true;
  };
  setValue(0);
  return { group, panTop, setValue };
}
