import * as THREE from 'three';
import { createRubberMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import type { LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';
import { createIceCubes, type IceCubes } from './iceCubes';
import { boxAdder } from './parts';

/**
 * A-THUNG-XOP / A-HOP-DA: thùng xốp cách nhiệt (ủ sữa chua, giữ lạnh) hoặc hộp đá thành thấp – đáy + 4 thành + nắp rời; thành trước cắt thấp
 * (`cutaway`) để thấy đồ bên trong; nước đá (`water`) + đá viên (`ice`) tuỳ chọn. Màu xốp ngà (LAB_PALETTE.foam) + băng dính màu nhận diện
 * quanh miệng; `color` = thùng nhựa giữ lạnh màu. Gốc = tâm đáy ngoài, mặt trước +z. Mặc định 30 × 22 × 20 cm.
 */
export interface FoamBoxOptions {
  width?: number;
  depth?: number;
  height?: number;
  /** Bề dày thành (mặc định 1/12 chiều nhỏ nhất, ≥ 6 mm). */
  wall?: number;
  /** Có nắp (mặc định true). */
  lid?: boolean;
  /** Thành trước luôn thấp: phần chiều cao 0…1 (hộp đá TN-095-01 = 0,62). */
  front?: number;
  /** Mực nước đá: phần chiều cao 0…1 (mặc định không có nước). */
  water?: number;
  /** Số viên đá (0 = không có). */
  ice?: number;
  /** Cạnh viên đá (mặc định theo cỡ hộp). */
  iceSize?: number;
  /** Tâm đống đá (x, z cục bộ) – mặc định lệch phải để chừa chỗ cắm ống. */
  iceAt?: [number, number];
  seed?: number;
  /** Màu băng dính quanh miệng (false = không có). */
  tape?: LabAccent | string | false;
  /** Thùng nhựa màu (thay cho xốp) – tên LAB_ACCENT hoặc mã màu. */
  color?: LabAccent | string;
}

export interface FoamBox {
  group: THREE.Group;
  /** Nắp (null nếu `lid: false`). */
  lid: THREE.Mesh | null;
  /** Lòng hộp: kích thước trong + mặt đáy trong (cục bộ). */
  inner: { width: number; depth: number; floorY: number };
  /** Chỗ đặt mặc định (đáy trong, lệch trái – đối diện đống đá). */
  slot: THREE.Vector3;
  /** cols × rows chỗ đặt lọ trên đáy trong, bước `pitch`. */
  grid(cols: number, rows: number, pitch?: number): THREE.Vector3[];
  /** Mặt nước (cục bộ; = đáy trong nếu không có nước). */
  waterY: number;
  ice: IceCubes | null;
  /** Vị trí nắp đậy / đặt nắp xuống bàn cạnh thùng (cục bộ). */
  lidClosed: THREE.Vector3;
  lidOpen: { pos: THREE.Vector3; rot: THREE.Euler };
  /** Mở/đóng nắp ngay (đặt nắp cạnh thùng). */
  setLid(open: boolean): void;
  /** Cắt thấp thành trước để thấy bên trong. */
  setCutaway(on: boolean): void;
  /** Ánh ấm bên trong khi đang ủ (0…1). */
  setWarm(k: number): void;
}

export function createFoamBox(ctx: Tracker, o: FoamBoxOptions = {}): FoamBox {
  const W = o.width ?? 3;
  const D = o.depth ?? 2.2;
  const H = o.height ?? 2;
  const T = o.wall ?? Math.max(mm(6), Math.min(W, D, H) / 12);
  const group = new THREE.Group();
  group.name = 'foam-box';
  const mats = labMaterials(ctx);
  // Xốp trầm hơn LAB_PALETTE.foam một bậc: dưới preset bench + máy chiếu, xốp ngà nhạt chìm vào mặt bàn trắng.
  const body = o.color ? mats.plastic(o.color) : ctx.track(createRubberMaterial('#bfb394'));
  const cutMat = o.color ? mats.trim() : ctx.track(new THREE.MeshStandardMaterial({ color: '#8f8468', roughness: 1 }));
  const box = boxAdder(ctx, group, Math.min(0.015, T / 3));
  box(W, T, D, 0, T / 2, 0, body);
  box(W, H, T, 0, H / 2, -D / 2 + T / 2, body);
  for (const s of [-1, 1]) box(T, H, D - 2 * T, s * (W / 2 - T / 2), H / 2, 0, body);
  const fh = H * (o.front ?? 1);
  const frontFull = box(W, fh, T, 0, fh / 2, D / 2 - T / 2, body);
  const lowH = Math.min(fh, Math.max(T * 1.5, H * 0.2));
  const frontLow = box(W, lowH, T, 0, lowH / 2, D / 2 - T / 2, body);
  frontLow.visible = false;
  // Mặt cắt (vệt tối trên mép thành thấp) để đọc ra là đã cắt.
  const cutEdge = box(W, mm(3), T * 0.9, 0, lowH, D / 2 - T / 2, cutMat);
  cutEdge.visible = false;
  // Băng dính màu quanh miệng thùng (cả thành trước, kể cả khi thấp) + một dải dán ngang nắp.
  const tape = o.tape ?? (o.color ? false : 'blue');
  const tm = tape ? mats.plastic(tape) : null;
  const bh = Math.min(mm(40), H * 0.18);
  if (tm) {
    const y = H - bh / 2 - mm(4);
    box(W + mm(2), bh, mm(1.5), 0, y, -D / 2 - mm(0.5), tm);
    for (const s of [-1, 1]) box(mm(1.5), bh, D + mm(2), s * (W / 2 + mm(0.5)), y, 0, tm);
    box(W + mm(2), bh, mm(1.5), 0, fh - bh / 2 - mm(4) - fh / 2, T / 2 + mm(0.5), tm, frontFull);
  }
  const lidThick = Math.max(T, mm(8));
  const lidClosed = new THREE.Vector3(0, H + lidThick / 2, 0);
  const lid = o.lid === false ? null : box(W + mm(4), lidThick, D + mm(4), lidClosed.x, lidClosed.y, lidClosed.z, o.color ? mats.instrument() : body);
  if (lid && tm) box(Math.min(mm(50), W * 0.2), mm(1.5), D + mm(6), 0, lidThick / 2 + mm(0.5), 0, tm, lid);
  const lidOpen = { pos: new THREE.Vector3(W + 0.25, lidThick / 2 + mm(1), 0.1), rot: new THREE.Euler(0, 0.2, 0) };
  // Nước *transparent* để ống/lọ (transmission) bên trong vẫn hiện.
  const iw = W - 2 * T;
  const id = D - 2 * T;
  const waterY = o.water ? T + (H - T) * o.water : T;
  if (o.water) {
    const water = new THREE.Mesh(
      ctx.track(new THREE.BoxGeometry(iw - mm(1), waterY - T, id - mm(1))),
      ctx.track(new THREE.MeshPhysicalMaterial({ color: 0x9cc8e4, roughness: 0.08, transparent: true, opacity: 0.26, depthWrite: false })),
    );
    water.position.y = T + (waterY - T) / 2;
    water.renderOrder = 1;
    group.add(water);
  }
  let ice: IceCubes | null = null;
  if (o.ice) {
    const size = o.iceSize ?? Math.min(mm(24), Math.min(iw, id) / 4);
    ice = createIceCubes(ctx, { count: o.ice, size, spread: Math.min(iw, id) * 0.3, seed: o.seed ?? 5 });
    const [ix, iz] = o.iceAt ?? [iw * 0.18, 0];
    ice.group.position.set(ix, o.water ? waterY - size * 0.6 : T, iz);
    group.add(ice.group);
  }
  const warm = new THREE.PointLight('#ffb35c', 0, Math.max(W, H) * 0.9, 2);
  warm.position.set(0, H * 0.7, 0);
  group.add(warm);
  return {
    group,
    lid,
    inner: { width: iw, depth: id, floorY: T },
    slot: new THREE.Vector3(o.ice ? -iw * 0.25 : 0, T, 0),
    grid(cols, rows, pitch = Math.min(iw / cols, id / rows)) {
      const out: THREE.Vector3[] = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(new THREE.Vector3((c - (cols - 1) / 2) * pitch, T, (r - (rows - 1) / 2) * pitch));
      return out;
    },
    waterY,
    ice,
    lidClosed,
    lidOpen,
    setLid(open) {
      if (!lid) return;
      lid.position.copy(open ? lidOpen.pos : lidClosed);
      lid.rotation.copy(open ? lidOpen.rot : new THREE.Euler());
    },
    setCutaway(on) {
      frontFull.visible = !on;
      frontLow.visible = cutEdge.visible = on;
    },
    setWarm(k) {
      warm.intensity = 1.2 * k;
    },
  };
}
