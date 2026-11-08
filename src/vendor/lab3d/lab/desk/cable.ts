import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createRubberMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import { accentColor, LAB_PALETTE, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';

/**
 * Loại dây: 'cable' dây điện/cáp tín hiệu (đen), 'gas' ống cao su dẫn khí đèn khí (cam đỏ), 'hose' ống cao su/nhựa mềm dẫn nước,
 * 'silicone' ống silicon ngà có vạch dòng chảy chạy được (`flow`). Ống đục (không transmission) để luôn thấy rõ trên mặt bàn.
 */
export type CableKind = 'cable' | 'gas' | 'hose' | 'silicone';

export interface CableOptions {
  kind?: CableKind;
  /** Bán kính ngoài (mm). Mặc định: cáp 3, ống khí 4, ống nước 4, silicon 3,5. */
  radius?: number;
  /** Màu thân (tên LAB_ACCENT hoặc mã). */
  color?: LabAccent | string;
  /** Màu vạch dòng chảy ('silicone'). */
  fluid?: string;
  /** Độ võng (đv cảnh) khi tạo từ hai đầu bằng `sagPoints`. */
  sag?: number;
}

export interface Cable {
  mesh: THREE.Mesh;
  curve: THREE.CatmullRomCurve3;
  /** Dựng lại theo điểm mới (toạ độ của cha) – dây bám theo dụng cụ đang kéo. */
  setPoints(pts: THREE.Vector3[]): void;
  /** Dựng lại từ hai đầu + độ võng (nằm trên mặt bàn y ≥ bán kính). */
  setEnds(a: THREE.Vector3, b: THREE.Vector3, sag?: number): void;
  /** Tốc độ vạch chạy dọc ống (vòng lặp vạch / giây, 0 = dừng) – 'silicone'. */
  flow(v: number): void;
  update(dt: number): void;
}

/**
 * Đường võng giữa hai đầu `a` → `b` (parabol, `n` điểm): giữa dây hạ `sag`, không xuống dưới `floor` (mặt bàn + bán kính dây).
 * Hai đầu có đoạn thẳng ngắn theo `dirA`/`dirB` (dây cắm thẳng vào ổ).
 */
export function sagPoints(a: THREE.Vector3, b: THREE.Vector3, sag = 0.3, o: { floor?: number; n?: number; dirA?: THREE.Vector3; dirB?: THREE.Vector3 } = {}): THREE.Vector3[] {
  const n = o.n ?? 9;
  const floor = o.floor ?? mm(3);
  const pts: THREE.Vector3[] = [];
  const a1 = o.dirA ? a.clone().addScaledVector(o.dirA, 0.12) : a;
  const b1 = o.dirB ? b.clone().addScaledVector(o.dirB, 0.12) : b;
  if (o.dirA) pts.push(a.clone());
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = a1.clone().lerp(b1, t);
    p.y = Math.max(floor, p.y - sag * 4 * t * (1 - t));
    pts.push(p);
  }
  if (o.dirB) pts.push(b.clone());
  return pts;
}

const RADIUS: Record<CableKind, number> = { cable: 3, gas: 4, hose: 4, silicone: 3.5 };
const COLOR: Record<CableKind, string> = { cable: LAB_PALETTE.trim, gas: '#d0542a', hose: '#3d6f8f', silicone: '#d9cfb4' };

/** A-DAY-CAP / A-ONG-DAN: dây mềm (cáp, ống cao su, ống silicon) đi qua các điểm (toạ độ của cha). */
export function createCable(ctx: Tracker, pts: THREE.Vector3[], o: CableOptions = {}): Cable {
  const kind = o.kind ?? 'cable';
  const r = mm(o.radius ?? RADIUS[kind]);
  const color = o.color ? accentColor(o.color) : COLOR[kind];
  let tex: THREE.Texture | null = null;
  let mat: THREE.Material;
  if (kind === 'silicone') {
    const { canvas, g } = makeCanvas(64, 16);
    g.fillStyle = color;
    g.fillRect(0, 0, 64, 16);
    g.fillStyle = o.fluid ?? '#c98a1e';
    g.fillRect(0, 0, 22, 16);
    tex = ctx.track(canvasTexture(canvas));
    tex.wrapS = THREE.RepeatWrapping;
    mat = ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }));
  } else if (kind === 'cable' && !o.color) mat = labMaterials(ctx).blackRubber();
  else mat = ctx.track(createRubberMaterial(color));
  const mesh = new THREE.Mesh(undefined, mat);
  mesh.name = `cable-${kind}`;
  mesh.castShadow = true;
  ctx.track(() => mesh.geometry.dispose());
  let speed = 0;
  const api: Cable = {
    mesh,
    curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'),
    setPoints(p) {
      api.curve = new THREE.CatmullRomCurve3(p, false, 'centripetal');
      const len = api.curve.getLength();
      mesh.geometry.dispose();
      mesh.geometry = new THREE.TubeGeometry(api.curve, Math.max(16, Math.min(240, Math.round(len * 60))), r, 10, false);
      if (tex) tex.repeat.set(Math.max(1, Math.round(len / 0.12)), 1);
    },
    setEnds(a, b, sag = o.sag ?? 0.3) {
      api.setPoints(sagPoints(a, b, sag, { floor: r }));
    },
    flow(v) {
      speed = v;
    },
    update(dt) {
      if (tex) tex.offset.x -= speed * dt;
    },
  };
  api.setPoints(pts);
  return api;
}
