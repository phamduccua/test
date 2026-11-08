import { disposeAny } from '../engine/dispose';
import type { SimContext } from './types';

/** Phạm vi tài nguyên con của một sim: `scope.ctx` dùng như `ctx` (mọi thứ khác kế thừa) nhưng `track` gom riêng để huỷ sớm. */
export interface SimScope {
  ctx: SimContext;
  /** huỷ mọi thứ đã `scope.ctx.track` (ngược thứ tự) – dùng lại được */
  dispose(): void;
}

/**
 * Tạo phạm vi tài nguyên dựng lại được (vd. khối một tỉnh nạp theo lựa chọn – đổi tỉnh thì huỷ khối cũ ngay, không chờ tắt sim).
 * Phạm vi tự huỷ cùng sim.
 */
export function createScope(ctx: SimContext): SimScope {
  const items: unknown[] = [];
  const sub = Object.create(ctx) as SimContext;
  // `pointerHub(sub)` → hub của sim gốc (kit interact)
  Object.defineProperty(sub, 'scopeParent', { value: ctx });
  sub.track = <T>(o: T): T => {
    items.push(o);
    return o;
  };
  const scope: SimScope = {
    ctx: sub,
    dispose() {
      for (let i = items.length - 1; i >= 0; i--) disposeAny(items[i]);
      items.length = 0;
    },
  };
  ctx.track(() => scope.dispose());
  return scope;
}

/** Ctx gốc của sim, bỏ qua các phạm vi con `createScope` – để kit dùng chung một dịch vụ cho cả sim (vd. `pointerHub`). */
export function scopeRoot<T extends object>(ctx: T): T {
  let c = ctx;
  while ((c as { scopeParent?: T }).scopeParent) c = (c as { scopeParent?: T }).scopeParent!;
  return c;
}
