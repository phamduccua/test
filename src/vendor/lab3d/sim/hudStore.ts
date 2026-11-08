import { create } from 'zustand';
import type { SimHud } from './types';

export interface HudItem {
  key: string;
  label: string;
  value: string;
}

interface HudState {
  items: HudItem[];
}

export const useHud = create<HudState>(() => ({ items: [] }));

/** Triển khai ctx.hud ghi vào store (bỏ qua khi giá trị không đổi để tránh render thừa). */
export const hudApi: SimHud = {
  set(key, label, value) {
    const items = useHud.getState().items;
    const i = items.findIndex((x) => x.key === key);
    if (i >= 0 && items[i].label === label && items[i].value === value) return;
    const next = items.slice();
    if (i >= 0) next[i] = { key, label, value };
    else next.push({ key, label, value });
    useHud.setState({ items: next });
  },
  remove(key) {
    const items = useHud.getState().items;
    if (items.some((x) => x.key === key)) useHud.setState({ items: items.filter((x) => x.key !== key) });
  },
  clear() {
    if (useHud.getState().items.length) useHud.setState({ items: [] });
  },
};
