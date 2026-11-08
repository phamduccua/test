import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * Bố trí nhãn 3D sau mỗi lần CSS2DRenderer vẽ (kế hoạch nâng cấp P1-3):
 * - **đường nối**: nhãn đặt lệch khỏi vật (`offset`) có đường mảnh từ mép nhãn tới đúng gốc vật, kết thúc bằng chấm nhỏ;
 * - **tránh chồng**: nhãn đang hiện chồng lên nhãn đã đặt thì đẩy xuống (thuộc tính CSS `translate`, không đụng `transform` của CSS2D);
 * - **ẩn khi bị che**: tia từ camera tới gốc vật gặp vật đục ở gần hơn → `.is-occluded` (mờ đi). Thuỷ tinh / vật trong suốt không che.
 * Danh sách nhãn và phép thử che làm ~5 lần/giây; dời nhãn và vẽ đường làm mỗi khung (rẻ: chỉ đọc khung chữ nhật đã có).
 */
export function createLabelLayout(host: HTMLElement, layer: HTMLElement) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('labels-leaders');
  host.appendChild(svg);
  const ray = new THREE.Raycaster();
  const v = new THREE.Vector3();
  const a = new THREE.Vector3();
  let labels: CSS2DObject[] = [];
  /** Điểm neo của từng nhãn = tâm khung bao của vật mang nhãn (đáy ống nghiệm là gốc toạ độ, nhưng đường nối nên chỉ vào giữa vật). */
  const anchors = new Map<CSS2DObject, THREE.Vector3>();
  const box = new THREE.Box3();
  let solids: THREE.Object3D[] = [];
  let scanT = 0;
  const isLabel = (o: THREE.Object3D): o is CSS2DObject => (o as { isCSS2DObject?: boolean }).isCSS2DObject === true;
  const opaque = (o: THREE.Object3D) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!(o as THREE.Mesh).isMesh || !m || !o.visible || o.name === 'pick-proxy') return false;
    const mats = Array.isArray(m) ? m : [m];
    return mats.every((x) => x.visible && !x.transparent && !((x as THREE.MeshPhysicalMaterial).transmission > 0) && x.opacity >= 1);
  };
  const shown = (el: HTMLElement) =>
    el.isConnected && el.style.display !== 'none' &&
    !(layer.classList.contains('is-quiet') && el.classList.contains('lab-label--auto') && !el.classList.contains('is-near') && !el.classList.contains('is-focus'));

  return {
    update(scene: THREE.Scene, camera: THREE.Camera, dt: number) {
      const W = host.clientWidth, H = host.clientHeight;
      if ((scanT -= dt) <= 0) {
        scanT = 0.2;
        labels = [];
        solids = [];
        scene.traverseVisible((o) => {
          if (isLabel(o)) labels.push(o);
          else if (opaque(o)) solids.push(o);
        });
        // Bị che: gốc vật (cha của nhãn) khuất sau vật đục không thuộc chính vật đó.
        anchors.clear();
        for (const l of labels) {
          const owner = l.parent;
          if (!owner) continue;
          box.makeEmpty();
          owner.traverseVisible((o) => {
            if ((o as THREE.Mesh).isMesh && o.name !== 'pick-proxy') box.expandByObject(o, false);
          });
          if (box.isEmpty()) owner.getWorldPosition(a);
          else box.getCenter(a);
          anchors.set(l, a.clone());
          const dist = camera.getWorldPosition(v).distanceTo(a);
          ray.set(v, a.clone().sub(v).normalize());
          ray.far = dist * 0.97;
          const hit = ray.intersectObjects(solids, false).find((h) => !isInside(h.object, owner));
          l.element.classList.toggle('is-occluded', !!hit);
        }
      }
      // Tránh chồng: xếp theo vị trí dọc, nhãn sau chồng nhãn trước thì đẩy xuống dưới nhãn đó.
      const placed: DOMRect[] = [];
      const lines: string[] = [];
      const items = labels.filter((l) => shown(l.element) && !l.element.classList.contains('lab-label--title'));
      for (const l of items) l.element.style.translate = '';
      const rects = items.map((l) => ({ l, r: l.element.getBoundingClientRect() })).sort((x, y) => x.r.top - y.r.top);
      const hostBox = host.getBoundingClientRect();
      for (const { l, r } of rects) {
        let dy = 0;
        for (const p of placed) {
          if (r.left < p.right + 2 && r.right > p.left - 2 && r.top + dy < p.bottom + 2 && r.bottom + dy > p.top - 2) dy = p.bottom + 3 - r.top;
        }
        if (dy) l.element.style.translate = `0 ${Math.round(dy)}px`;
        placed.push(new DOMRect(r.left, r.top + dy, r.width, r.height));
        // Đường nối khi nhãn lệch khỏi gốc vật > 14 px và nhãn không bị che.
        const owner = l.parent;
        const anchor = anchors.get(l);
        if (!owner || !anchor || l.element.classList.contains('is-occluded')) continue;
        a.copy(anchor).project(camera);
        if (a.z > 1) continue;
        const ax = (a.x * 0.5 + 0.5) * W, ay = (-a.y * 0.5 + 0.5) * H;
        const cx = r.left - hostBox.left + r.width / 2, cy = r.top - hostBox.top + dy + r.height / 2;
        if (Math.hypot(ax - cx, ay - cy) < 14 + r.height / 2) continue;
        // Bắt đầu từ mép nhãn gần gốc vật nhất.
        const sx = Math.max(r.left - hostBox.left, Math.min(ax, r.right - hostBox.left));
        const sy = ay > cy ? r.bottom - hostBox.top + dy : r.top - hostBox.top + dy;
        lines.push(`<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.2"/>`);
      }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = lines.join('');
    },
    clear() {
      labels = [];
      anchors.clear();
      solids = [];
      svg.innerHTML = '';
    },
    dispose() {
      svg.remove();
    },
  };
}

function isInside(o: THREE.Object3D, owner: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === owner) return true;
  return false;
}
