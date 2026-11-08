import * as THREE from 'three';
import { chaikin, densify } from '../glassware/curves';
import { buildProfile } from '../glassware/profile';
import { createVessel, type Vessel } from '../glassware/vessel';
import { createLiquid, type Liquid } from '../liquid/liquid';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { createPlasticMaterial } from '../materials/factories';
import { labMaterials } from '../materials/kit';
import { accentColor, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';
import { createDropper } from './dropper';

/**
 * Kiểu chai: 'bottle' = chai hoá chất cổ hẹp nắp vặn (mặc định, Ø62 × 120), 'dropper' = lọ nhỏ giọt có ống hút cắm sẵn (Ø46 × 92),
 * 'plastic' = chai nhựa trong PET nắp cao (Ø56 × 130), 'wide' = lọ miệng rộng đựng chất rắn (Ø62 × 90).
 */
export type ReagentBottleStyle = 'bottle' | 'dropper' | 'plastic' | 'wide';

export interface ReagentBottleOptions {
  style?: ReagentBottleStyle;
  label?: string;
  sublabel?: string;
  /** Màu dải trên nhãn (mặc định xanh lam). */
  labelStripe?: LabAccent | string;
  amber?: boolean;
  /** Màu nắp: mã màu hoặc tên LAB_ACCENT ('red', 'blue'…). */
  capColor?: THREE.ColorRepresentation | LabAccent;
  /** Nắp: 'on' (mặc định) đậy, 'side' = mở, đặt nằm cạnh chai (+x), 'none' = ẩn. */
  capPlacement?: 'on' | 'side' | 'none';
  liquidColor?: THREE.ColorRepresentation;
  liquidOpacity?: number;
  /** Phần thể tích đã đổ đầy 0…1. */
  fill?: number;
  diameter?: number;
  height?: number;
  /** Chất rắn (bột) trong chai thay cho dung dịch: màu + phần chiều cao 0…1. */
  solidColor?: THREE.ColorRepresentation;
  solidFill?: number;
  /** Kiểu 'dropper': màu quả bóp ống hút cắm sẵn (mặc định 'black'); false = không tạo ống hút. */
  dropper?: 'red' | 'black' | false;
}

export interface ReagentBottle {
  group: THREE.Group;
  vessel: Vessel;
  liquid: Liquid | null;
  /** Nắp vặn (con của `group`) – mở nắp: setCap('side') hoặc tự đổi position/rotation/ẩn. Kiểu 'dropper': vòng cổ màu. */
  cap: THREE.Mesh;
  /** Tâm miệng chai. */
  mouth: THREE.Object3D;
  /** Chỗ đầu nhọn ống hút nằm khi cắm trong chai (cục bộ group) – dùng làm `rest` cho thao tác ống hút. */
  dropperRest: THREE.Object3D;
  /** Ống hút cắm sẵn (kiểu 'dropper'), gốc ở đầu nhọn tại dropperRest; null nếu không có. */
  dropper: THREE.Group | null;
  setCap(state: 'on' | 'side' | 'none'): void;
  setCapColor(c: THREE.ColorRepresentation | LabAccent): void;
  /** Vẽ lại nhãn (nếu chai có nhãn). */
  setLabel(text: string, sublabel?: string, stripe?: LabAccent | string): void;
}

const P = (r: number, y: number) => ({ r: mm(r), y: mm(y) });
const hex = (c: THREE.ColorRepresentation | LabAccent) => (typeof c === 'string' ? accentColor(c) : c);
const STYLE = {
  bottle: { d: 62, h: 120, neck: 11, capH: 20 },
  dropper: { d: 46, h: 92, neck: 8, capH: 9 },
  plastic: { d: 56, h: 130, neck: 12, capH: 24 },
  wide: { d: 62, h: 90, neck: 0, capH: 16 },
} as const;

/** A-KE-HOA-CHAT – chai hoá chất nắp vặn (nhãn giấy CanvasTexture). Gốc ở đáy. */
export function createReagentBottle(ctx: Tracker, o: ReagentBottleOptions = {}): ReagentBottle {
  const mats = labMaterials(ctx);
  const style = o.style ?? 'bottle';
  const S = STYLE[style];
  const R = (o.diameter ?? S.d) / 2;
  const H = o.height ?? S.h;
  const rn = style === 'wide' ? R * 0.72 : style === 'bottle' ? 11 : Math.min(S.neck, R * 0.5);
  const outline = style === 'wide'
    ? [P(0, 0), P(R - 4, 0), P(R, 3), P(R, H * 0.8), P(R - 3, H * 0.86), P(rn, H * 0.9), P(rn, H)]
    : [P(0, 0), P(R - 4, 0), P(R, 3), P(R, H * 0.7), P(R - 2, H * 0.8), P(rn + 1, H * 0.9), P(rn, H * 0.93), P(rn, H)];
  const profile = buildProfile(densify(chaikin(outline, 3), mm(3)), mm(style === 'plastic' ? 1.2 : 2.2));
  const material = o.amber ? mats.amberGlass() : style === 'plastic' ? mats.clearPlastic() : mats.thickGlass();
  const vessel = createVessel(ctx, profile, { material, name: 'reagent-bottle' });
  const group = vessel.group;
  const fillH = H * (style === 'wide' ? 0.78 : 0.68);
  let liquid: Liquid | null = null;
  if (o.liquidColor !== undefined) {
    liquid = createLiquid(ctx, profile, {
      level: mm(fillH * (o.fill ?? 0.7)),
      color: o.liquidColor,
      opacity: o.liquidOpacity ?? 0.5,
      meniscus: mm(1.5),
    });
    group.add(liquid.mesh);
  }
  if (o.solidColor !== undefined) {
    const h = mm(fillH * (o.solidFill ?? 0.5));
    const r = mm(R) - profile.wall - mm(0.6);
    const pts = [new THREE.Vector2(0, profile.innerBottom), new THREE.Vector2(r, profile.innerBottom), new THREE.Vector2(r, h), new THREE.Vector2(r * 0.6, h + mm(2)), new THREE.Vector2(0, h + mm(3))];
    const solid = new THREE.Mesh(ctx.track(new THREE.LatheGeometry(pts, 32)), ctx.track(new THREE.MeshStandardMaterial({ color: o.solidColor, roughness: 1 })));
    group.add(solid);
  }
  const capMat = ctx.track(createPlasticMaterial(hex(o.capColor ?? 0x1f5fbf), 0.45));
  const cr = style === 'bottle' ? 13.5 : rn + 2.5;
  const capH = S.capH;
  const cap = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(cr), mm(cr), mm(capH), 32, 1, style === 'dropper')), capMat);
  if (style === 'dropper') capMat.side = THREE.DoubleSide;
  cap.castShadow = true;
  group.add(cap);
  // Nắp đậy: chai thường tâm nắp ở H + 4 mm (giữ như bản cũ); kiểu khác đáy trong nắp chạm miệng.
  const capY = style === 'bottle' ? mm(H) + mm(4) : style === 'dropper' ? mm(H - capH / 2 + 1) : mm(H + capH / 2 - 3);
  const setCap = (s: 'on' | 'side' | 'none') => {
    cap.visible = s !== 'none';
    if (s === 'side' && style !== 'dropper') {
      cap.position.set(mm(R + cr + 8), mm(cr), mm(R * 0.3));
      cap.rotation.set(Math.PI / 2, 0, 0);
    } else {
      cap.position.set(0, capY, 0);
      cap.rotation.set(0, 0, 0);
    }
  };
  setCap(o.capPlacement ?? 'on');
  const mouth = new THREE.Object3D();
  mouth.name = 'bottle-mouth';
  mouth.position.y = mm(H);
  group.add(mouth);
  const dropperRest = new THREE.Object3D();
  dropperRest.name = 'dropper-rest';
  dropperRest.position.y = Math.max(profile.innerBottom + mm(4), mm(H - 45));
  group.add(dropperRest);
  let dropper: THREE.Group | null = null;
  if (style === 'dropper' && o.dropper !== false) {
    dropper = createDropper(ctx, { bulbColor: o.dropper ?? 'black' });
    dropper.position.copy(dropperRest.position);
    group.add(dropper);
  }
  let draw = (_t: string, _s?: string, _c?: string) => {};
  if (o.label) {
    const { canvas, g } = makeCanvas(512, 256);
    const tex = ctx.track(canvasTexture(canvas));
    draw = (text, sub, stripe) => {
      g.fillStyle = '#f7f3e8';
      g.fillRect(0, 0, 512, 256);
      g.fillStyle = accentColor(stripe ?? '#1f5fbf');
      g.fillRect(0, 0, 512, 34);
      g.fillStyle = '#1b1f27';
      g.font = `700 ${Math.min(92, Math.round(1000 / Math.max(4, text.length)))}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, 256, 120);
      g.font = '500 40px system-ui, sans-serif';
      g.fillStyle = '#4a5160';
      if (sub) g.fillText(sub, 256, 200);
      tex.needsUpdate = true;
    };
    draw(o.label, o.sublabel, o.labelStripe);
    const mat = ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    const arc = 1.7;
    const lh = style === 'wide' ? H * 0.42 : H * 0.36;
    const label = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(mm(R + 0.4), mm(R + 0.4), mm(lh), 32, 1, true, -arc / 2, arc)), mat);
    label.position.y = mm(style === 'wide' ? H * 0.4 : H * 0.36);
    group.add(label);
  }
  return {
    group, vessel, liquid, cap, mouth, dropperRest, dropper, setCap,
    setCapColor: (c) => void capMat.color.set(hex(c)),
    setLabel: (t, s, c) => draw(t, s, c),
  };
}
