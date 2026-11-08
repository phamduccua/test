import * as THREE from 'three';
import { UI } from '../ui/tokens';
import type { InteractCtx } from './types';

/** Ô thả: chờ = màu nhấn (đích của bước hiện tại), đang trên ô đúng = xanh lá, sai = đỏ (token kit/lab3d/ui). */
export const ZONE_COLORS = { idle: UI.hex.accent, hot: UI.hex.ok, bad: UI.hex.bad } as const;
export type ZoneTone = keyof typeof ZONE_COLORS;

/** Vòng sáng phẳng (vẽ đè, không bị kính/che khuất) đánh dấu ô thả / điểm cần thao tác; nhịp thở theo `pulse(t)`. */
export function createZoneRing(ctx: Pick<InteractCtx, 'track'>, radius: number, normal = new THREE.Vector3(0, 1, 0)) {
  const geo = ctx.track(new THREE.RingGeometry(radius * 0.78, radius, 48));
  const mat = ctx.track(
    new THREE.MeshBasicMaterial({ color: ZONE_COLORS.idle, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  const Z = new THREE.Vector3(0, 0, 1);
  mesh.quaternion.setFromUnitVectors(Z, normal.clone().normalize());
  mesh.renderOrder = 998;
  mesh.visible = false;
  mesh.raycast = () => {};
  mesh.userData.noOutline = true;
  mesh.name = 'ix-zone-ring';
  let tone: ZoneTone = 'idle';
  let flash = 0;
  return {
    mesh,
    set(on: boolean, t: ZoneTone = 'idle') {
      mesh.visible = on || flash > 0;
      tone = t;
    },
    /** Quay mặt vòng theo pháp tuyến `n` (thế giới, vòng nằm trong cảnh không xoay). */
    face(n: THREE.Vector3) {
      mesh.quaternion.setFromUnitVectors(Z, n.clone().normalize());
    },
    /** Chớp màu (sai = đỏ, đúng = xanh lá) trong `s` giây. */
    flash(t: ZoneTone, s = 0.8) {
      tone = t;
      flash = s;
      mesh.visible = true;
    },
    pulse(time: number, dt: number) {
      if (flash > 0) {
        flash -= dt;
        if (flash <= 0) mesh.visible = false;
      }
      if (!mesh.visible) return;
      mat.color.setHex(ZONE_COLORS[tone]);
      const k = 0.5 + 0.5 * Math.sin(time * (tone === 'idle' ? 4 : 9));
      mat.opacity = tone === 'idle' ? 0.45 + 0.3 * k : 0.7 + 0.3 * k;
      mesh.scale.setScalar(1 + (tone === 'hot' ? 0.12 : 0.05) * k);
    },
  };
}
export type ZoneRing = ReturnType<typeof createZoneRing>;
