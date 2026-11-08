import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createWoodMaterial } from '../materials/factories';
import type { Tracker } from '../types';

/**
 * Vỏ phòng làm việc thế kỉ 19 (thay `lab-room` của createLabStage): sàn gỗ, tường giấy dán hoa văn, ốp gỗ chân tường,
 * cửa sổ khung gỗ có ánh sáng ban ngày + rèm. Mặt bàn ở y = 0, đơn vị dm.
 */
export interface StudyRoomOptions {
  floorY?: number;
  backZ?: number;
  width?: number;
  /** Tâm cửa sổ theo x trên tường sau. */
  windowX?: number;
}

function wallpaper(): THREE.CanvasTexture {
  const { canvas, g } = makeCanvas(256, 256);
  g.fillStyle = '#5d6b4f';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(214,196,140,0.28)';
  // Hoa văn damask đơn giản: hình thoi + hoa bốn cánh.
  const motif = (x: number, y: number, s: number) => {
    g.beginPath();
    g.moveTo(x, y - s);
    g.quadraticCurveTo(x + s * 0.55, y, x, y + s);
    g.quadraticCurveTo(x - s * 0.55, y, x, y - s);
    g.fill();
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(x + Math.cos((k * Math.PI) / 2) * s * 0.42, y + Math.sin((k * Math.PI) / 2) * s * 0.42, s * 0.14, 0, Math.PI * 2);
      g.fill();
    }
  };
  motif(64, 64, 46);
  motif(192, 192, 46);
  g.fillStyle = 'rgba(30,24,16,0.12)';
  for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 1, 256);
  return canvasTexture(canvas, true, [1, 1]);
}

export function createStudyRoom(ctx: Tracker, o: StudyRoomOptions = {}): THREE.Group {
  const floorY = o.floorY ?? -9;
  const backZ = o.backZ ?? -4.6;
  const W = o.width ?? 60;
  const wx = o.windowX ?? -6;
  const g = new THREE.Group();
  g.name = 'study-room';
  const plane = (w: number, h: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(w, h)), mat);
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const floorMat = ctx.track(createWoodMaterial('#6b4426', '#3e2614', 21));
  floorMat.map!.wrapS = floorMat.map!.wrapT = THREE.RepeatWrapping;
  floorMat.map!.repeat.set(6, 6);
  const floor = plane(W, W, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, floorY, backZ + W / 2);

  const paper = ctx.track(wallpaper());
  paper.repeat.set(W / 5, 30 / 5);
  const wallMat = ctx.track(new THREE.MeshStandardMaterial({ map: paper, roughness: 0.85 }));
  const back = plane(W, 30, wallMat);
  back.position.set(0, floorY + 15, backZ);
  const side = plane(W, 30, wallMat);
  side.rotation.y = Math.PI / 2;
  side.position.set(-W * 0.35, floorY + 15, backZ + W / 2);

  // Ốp gỗ chân tường + gờ.
  const panel = ctx.track(createWoodMaterial('#5a3a20', '#2e1d10', 5));
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(w, h, d)), mat);
    m.position.set(x, y, z);
    m.receiveShadow = m.castShadow = true;
    g.add(m);
    return m;
  };
  box(W, 9.6, 0.12, 0, floorY + 4.8, backZ + 0.06, panel);
  box(W, 0.35, 0.3, 0, floorY + 9.7, backZ + 0.15, panel);

  // Cửa sổ: ô sáng (MeshBasic ngoài tone map), khung + song cửa, bậu, rèm hai bên.
  const wy = floorY + 18;
  const pane = new THREE.Mesh(
    ctx.track(new THREE.PlaneGeometry(7, 9)),
    ctx.track(new THREE.MeshBasicMaterial({ color: '#dfeefc', toneMapped: false })),
  );
  pane.position.set(wx, wy, backZ + 0.02);
  g.add(pane);
  const frame = ctx.track(createWoodMaterial('#e8dfcc', '#b9ab8e', 2));
  box(7.6, 0.4, 0.3, wx, wy + 4.6, backZ + 0.15, frame);
  box(7.6, 0.4, 0.3, wx, wy - 4.6, backZ + 0.15, frame);
  box(0.4, 9.6, 0.3, wx - 3.6, wy, backZ + 0.15, frame);
  box(0.4, 9.6, 0.3, wx + 3.6, wy, backZ + 0.15, frame);
  box(0.16, 9, 0.16, wx, wy, backZ + 0.1, frame);
  for (const dy of [-1.5, 1.5]) box(7, 0.14, 0.16, wx, wy + dy, backZ + 0.1, frame);
  box(8.4, 0.25, 0.8, wx, wy - 4.9, backZ + 0.4, frame);
  const curtain = ctx.track(new THREE.MeshStandardMaterial({ color: '#7a2f2a', roughness: 0.9 }));
  for (const s of [-1, 1]) {
    const geo = new THREE.CylinderGeometry(0.9, 0.9, 11, 18, 1, true, 0, Math.PI);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) * 0.3 + Math.sin(pos.getX(i) * 6) * 0.08);
    geo.computeVertexNormals();
    const c = new THREE.Mesh(ctx.track(geo), curtain);
    c.position.set(wx + s * 4.3, wy - 0.5, backZ + 0.5);
    c.castShadow = true;
    g.add(c);
  }
  // Ánh sáng ban ngày từ cửa sổ hắt chéo vào bàn.
  const day = new THREE.DirectionalLight('#dce9ff', 0.9);
  day.position.set(wx, wy, backZ + 1);
  day.target.position.set(0, 0, 0);
  g.add(day, day.target);
  return g;
}
