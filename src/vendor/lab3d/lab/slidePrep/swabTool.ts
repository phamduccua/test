import * as THREE from 'three';
import {
  addPickProxy, applyPose, createGrabbable, createRubGesture, type DropZone, type DropZones, type Grabbable, type InteractCtx, type Pose,
  type RubGesture,
} from '../../interact/index';
import { mm } from '../units';

/** Chỗ chà tăm bông (một vùng thả của sim): mặt trong má, giọt trên lam, mặt thạch… */
export interface SwabSpot {
  /** Id vùng thả (createDropZones của sim) – tăm bông thả vào đây thì kéo qua lại = chà. */
  id: string;
  /** Tư thế tăm bông (hệ cha) khi chà lệch `off` −1…1 so với chỗ đặt (off = 0). */
  pose(off: number): Pose;
  /** Số lượt đổi chiều cho đủ (mặc định 3). */
  strokes?: number;
  hint?: string;
  /** Mỗi lượt đổi chiều: `n` = tổng lượt ở chỗ này (kể cả lượt quá mức – sim xét chà quá tay). */
  onStroke?(n: number): void;
  /** Tiến độ 0…1 (mỗi khi tăng). */
  onProgress?(k: number): void;
  /** Nhả tay sau khi đủ lượt (hoặc demo chà xong): tăm bông cầm lên được lại. */
  onDone?(n: number): void;
  /** Nhả tay khi chưa đủ lượt (lời nhắc, không tính là lỗi). */
  onShort?(n: number): void;
}

export interface SwabToolOptions {
  /** Tăm bông (createSwab().group – gốc ở đầu bông, que theo +y). */
  object: THREE.Object3D;
  zones: DropZones;
  home: Pose;
  /** Tên vật cho `zones.accepts` (mặc định 'swab'). */
  item?: string;
  heldRot?: THREE.Euler | null;
  spots: SwabSpot[];
  hint?(): string;
  blocked?(): string | null;
  /** Vừa cầm lên từ `from` ('home' / id vùng) – vd. đặt chỗ về khi thả ngoài vùng (`grab.setHome`). */
  onPick?(from: string): void;
  onPlace?(zone: DropZone | null): void;
}

export interface SwabTool {
  grab: Grabbable;
  /** Đang nằm ở: 'home' / id vùng (chỗ chà hoặc vùng khác). */
  readonly at: string;
  count(id: string): number;
  done(id: string): boolean;
  /** Demo: chà ở chỗ đang đặt tới khi đủ `strokes` lượt (cùng đường onMove/onStroke/onDone như tay). */
  rub(strokes: number, done?: () => void): void;
  /** Đặt ngay (làm lại / hoàn tác): tư thế, vùng đang nằm, số lượt đã chà mỗi chỗ. */
  reset(pose: Pose, at?: string, counts?: Record<string, number>): void;
}

/**
 * Tăm bông bằng tay: cầm – thả vào chỗ chà (vùng của sim) rồi KÉO QUA LẠI (createRubGesture) để cạo / dàn mẫu; đủ lượt thì nhả tay
 * là cầm lên mang đi được (tới chỗ chà sau, cốc bỏ…). Tổng lượt mỗi chỗ giữ lại để sim xét "chà quá tay". Rút từ TN-061-02.
 */
export function createSwabTool(ctx: InteractCtx, o: SwabToolOptions): SwabTool {
  const handle = addPickProxy((x) => ctx.track(x), o.object, new THREE.Vector3(mm(10), mm(150), mm(10)), new THREE.Vector3(0, mm(72), 0));
  const n: Record<string, number> = {};
  const fin: Record<string, boolean> = {};
  let at = 'home';
  let target = 0;
  const spot = (id: string) => o.spots.find((s) => s.id === id);
  const grab: Grabbable = createGrabbable(ctx, {
    object: o.object, item: o.item ?? 'swab', zones: o.zones, handle, heldRot: o.heldRot ?? null, lift: 0.15, home: o.home, priority: 1,
    hint: o.hint, blocked: o.blocked,
    enabled: () => !spot(at) || !!fin[at],
    onPick() {
      const from = at;
      at = 'held';
      o.onPick?.(from);
    },
    onPlace(z) {
      at = z?.id ?? 'home';
      o.onPlace?.(z);
    },
  });
  const rubs = new Map<string, RubGesture>();
  for (const s of o.spots) {
    const need = s.strokes ?? 3;
    let k0 = 0;
    const g = createRubGesture(ctx, {
      object: o.object, handle, axis: 'x', strokes: need, minStroke: 14, range: 60, priority: 2,
      enabled: () => at === s.id && !fin[s.id],
      hint: s.hint,
      onMove(off) {
        if (at === s.id) applyPose(o.object, s.pose(off));
      },
      onStroke() {
        n[s.id] = (n[s.id] ?? 0) + 1;
        s.onStroke?.(n[s.id]);
        const k = Math.min(1, n[s.id] / need);
        if (k > k0) s.onProgress?.((k0 = k));
      },
      onEnd(_k, cancelled) {
        if (cancelled || at !== s.id || fin[s.id]) return;
        if ((n[s.id] ?? 0) < Math.max(need, target)) return void (!target && s.onShort?.(n[s.id] ?? 0));
        fin[s.id] = true;
        target = 0;
        s.onDone?.(n[s.id]);
      },
    });
    rubs.set(s.id, g);
  }
  return {
    grab,
    get at() {
      return at;
    },
    count: (id) => n[id] ?? 0,
    done: (id) => !!fin[id],
    rub(strokes, done) {
      const id = at;
      const g = rubs.get(id);
      if (!g || fin[id]) return done?.();
      target = Math.max(strokes, spot(id)?.strokes ?? 3);
      const go = () => {
        if (fin[id]) return done?.();
        g.reset(0);
        g.auto(1.2, go);
      };
      go();
    },
    reset(pose, z = 'home', counts = {}) {
      rubs.forEach((g, id) => (g.cancel(), g.reset(Math.min(1, (counts[id] ?? 0) / (spot(id)?.strokes ?? 3)))));
      for (const s of o.spots) {
        n[s.id] = counts[s.id] ?? 0;
        fin[s.id] = n[s.id] >= (s.strokes ?? 3);
      }
      target = 0;
      at = z;
      grab.reset(pose, z === 'home' ? null : z);
    },
  };
}
