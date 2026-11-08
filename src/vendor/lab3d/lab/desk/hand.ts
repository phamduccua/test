import * as THREE from 'three';
import type { Tracker } from '../types';
import { mm } from '../units';
import { handMaterial, type GloveKind } from './handMaterial';
import { buildHandMesh } from './handMesh';
import { aimThumb, solvePose, type HandPose, type PoseParams, type ThumbMode } from './handPoses';
import { FINGERS, fingerTip, PALM_HALF } from './handSolve';

export type { HandPose, ThumbMode } from './handPoses';
export type HandAnchor = 'wrist' | 'grip' | 'pinch' | 'tip' | 'palm';

export interface HandOptions {
  side?: 'right' | 'left';
  /** Găng: 'none' (da tay), 'nitrile' (xanh), 'latex' (kem), 'purple', hoặc mã màu. */
  glove?: GloveKind;
  /** Màu da (khi không đeo găng). */
  skin?: string;
  pose?: HandPose;
  /** Bán kính vật nắm (mm) cho 'grip'. Mặc định 10. */
  grip?: number;
  /** Bề dày vật kẹp (mm) cho 'pinch'. Mặc định 2. */
  width?: number;
  /** Ngón cái khi nắm: quấn ngang ('wrap'), đặt dọc vật ('along', cầm cán que/bút), bịt đầu vật ('cap', bịt miệng ống). */
  thumb?: ThumbMode;
  /** 'cap': từ tâm nắm tới đầu vật phía ngón cái (mm). */
  reach?: number;
  /** Cẳng tay dài (mm, 0 = chỉ bàn tay). Mặc định 110. */
  arm?: number;
  /** Tay áo blouse (màu, mặc định không có). */
  sleeve?: string | false;
  /** Tỉ lệ so với tay người lớn (dài 185 mm). Sim thường thu 0,6–0,8 cho khỏi che dụng cụ. */
  size?: number;
  /** Gốc của `group` đặt tại neo nào (mặc định 'grip' – gắn tay vào vật: `tool.add(hand.group)`). */
  origin?: HandAnchor;
  visible?: boolean;
}

export interface Hand {
  group: THREE.Group;
  /** Neo (con của `group`, không bị scale): grip = tâm vật nắm (trục vật dọc x), pinch = giữa hai bụng ngón cái–trỏ (trục z = phương kẹp, vật dẹt đặt mặt phẳng xy), tip = đầu ngón trỏ, palm = giữa lòng bàn tay, wrist = cổ tay. */
  anchors: Record<HandAnchor, THREE.Object3D>;
  readonly pose: HandPose;
  /** Đổi tư thế (`duration` giây, 0 = tức thì – có thời gian thì gọi `update(dt)`). */
  setPose(pose: HandPose, o?: Partial<PoseParams> & { duration?: number }): void;
  /** Gập cổ tay: `flex` (rad, dương = cẳng tay ngả về sau mu tay), `tilt` (rad, nghiêng sang phía ngón út). */
  setWrist(flex: number, tilt?: number): void;
  setVisible(on: boolean): void;
  update(dt: number): void;
}

/** A-BAN-TAY: bàn tay người (da hoặc găng) có khớp ngón, 5 tư thế, tay trái/phải, neo để gắn dụng cụ. Đơn vị dm, số đo thật theo mm. */
export function createHand(ctx: Tracker, o: HandOptions = {}): Hand {
  const mat = handMaterial(ctx, o.glove ?? 'none', o.skin);
  const group = new THREE.Group();
  group.name = 'hand';
  const body = new THREE.Group();
  const s = mm(o.size ?? 1);
  body.scale.set(o.side === 'left' ? -s : s, s, s);
  group.add(body);
  const { fingers, thumb, forearm } = buildHandMesh(ctx, body, mat, o);
  const anchors = Object.fromEntries((['wrist', 'grip', 'pinch', 'tip', 'palm'] as HandAnchor[]).map((k) => {
    const a = new THREE.Object3D();
    a.name = `hand-${k}`;
    group.add(a);
    return [k, a];
  })) as Record<HandAnchor, THREE.Object3D>;

  const params: PoseParams = { grip: o.grip ?? 10, width: o.width ?? 2, thumb: o.thumb ?? 'wrap', reach: o.reach ?? 40 };
  type Target = { q: THREE.Quaternion[]; pts: Record<HandAnchor, THREE.Vector3>; pinchQ: THREE.Quaternion };
  const all = [...fingers.flatMap((c) => [c.root, ...c.joints]), thumb.root, ...thumb.joints];
  let from: THREE.Quaternion[] = all.map((x) => x.quaternion.clone());
  let goal: Target | null = null;
  let start: Target | null = null;
  let t = 1;
  let dur = 0;
  let pose: HandPose = o.pose ?? 'relaxed';
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const solve = (): Target => {
    const sol = solvePose(pose, params);
    const q: THREE.Quaternion[] = [];
    sol.fingers.forEach((f) => {
      q.push(new THREE.Quaternion().setFromAxisAngle(Z, f.spread));
      for (const c of f.curl) q.push(new THREE.Quaternion().setFromAxisAngle(X, -c));
    });
    const th = aimThumb(sol.thumb);
    q.push(th.q, ...th.curl.map((c) => new THREE.Quaternion().setFromAxisAngle(X, -c)));
    const n = sol.pinch.normal.clone();
    if (o.side === 'left') n.x = -n.x;
    return {
      q,
      pts: { wrist: new THREE.Vector3(), grip: sol.grip, pinch: sol.pinch.point, tip: fingerTip(FINGERS[0], sol.fingers[0]), palm: new THREE.Vector3(0, 50, -PALM_HALF) },
      pinchQ: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n),
    };
  };
  const tmp = new THREE.Vector3();
  const apply = (k: number) => {
    const e = k * k * (3 - 2 * k);
    all.forEach((j, i) => j.quaternion.slerpQuaternions(from[i], goal!.q[i], e));
    for (const key of Object.keys(anchors) as HandAnchor[]) {
      const p = start ? tmp.lerpVectors(start.pts[key], goal!.pts[key], e) : tmp.copy(goal!.pts[key]);
      anchors[key].position.copy(p).multiply(body.scale);
    }
    anchors.pinch.quaternion.copy(start ? start.pinchQ : goal!.pinchQ).slerp(goal!.pinchQ, start ? e : 1);
    // Đặt gốc group vào neo đã chọn.
    const origin = anchors[o.origin ?? 'grip'].position.clone();
    body.position.copy(origin).negate();
    for (const a of Object.values(anchors)) a.position.sub(origin);
  };
  const hand: Hand = {
    group,
    anchors,
    get pose() {
      return pose;
    },
    setPose(p, opt = {}) {
      pose = p;
      Object.assign(params, Object.fromEntries(Object.entries(opt).filter(([k, v]) => k !== 'duration' && v !== undefined)));
      start = goal;
      from = all.map((x) => x.quaternion.clone());
      goal = solve();
      dur = opt.duration ?? 0;
      t = dur > 0 && start ? 0 : 1;
      apply(t);
    },
    setWrist(flex, tilt = 0) {
      forearm.rotation.set(flex, 0, -tilt);
    },
    setVisible(on) {
      group.visible = on;
    },
    update(dt) {
      if (t >= 1 || !goal) return;
      t = Math.min(1, t + dt / dur);
      apply(t);
    },
  };
  hand.setPose(pose);
  group.visible = o.visible ?? true;
  return hand;
}
