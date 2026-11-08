import * as THREE from 'three';
import { labText } from '../../text';

/** Tạo canvas 2D (ném lỗi nếu trình duyệt không hỗ trợ). */
export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error(labText('t_bb11751fbaec'));
  return { canvas, g };
}

/** Bọc canvas thành texture sRGB (màu) hoặc tuyến tính (dữ liệu: roughness/bump). */
export function canvasTexture(canvas: HTMLCanvasElement, color = true, repeat?: [number, number]): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

/** PRNG nhỏ, có hạt giống – texture thủ tục ổn định giữa các lần chạy. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
