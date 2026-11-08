import * as THREE from 'three';
import { pointerHub, type InteractCtx } from '../../interact/index';

export interface FlamePassOptions {
  /** Đỉnh bấc đèn cồn (thế giới). */
  flame(): THREE.Vector3;
  /** Điểm được hơ – vết bôi giữa lam (thế giới). */
  probe(): THREE.Vector3;
  /** Chỉ tính khi đúng bước và đèn đang cháy. */
  active(): boolean;
  /** Nửa bề rộng (dm) ngọn lửa theo phương ngang màn hình – mặc định 0,14. */
  radius?: number;
  /** Lệch trước/sau (theo hướng nhìn) vẫn tính là qua lửa – mặc định 0,35 (mặt kéo của tay cầm có thể lệch chút so với đèn). */
  depth?: number;
  /** Khoảng cao trên đỉnh bấc (dm) ngọn lửa còn tới – mặc định [0,05; 0,7]. Dưới mức thấp = nhúng vào lõi lửa (quá nóng). */
  band?: [number, number];
  /** Nằm yên trong lửa quá chừng này (s) thì mỗi lần như thế tính thêm một lượt (lam nóng quá) – mặc định 0,9. */
  dwell?: number;
  /** Vừa qua lửa xong một lượt (vào → ra) hoặc nằm yên lâu; `n` = tổng số lượt. */
  onPass?(n: number, dwell: boolean): void;
  /** Mỗi frame còn trong lửa. */
  onHeat?(dt: number): void;
  onEnter?(): void;
  /** Đưa vào lõi lửa (thấp hơn band[0]). */
  onCore?(): void;
}

export interface FlamePass {
  readonly passes: number;
  readonly inFlame: boolean;
  reset(n?: number): void;
  /**
   * Demo / phím tắt: đưa `obj` (đang nằm cạnh ngọn lửa, phía `b`) qua lại `n` lượt giữa `a` và `b` (hệ cha của obj, hai phía lửa) –
   * mỗi lượt cắt ngang trục lửa; đếm lượt bằng chính bộ đếm như khi kéo tay. Trả hàm huỷ.
   */
  sweep(obj: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, n: number, perPass: number, done: () => void): () => void;
}

/**
 * Hơ cố định vết bôi (SGK: hơ nhanh lam trên ngọn lửa đèn cồn 2–3 lượt): theo dõi điểm vết bôi so với ngọn lửa mỗi frame (thời gian thực,
 * kể cả lúc đang kéo tay hay hoạt cảnh demo) – mỗi lần đi vào rồi ra khỏi cột lửa = một lượt; để yên trong lửa = thêm lượt (quá nóng).
 */
export function createFlamePass(ctx: InteractCtx, o: FlamePassOptions): FlamePass {
  const hub = pointerHub(ctx);
  const r = o.radius ?? 0.14;
  const depth = o.depth ?? 0.35;
  const right = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const [lo, hi] = o.band ?? [0.05, 0.7];
  const dwell = o.dwell ?? 0.9;
  let passes = 0;
  let inside = false;
  let stay = 0;
  let core = false;
  const f = new THREE.Vector3();
  const p = new THREE.Vector3();
  ctx.track(
    hub.onFrame((dt) => {
      if (!o.active()) {
        inside = false;
        return;
      }
      f.copy(o.flame());
      p.copy(o.probe());
      const h = p.y - f.y;
      // Đo ngang theo màn hình (như mắt thấy lam cắt qua ngọn lửa) + cho lệch trước/sau một chút.
      ctx.camera.getWorldDirection(fwd).setY(0).normalize();
      right.set(-fwd.z, 0, fwd.x);
      p.sub(f).setY(0);
      const now = Math.abs(p.dot(right)) < r && Math.abs(p.dot(fwd)) < depth && h < hi && h > -0.05;
      if (now && h < lo && !core) {
        core = true;
        o.onCore?.();
      } else if (h >= lo) core = false;
      if (now && !inside) {
        stay = 0;
        o.onEnter?.();
      }
      if (now) {
        o.onHeat?.(dt);
        stay += dt;
        if (stay >= dwell) {
          stay -= dwell;
          o.onPass?.(++passes, true);
        }
      } else if (inside) o.onPass?.(++passes, false);
      inside = now;
    }),
  );
  return {
    get passes() {
      return passes;
    },
    get inFlame() {
      return inside;
    },
    reset(n = 0) {
      passes = n;
      inside = false;
      stay = 0;
    },
    sweep(obj, a, b, n, perPass, done) {
      const pts = [obj.position.clone(), ...Array.from({ length: n }, (_, i) => (i % 2 ? b : a).clone())];
      let i = 0;
      let stop = () => {};
      const next = () => {
        if (i >= pts.length - 1) return done();
        const p0 = pts[i];
        const p1 = pts[++i];
        stop = hub.tween(perPass, (k) => obj.position.lerpVectors(p0, p1, k), next);
      };
      next();
      return () => stop();
    },
  };
}
