import type * as THREE from 'three';
import type GUI from 'lil-gui';
import { clearLabelFocus, trackLabelProximity } from '../engine/labelFocus';
import { isOpen, resetTransient, setOpen } from '../ui/collapse';

/**
 * Mặc định "ít thông tin" của một phiên sim:
 * - bảng Tham số (lil-gui) luôn THU GỌN thành chip khi vào bài; mở ra thì các thư mục chạy kiểu accordion (mỗi lần một nhóm);
 * - nhãn 3D gọn (`.labels-layer.is-quiet`): nhãn thường hiện khi con trỏ tới gần / vật liên quan; "Hiện mọi nhãn" trong Tham số (id 'labels').
 */
export function setupQuietDefaults(gui: GUI, root: HTMLElement, host: HTMLElement, layer: HTMLElement, collapseWidth = 1000) {
  // Luôn thu gọn khi vào bài (kế hoạch nâng cấp P0-3): cảnh và thanh bước là thứ thấy đầu tiên; người dùng tự mở khi cần chỉnh.
  void root;
  void collapseWidth;
  gui.close();
  // Mỗi lần chỉ mở một nhóm: mở thư mục nào thì gập các thư mục cùng cấp (bảng không dài quá khung, che ít cảnh).
  gui.onOpenClose((changed) => {
    if (changed === gui || changed._closed || !changed.parent) return;
    changed.parent.folders.forEach((f) => f !== changed && f.close());
  });
  const applyLabels = () => layer.classList.toggle('is-quiet', !isOpen('labels', false));
  applyLabels();
  const offNear = trackLabelProximity(host, layer);
  return {
    /** Sau create(): cảnh có nhãn gọn (chưa vẽ lần nào → tìm trong cảnh, không trong DOM) → công tắc "Hiện mọi nhãn" cuối bảng Tham số. */
    attach(scene: THREE.Object3D, labelText: string) {
      let found = false;
      scene.traverse((o) => {
        const l = o as THREE.Object3D & { isCSS2DObject?: boolean; element?: HTMLElement };
        if (l.isCSS2DObject && l.element?.classList.contains('lab-label--auto')) found = true;
      });
      if (!found) return;
      const state = { all: isOpen('labels', false) };
      gui
        .add(state, 'all')
        .name(labelText)
        .onChange((v: boolean) => {
          setOpen('labels', v);
          applyLabels();
        });
    },
    dispose() {
      offNear();
      clearLabelFocus();
      resetTransient();
    },
  };
}
