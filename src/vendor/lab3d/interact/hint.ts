import './interact.css';
import * as THREE from 'three';
import { focusLabels } from '../engine/labelFocus';
import { UI } from '../ui/tokens';
import { pointerHub } from './pointer';
import type { InteractCtx } from './types';

export type HintPoint = THREE.Object3D | THREE.Vector3 | HTMLElement | null;
/** Vật (mũi tên trên đỉnh hộp bao), điểm, phần tử HTML (mũi tên HTML trên phần tử – thanh trượt, khay thẻ), hoặc hàm tính lại mỗi frame. */
export type HintTarget = HintPoint | (() => HintPoint);

export interface Hint {
  /** Chỉ vào vật/điểm cần thao tác (null = ẩn). */
  show(target: HintTarget): void;
  hide(): void;
  readonly visible: boolean;
}

export interface HintOptions {
  color?: THREE.ColorRepresentation;
  /** Cỡ mũi tên theo tỉ lệ khoảng cách camera (mặc định 0,045 → cỡ gần như cố định trên màn hình). */
  size?: number;
  /** Nhô lên trên đỉnh hộp bao của vật (theo cỡ mũi tên, mặc định 0,6). */
  gap?: number;
}

const box = new THREE.Box3();

/**
 * Gợi ý bước hiện tại: mũi tên nhấp nhô chỉ xuống + vầng sáng phẳng, vẽ đè lên mọi thứ (không bị che), cỡ không đổi trên màn hình.
 * Vật → mũi tên trên đỉnh hộp bao; điểm/hàm → tại điểm đó.
 */
export function createHint(ctx: InteractCtx, o: HintOptions = {}): Hint {
  const hub = pointerHub(ctx);
  const color = new THREE.Color(o.color ?? UI.hex.accent);
  const mat = (opacity: number) =>
    ctx.track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  const group = new THREE.Group();
  group.name = 'ix-hint';
  group.renderOrder = 999;
  const cone = new THREE.Mesh(ctx.track(new THREE.ConeGeometry(0.35, 0.8, 20)), mat(0.95));
  cone.rotation.x = Math.PI; // mũi chỉ xuống
  const stem = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12)), mat(0.95));
  stem.position.y = 0.7;
  const arrow = new THREE.Group();
  arrow.add(cone, stem);
  arrow.position.y = 0.4;
  const halo = new THREE.Mesh(ctx.track(new THREE.RingGeometry(0.45, 0.62, 40)), mat(0.7));
  group.add(arrow, halo);
  group.traverse((m) => {
    m.renderOrder = 999;
    m.raycast = () => {};
    m.userData.noOutline = true;
  });
  group.visible = false;
  ctx.scene.add(group);
  let target: HintTarget = null;
  let t = 0;
  const at = new THREE.Vector3();
  // Mũi tên HTML khi chỉ vào phần tử của bảng (không có vật 3D để chỉ).
  const html = document.createElement('div');
  html.className = 'ix-hint-html';
  html.style.borderTopColor = `#${color.getHexString()}`;
  ctx.overlay.appendChild(html);
  const showHtml = (el: HTMLElement | null) => {
    const r = el && el.isConnected && el.offsetParent ? el.getBoundingClientRect() : null;
    html.classList.toggle('on', !!r && !hub.active);
    if (!r) return;
    const o = ctx.overlay.getBoundingClientRect();
    const x = Math.min(o.width - 12, Math.max(12, r.left + r.width / 2 - o.left));
    const y = Math.max(22, r.top - o.top - 4);
    html.style.transform = `translate(${x}px, ${y - 6 * Math.abs(Math.sin(t * 3.2))}px)`;
  };
  // lớp `ix-hints-off` trên overlay (vd. bàn tư liệu ở "Hồ sơ của em") tắt mọi mũi tên gợi ý – 3D lẫn HTML
  const off = () => ctx.overlay.classList.contains('ix-hints-off');
  const resolve = (): boolean => {
    if (off()) return showHtml(null), focusLabels('hint', null), false;
    const tg = typeof target === 'function' ? target() : target;
    if (!tg || !(tg as THREE.Object3D).isObject3D) focusLabels('hint', null);
    if (tg instanceof HTMLElement) return showHtml(tg), false;
    showHtml(null);
    if (!tg) return false;
    if ((tg as THREE.Object3D).isObject3D) {
      const obj = tg as THREE.Object3D;
      focusLabels('hint', obj);
      if (!obj.visible) return false;
      box.setFromObject(obj, true);
      if (box.isEmpty()) obj.getWorldPosition(at);
      else at.set((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
      return true;
    }
    at.copy(tg as THREE.Vector3);
    return true;
  };
  ctx.track(
    hub.onFrame((dt) => {
      t += dt;
      const on = !hub.active && resolve();
      if (hub.active) focusLabels('hint', null);
      group.visible = on;
      if (!on) return;
      const s = ctx.camera.position.distanceTo(at) * (o.size ?? 0.045);
      group.scale.setScalar(s);
      group.position.copy(at).addScaledVector(ctx.camera.up, s * (o.gap ?? 0.6));
      arrow.position.y = 0.45 + 0.35 * Math.abs(Math.sin(t * 3.2));
      halo.quaternion.copy(ctx.camera.quaternion);
      halo.position.y = 0;
      halo.scale.setScalar(1 + 0.25 * Math.sin(t * 3.2));
      // Mũi tên luôn đứng theo phương "lên" của màn hình.
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ctx.camera.up);
    }),
  );
  return {
    show(tg) {
      target = tg;
    },
    hide() {
      target = null;
    },
    get visible() {
      return group.visible;
    },
  };
}
