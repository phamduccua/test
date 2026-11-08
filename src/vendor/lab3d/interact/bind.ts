import type GUI from 'lil-gui';
import type { Controller } from 'lil-gui';
import type { Binding } from './types';

/**
 * Liên kết HAI CHIỀU tay kéo 3D ↔ tham số lil-gui: `set` = như kéo thanh trượt (gọi onChange, cập nhật hiển thị),
 * `commit` = như nhả chuột (onFinishChange). Không có controller → ghi thẳng `obj[key]`. Controller tìm lười (GUI dựng sau vẫn được).
 * `set` luôn làm mới ô hiển thị; lil-gui không gọi onChange khi giá trị không đổi – `force: true` thì vẫn gọi (trạng thái khác đã đổi,
 * cần dựng lại theo onChange).
 */
export function bindParam<O extends object, K extends keyof O>(obj: O, key: K, gui?: GUI, o: { force?: boolean } = {}): Binding<O[K]> {
  let ctl: Controller | undefined;
  const find = () => (ctl ??= gui?.controllersRecursive().find((c) => c.object === obj && c.property === key));
  return {
    get: () => obj[key],
    set(v) {
      const c = find();
      if (!c) return void (obj[key] = v);
      if (c.getValue() !== v) return void c.setValue(v);
      if (o.force) (c as unknown as { _callOnChange(): void })._callOnChange();
      c.updateDisplay();
    },
    commit(v) {
      const c = find();
      if (c) c.load(v);
      else obj[key] = v;
    },
  };
}

/** Đổi kiểu một liên kết (vd. hướng gió 'W' | 'E' ↔ góc số). */
export function mapBinding<A, B>(b: Binding<A>, to: (a: A) => B, from: (v: B) => A): Binding<B> {
  return {
    get: () => to(b.get()),
    set: (v) => b.set(from(v)),
    commit: (v) => (b.commit ? b.commit(from(v)) : b.set(from(v))),
  };
}

/** Liên kết từ hai hàm (giá trị nằm trong mô hình của sim). */
export const binding = <T>(get: () => T, set: (v: T) => void, commit?: (v: T) => void): Binding<T> => ({ get, set, commit });
