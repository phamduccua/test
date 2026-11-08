/** Mỗi cảnh một nhóm: dụng cụ rót đang VỀ CHỖ (rót xong, nhấc lên, hạ về chỗ đứng). */
const groups = new WeakMap<object, Set<() => boolean>>();

/**
 * Hàng chờ demo giữa các dụng cụ rót cùng cảnh (createCarryPour.pourInto): dụng cụ khác còn đang về chỗ thì chờ nó đặt xong mới mang
 * dụng cụ này đi – hai vật không đụng nhau giữa không trung khi bước sau bắt đầu ngay lúc bước trước rót xong. `returning` = dụng cụ này đang về chỗ.
 */
export function pourQueue(key: object, returning: () => boolean) {
  let set = groups.get(key);
  if (!set) groups.set(key, (set = new Set()));
  set.add(returning);
  return {
    /** Có dụng cụ KHÁC đang về chỗ. */
    blocked: () => [...set].some((f) => f !== returning && f()),
    dispose: () => void set.delete(returning),
  };
}
