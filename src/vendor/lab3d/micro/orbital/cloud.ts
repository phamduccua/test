import * as THREE from 'three';
import type { DensityPoints } from './sampling';
import { labText } from '../../text';

export interface OrbitalCloud {
  points: THREE.Points;
  setColors(pos: THREE.ColorRepresentation, neg: THREE.ColorRepresentation): void;
  setOpacity(o: number): void;
  dispose(): void;
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) throw new Error(labText('t_bb11751fbaec'));
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Đám mây điểm xác suất |ψ|² (cộng màu, mỗi điểm một đốm sáng; màu theo dấu ψ). Người gọi gọi `dispose()`. */
export function createOrbitalCloud(
  pts: DensityPoints,
  o: { pos?: THREE.ColorRepresentation; neg?: THREE.ColorRepresentation; size?: number; opacity?: number } = {},
): OrbitalCloud {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts.positions, 3));
  const col = new Float32Array(pts.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: o.size ?? 0.06,
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: o.opacity ?? 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'orbital-cloud';
  const cloud: OrbitalCloud = {
    points,
    setColors(pos, neg) {
      const a = new THREE.Color(pos);
      const b = new THREE.Color(neg);
      for (let i = 0; i < pts.count; i++) (pts.signs[i] > 0 ? a : b).toArray(col, i * 3);
      geo.attributes.color.needsUpdate = true;
    },
    setOpacity(op) {
      mat.opacity = op;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      mat.map?.dispose();
      points.removeFromParent();
    },
  };
  cloud.setColors(o.pos ?? 0x60a5fa, o.neg ?? 0xfbbf24);
  return cloud;
}
