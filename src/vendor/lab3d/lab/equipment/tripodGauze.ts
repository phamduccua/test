import * as THREE from 'three';
import { canvasTexture, makeCanvas } from '../materials/canvas';
import { labMaterials } from '../materials/kit';
import type { Tracker } from '../types';
import { mm } from '../units';

export interface TripodGauzeOptions {
  /** Độ cao mặt lưới (đv cảnh). */
  height?: number;
  /** Bán kính vòng kiềng & bán kính chân dưới sàn. */
  ringRadius?: number;
  footRadius?: number;
  /** Cạnh lưới vuông. */
  gauze?: number;
}

export interface TripodGauze {
  group: THREE.Group;
  /** Độ cao mặt trên lưới – đặt cốc lên đây. */
  topY: number;
  /** 0…1: lưới nóng đỏ dần ở giữa (heatmap). */
  setHeat(h: number): void;
}

function meshTexture(): HTMLCanvasElement {
  const { canvas, g } = makeCanvas(512, 512);
  g.clearRect(0, 0, 512, 512);
  g.strokeStyle = '#8b9096';
  g.lineWidth = 2.2;
  for (let i = 8; i < 512; i += 11) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 512);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(512, i);
    g.stroke();
  }
  // Viền gấp mép.
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 502);
  return canvas;
}

function radialTexture(): HTMLCanvasElement {
  const { canvas, g } = makeCanvas(256, 256);
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.3, '#c8c8c8');
  grd.addColorStop(0.65, '#303030');
  grd.addColorStop(1, '#000000');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return canvas;
}

/** A-KIENG-LUOI – kiềng ba chân thép + lưới thép vuông (alpha texture), giữa có đĩa gốm; nóng đỏ khi đun. */
export function createTripodGauze(ctx: Tracker, o: TripodGauzeOptions = {}): TripodGauze {
  const H = o.height ?? mm(150);
  const R = o.ringRadius ?? mm(52);
  const Rf = o.footRadius ?? mm(78);
  const S = o.gauze ?? mm(130);
  const mats = labMaterials(ctx);
  const iron = ctx.track(new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.7, roughness: 0.45 }));
  const group = new THREE.Group();
  group.name = 'tripod-gauze';
  const rod = mm(3.2);
  const ring = new THREE.Mesh(ctx.track(new THREE.TorusGeometry(R, rod, 10, 56)), iron);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = H - rod;
  ring.castShadow = true;
  group.add(ring);
  const legGeo = ctx.track(new THREE.CylinderGeometry(rod, rod, 1, 10));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const top = new THREE.Vector3(Math.cos(a) * R, H - rod, Math.sin(a) * R);
    const foot = new THREE.Vector3(Math.cos(a) * Rf, 0, Math.sin(a) * Rf);
    const leg = new THREE.Mesh(legGeo, iron);
    leg.position.copy(top).add(foot).multiplyScalar(0.5);
    leg.scale.y = top.distanceTo(foot);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
    leg.castShadow = true;
    const cap = new THREE.Mesh(ctx.track(new THREE.SphereGeometry(rod * 1.5, 10, 8)), mats.blackRubber());
    cap.position.copy(foot).setY(rod);
    group.add(leg, cap);
  }
  const emissiveMap = ctx.track(canvasTexture(radialTexture(), true));
  const wire = ctx.track(
    new THREE.MeshStandardMaterial({
      map: ctx.track(canvasTexture(meshTexture(), true)),
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      metalness: 0.6,
      roughness: 0.5,
      emissive: 0xff4a12,
      emissiveMap,
      emissiveIntensity: 0,
    }),
  );
  const gauze = new THREE.Mesh(ctx.track(new THREE.PlaneGeometry(S, S)), wire);
  gauze.rotation.x = -Math.PI / 2;
  gauze.position.y = H + mm(0.5);
  gauze.castShadow = true;
  gauze.receiveShadow = true;
  const ceramic = ctx.track(
    new THREE.MeshStandardMaterial({ color: 0xdedad2, roughness: 0.95, emissive: 0xff5a1e, emissiveMap, emissiveIntensity: 0 }),
  );
  const disc = new THREE.Mesh(ctx.track(new THREE.CylinderGeometry(S * 0.3, S * 0.3, mm(1.2), 40)), ceramic);
  disc.position.y = H + mm(0.9);
  disc.receiveShadow = true;
  const glow = new THREE.PointLight(0xff6a2a, 0, mm(160), 2);
  glow.position.y = H - mm(12);
  group.add(gauze, disc, glow);
  return {
    group,
    topY: H + mm(1.5),
    setHeat(h) {
      const k = Math.max(0, Math.min(1, h));
      wire.emissiveIntensity = 2.6 * k * k;
      ceramic.emissiveIntensity = 0.9 * k * k;
      glow.intensity = 0.25 * k;
    },
  };
}
