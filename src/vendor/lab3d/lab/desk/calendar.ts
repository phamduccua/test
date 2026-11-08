import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { labMaterials } from '../materials/kit';
import { accentColor, LAB_ACCENT, LAB_PALETTE, type LabAccent } from '../materials/palette';
import type { Tracker } from '../types';
import { mm } from '../units';
import { labText } from '../../text';

export interface DeskCalendarOptions {
  /** Dòng tiêu đề trên dải màu (vd. 'Tháng 4 / 1982'). */
  title?: string;
  /** Số ô ngày. Mặc định 7. */
  cells?: number;
  /** Màu dải tiêu đề + gáy. Mặc định 'red'. */
  color?: LabAccent | string;
  /** Rộng (mm). Mặc định 130. */
  width?: number;
}

export interface CalendarState {
  /** Số ngày đã qua (lẻ được – ô đang qua tô dở); null = chưa bắt đầu. */
  day: number | null;
  /** Số ngày định (các ô ≤ target viền đậm). */
  target?: number;
  /** Từ ngày này trở đi ô tô màu cảnh báo (cam) thay cho xanh. */
  warnAfter?: number;
  /** Chữ lớn (mặc định "Ngày 2,5" / "Chưa bắt đầu"). */
  headline?: string;
  /** Dòng ghi chú dưới các ô. */
  note?: string;
  /** Màu dòng ghi chú (mặc định xám; cảnh báo thì cam). */
  noteColor?: string;
}

export interface DeskCalendar {
  group: THREE.Group;
  /** Tâm mặt lịch (để gắn nhãn / camera). */
  face: THREE.Object3D;
  set(s: CalendarState): void;
}

const CW = 512;
const CH = 320;
const vi = (v: number) => v.toFixed(1).replace('.', ',');

/** A-LICH: lịch để bàn kiểu giá chữ A, gáy lò xo, đếm ngày ủ/ngày theo dõi bằng hàng ô tô dần. Gốc ở đáy, mặt hướng +z. */
export function createDeskCalendar(ctx: Tracker, o: DeskCalendarOptions = {}): DeskCalendar {
  const mats = labMaterials(ctx);
  const W = mm(o.width ?? 130);
  const H = W * 0.62;
  const accent = accentColor(o.color ?? 'red');
  const n = o.cells ?? 7;
  const group = new THREE.Group();
  group.name = 'desk-calendar';
  const { canvas, g } = makeCanvas(CW, CH);
  const tex = ctx.track(canvasTexture(canvas));
  const stand = new THREE.Group();
  stand.rotation.x = -0.32;
  stand.position.z = mm(6);
  group.add(stand);
  const face = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(W, H)), ctx.track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 })));
  face.position.set(0, H / 2 + mm(2), mm(1.6));
  stand.add(face);
  const back = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(W * 1.02, H * 1.04, mm(2.4))), mats.trim());
  back.position.set(0, H / 2 + mm(2), 0);
  back.castShadow = true;
  stand.add(back);
  // Gáy lò xo: dãy vòng kim loại trên mép trên.
  const ring = ctx.track(new THREE.TorusGeometry(mm(3), mm(0.7), 6, 14));
  for (let i = 0; i < 12; i++) {
    const r = new THREE.Mesh(ring, mats.steel());
    r.rotation.y = Math.PI / 2;
    r.position.set((i / 11 - 0.5) * W * 0.9, H + mm(2.5), mm(0.6));
    stand.add(r);
  }
  // Chân chống phía sau.
  const foot = new THREE.Mesh(ctx.track(new THREE.BoxGeometry(W * 1.02, mm(4), H * 0.5)), mats.plastic(accent));
  foot.position.set(0, mm(2), -H * 0.18);
  foot.castShadow = true;
  group.add(foot);

  let last = '';
  const api: DeskCalendar = {
    group,
    face,
    set(s) {
      const day = s.day ?? 0;
      const key = JSON.stringify({ ...s, day: Math.floor(day * 8) });
      if (key === last) return;
      last = key;
      g.fillStyle = LAB_PALETTE.label;
      g.fillRect(0, 0, CW, CH);
      g.fillStyle = accent;
      g.fillRect(0, 0, CW, 58);
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.font = 'bold 30px system-ui, sans-serif';
      g.fillText(o.title ?? labText('t_68bdd96a0a1f'), CW / 2, 40);
      g.fillStyle = LAB_PALETTE.trim;
      g.font = 'bold 54px system-ui, sans-serif';
      g.fillText(s.headline ?? (s.day === null ? labText('t_0929a19767d4') : `${labText('t_e196e19be238')}${vi(day)}`), CW / 2, 128);
      const cell = Math.min(58, (CW - 40) / n - 8);
      const x0 = (CW - n * (cell + 8) + 8) / 2;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * (cell + 8);
        const fill = Math.max(0, Math.min(1, day - i));
        g.fillStyle = '#e2dccd';
        g.fillRect(x, 160, cell, cell);
        g.fillStyle = s.warnAfter !== undefined && i >= s.warnAfter ? LAB_ACCENT.orange : LAB_ACCENT.green;
        g.fillRect(x, 160 + cell * (1 - fill), cell, cell * fill);
        const on = s.target !== undefined && i < s.target;
        g.strokeStyle = on ? LAB_PALETTE.trim : '#a8a294';
        g.lineWidth = on ? 4 : 2;
        g.strokeRect(x, 160, cell, cell);
        g.fillStyle = LAB_PALETTE.trim;
        g.font = `bold ${Math.round(cell * 0.45)}px system-ui, sans-serif`;
        g.fillText(String(i + 1), x + cell / 2, 160 + cell * 0.66);
      }
      if (s.note) {
        g.font = '24px system-ui, sans-serif';
        g.fillStyle = s.noteColor ?? '#3d4a58';
        g.fillText(s.note, CW / 2, 268);
      }
      tex.needsUpdate = true;
    },
  };
  api.set({ day: null });
  return api;
}
