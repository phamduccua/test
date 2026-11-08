import * as THREE from 'three';
import { pointerHub } from '../interact/index';
import type { SimContext } from '../sim/types';
import { labText } from '../text';
import type { HPose } from './types';

/** Vùng đi được (đơn vị cảnh = mét): khung chữ nhật + các khối cản (công trình, tường, mặt nước). */
export interface WalkArea {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Khối cản hình hộp theo trục (tâm x, z; rộng w, sâu d). */
  blocks: { x: number; z: number; w: number; d: number }[];
  /** Tầm mắt (m). */
  eye: number;
  /** Tư thế "Toàn cảnh" (nhìn từ trên cao). */
  overview: HPose;
}

export type WalkMode = 'walk' | 'overview';

const WALK = 3.2; // m/s
const RUN = 8;
const TURN = 1.5; // rad/s
const BODY = 0.45; // bán kính người đi

/**
 * Đi bộ góc nhìn thứ nhất: nút ▲ ▼ ◀ ▶ trên khung (giữ để đi), phím W A S D / mũi tên (Shift chạy), kéo chuột để nhìn quanh;
 * không đi xuyên khối cản. "Toàn cảnh" bay lên cao, quay lại "Đi bộ" về đúng chỗ cũ. `goTo` tự đi tới một điểm học tập.
 */
export function createWalk(ctx: SimContext, area: WalkArea, o: { calm(): boolean; onStep?(speed: number): void; onMode?(m: WalkMode): void }) {
  const cam = ctx.camera;
  const ctl = ctx.controls;
  const hub = pointerHub(ctx);
  const held = new Set<string>();
  let mode: WalkMode = 'walk';
  let saved: HPose | null = null;
  let travel: (() => void) | null = null;
  const dir = new THREE.Vector3();

  const blocked = (x: number, z: number) =>
    x < area.minX + BODY || x > area.maxX - BODY || z < area.minZ + BODY || z > area.maxZ - BODY ||
    area.blocks.some((b) => Math.abs(x - b.x) < b.w / 2 + BODY && Math.abs(z - b.z) < b.d / 2 + BODY);

  /** Nhìn theo hướng `yaw` (độ cao mắt giữ nguyên, OrbitControls quay quanh điểm sát trước mắt = nhìn quanh). */
  const look = () => {
    cam.getWorldDirection(dir);
    ctl.target.copy(cam.position).addScaledVector(dir, 0.05);
  };
  const walkControls = () => {
    Object.assign(ctl, { enableZoom: false, enablePan: false, minDistance: 0.01, maxDistance: 0.2, minPolarAngle: 0.35, maxPolarAngle: 2.2, rotateSpeed: 0.45 });
  };
  const orbitControls = () => {
    Object.assign(ctl, { enableZoom: true, enablePan: true, minDistance: 15, maxDistance: 320, minPolarAngle: 0, maxPolarAngle: 1.35, rotateSpeed: 1 });
  };
  /**
   * Hướng camera tới điểm nhìn `look`. Đi bộ: đích của OrbitControls đặt SÁT mắt (0,05 m) – controls giới hạn khoảng cách ≤ 0,2 m,
   * nên đặt đích ở xa sẽ kéo camera tới tận điểm đó.
   */
  const aim = (look: THREE.Vector3) => {
    if (mode === 'walk') {
      dir.subVectors(look, cam.position);
      if (dir.lengthSq() < 1e-8) cam.getWorldDirection(dir);
      ctl.target.copy(cam.position).addScaledVector(dir.normalize(), 0.05);
    } else ctl.target.copy(look);
    cam.lookAt(ctl.target);
  };
  const setPose = (p: HPose) => {
    cam.position.set(...p.pos);
    aim(new THREE.Vector3(...p.target));
    ctl.update();
  };
  /** Tư thế hiện tại; đi bộ thì điểm nhìn kéo dài 20 m theo hướng mắt (để nội suy được tới tư thế khác). */
  const poseNow = (): HPose => {
    const t = ctl.target.clone();
    if (mode === 'walk') t.sub(cam.position).normalize().multiplyScalar(20).add(cam.position);
    return { pos: cam.position.toArray() as HPose['pos'], target: t.toArray() as HPose['target'] };
  };
  /** Bay/đi mượt giữa hai tư thế (Giảm chuyển động → tức thì). */
  const glide = (to: HPose, seconds: number, done?: () => void) => {
    travel?.();
    const a = poseNow();
    const via = new THREE.Vector3();
    const p0 = new THREE.Vector3(...a.pos), t0 = new THREE.Vector3(...a.target);
    const p1 = new THREE.Vector3(...to.pos), t1 = new THREE.Vector3(...to.target);
    if (o.calm() || seconds <= 0) {
      setPose(to);
      return void done?.();
    }
    travel = hub.tween(seconds, (k) => {
      cam.position.lerpVectors(p0, p1, k);
      aim(via.lerpVectors(t0, t1, k));
      o.onStep?.(mode === 'walk' ? 1 : 0);
    }, () => {
      travel = null;
      ctl.update();
      done?.();
    });
  };

  const setMode = (m: WalkMode) => {
    if (m === mode) return;
    if (m === 'overview') saved = poseNow();
    mode = m;
    pad.classList.toggle('is-hidden', m !== 'walk');
    sw.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === m));
    if (m === 'overview') {
      orbitControls();
      glide(area.overview, 1.4);
    } else {
      walkControls();
      glide(saved ?? area.overview, 1.2);
    }
    o.onMode?.(m);
  };

  // nút đi + công tắc chế độ
  const pad = document.createElement('div');
  pad.className = 'hv-pad';
  const keys: [string, string, string][] = [
    ['fwd', '▲', labText('t_67e749d0a37d')], ['left', '◀', labText('t_49cd348e360d')], ['back', '▼', labText('t_b3703285c30c')], ['right', '▶', labText('t_b6f816d084f7')],
  ];
  for (const [k, ch, tip] of keys) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `hv-pad__btn hv-pad__btn--${k}`;
    b.textContent = ch;
    b.title = tip;
    b.setAttribute('aria-label', tip);
    const on = (e: PointerEvent) => (e.preventDefault(), b.setPointerCapture(e.pointerId), held.add(k));
    const off = () => held.delete(k);
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
    pad.appendChild(b);
  }
  const sw = document.createElement('div');
  sw.className = 'hv-mode';
  for (const [m, label] of [['walk', labText('t_4b0917ce9023')], ['overview', labText('t_34f505c35d90')]] as const) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.mode = m;
    b.textContent = label;
    b.className = m === mode ? 'is-on' : '';
    b.addEventListener('click', () => setMode(m));
    sw.appendChild(b);
  }
  ctx.overlay.append(pad, sw);

  const KEYMAP: Record<string, string> = { KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
  let run = false;
  // chỉ nhận phím khi con trỏ đang ở trên khung mô phỏng (không cướp phím của trang)
  let inside = false;
  const host = ctx.overlay.closest<HTMLElement>('.simhost') ?? ctx.renderer.domElement.parentElement ?? ctx.overlay;
  const enter = () => (inside = true);
  const leave = () => (inside = false);
  host.addEventListener('pointerenter', enter);
  host.addEventListener('pointermove', enter);
  host.addEventListener('pointerdown', enter);
  host.addEventListener('pointerleave', leave);
  const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
  const down = (e: KeyboardEvent) => {
    run = e.shiftKey;
    const k = KEYMAP[e.code];
    if (!k || !inside || typing(e) || mode !== 'walk') return;
    e.preventDefault();
    held.add(k);
  };
  const up = (e: KeyboardEvent) => {
    run = e.shiftKey;
    const k = KEYMAP[e.code];
    if (k) held.delete(k);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  ctx.track(() => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    host.removeEventListener('pointerenter', enter);
    host.removeEventListener('pointermove', enter);
    host.removeEventListener('pointerdown', enter);
    host.removeEventListener('pointerleave', leave);
    travel?.();
  });
  const blur = () => held.clear();
  window.addEventListener('blur', blur);
  ctx.track(() => window.removeEventListener('blur', blur));

  walkControls();
  ctx.track(hub.busy(() => !!travel));

  return {
    get mode() {
      return mode;
    },
    setMode,
    /** Chuyển ngay sang góc quan sát hiện vật, hủy mọi tween đang đi bộ. */
    overviewAt(p: HPose) {
      travel?.(); travel = null; held.clear();
      mode = 'overview';
      pad.classList.add('is-hidden');
      sw.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === 'overview'));
      orbitControls(); setPose(p); o.onMode?.('overview');
    },
    /** Đặt ngay tại một điểm (đi bộ). */
    place(p: HPose) {
      travel?.();
      travel = null;
      held.clear();
      if (mode !== 'walk') {
        mode = 'walk';
        pad.classList.remove('is-hidden');
        sw.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === 'walk'));
        walkControls();
        o.onMode?.('walk');
      }
      setPose(p);
      look();
    },
    /** Tự đi tới một điểm học tập. */
    goTo(p: HPose, done?: () => void) {
      if (mode !== 'walk') {
        mode = 'walk';
        pad.classList.remove('is-hidden');
        sw.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === 'walk'));
        walkControls();
        o.onMode?.('walk');
      }
      const d = cam.position.distanceTo(new THREE.Vector3(...p.pos));
      glide(p, Math.min(4, 0.6 + d / 14), done);
    },
    /** Khoảng cách (m) từ mắt người đi tới một vật. */
    distanceTo(obj: THREE.Object3D) {
      return cam.position.distanceTo(obj.getWorldPosition(new THREE.Vector3()));
    },
    /** Mỗi frame (thời gian thực). */
    frame(dt: number) {
      if (mode !== 'walk' || travel || !held.size) return;
      const speed = run ? RUN : WALK;
      cam.getWorldDirection(dir);
      const turn = (held.has('left') ? 1 : 0) - (held.has('right') ? 1 : 0);
      if (turn) {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn * TURN * dt);
        dir.applyQuaternion(q);
      }
      const move = (held.has('fwd') ? 1 : 0) - (held.has('back') ? 1 : 0);
      if (move) {
        const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize().multiplyScalar(move * speed * dt);
        const p = cam.position;
        // Chia bước để Shift + frame chậm không nhảy xuyên một vách hẹp.
        const count = Math.max(1, Math.ceil(flat.length() / (BODY * 0.5)));
        flat.divideScalar(count);
        for (let i = 0; i < count; i++) {
          if (!blocked(p.x + flat.x, p.z)) p.x += flat.x;
          if (!blocked(p.x, p.z + flat.z)) p.z += flat.z;
        }
        p.y = area.eye;
        o.onStep?.(run ? 2 : 1);
      }
      ctl.target.copy(cam.position).addScaledVector(dir, 0.05);
      cam.lookAt(ctl.target);
      ctl.update();
    },
  };
}
export type Walk = ReturnType<typeof createWalk>;
