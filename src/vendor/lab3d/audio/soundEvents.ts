/**
 * Âm theo THAY ĐỔI trạng thái (thuần, kiểm bằng node): so ảnh chụp trước/sau của lab, trả các sfx cần phát.
 * Số tăng (bộ đếm thao tác) hoặc cờ bật mới kêu; làm lại (số giảm) và render lại cùng số liệu không kêu.
 */
import type { SfxOptions } from './types';

/** Một luật: id âm, hoặc id + khi nào phát + tuỳ chọn phát. */
export type SoundRule =
  | string
  | (SfxOptions & {
      id: string;
      /** 'up' (số tăng – mặc định cho số), 'down', 'on' (cờ bật – mặc định cho cờ), 'off', 'change' (mặc định cho chuỗi). */
      when?: 'up' | 'down' | 'on' | 'off' | 'change';
      /** Khoảng tối thiểu (s) giữa hai lần phát luật này. */
      minGap?: number;
      /** Bỏ qua nếu luật của khoá này vừa phát cùng lượt (vd. xong bài thay cho xong bước). */
      unless?: string;
    });

export type SoundValue = number | boolean | string | null | undefined;
export type SoundSnapshot = Record<string, SoundValue | readonly [number, number]>;
export interface SoundCue extends SfxOptions {
  id: string;
  key: string;
  minGap?: number;
}

const scalar = (v: SoundSnapshot[string]): SoundValue => (Array.isArray(v) ? v[0] : (v as SoundValue));
const num = (v: SoundValue) => (typeof v === 'number' ? v : v ? 1 : 0);

function fires(when: string, a: SoundValue, b: SoundValue): boolean {
  switch (when) {
    case 'up':
      return num(b) > num(a);
    case 'down':
      return num(b) < num(a);
    case 'on':
      return !a && !!b;
    case 'off':
      return !!a && !b;
    default:
      return a !== undefined && a !== b;
  }
}

/** Các âm cần phát khi trạng thái đổi từ `prev` sang `next` theo `rules` (khoá → luật). */
export function soundEvents(prev: SoundSnapshot, next: SoundSnapshot, rules: Record<string, SoundRule | SoundRule[]>): SoundCue[] {
  const out: SoundCue[] = [];
  const fired = new Set<string>();
  const pending: [string, Exclude<SoundRule, string>][] = [];
  for (const [key, list] of Object.entries(rules)) {
    for (const r of Array.isArray(list) ? list : [list]) pending.push([key, typeof r === 'string' ? { id: r } : r]);
  }
  // Luật có `unless` xét sau cùng (khoá kia đã biết phát hay chưa).
  pending.sort((x, y) => Number(!!x[1].unless) - Number(!!y[1].unless));
  for (const [key, r] of pending) {
    const a = scalar(prev[key]);
    const b = scalar(next[key]);
    const when = r.when ?? (typeof b === 'string' || typeof a === 'string' ? 'change' : typeof b === 'boolean' ? 'on' : 'up');
    if (!fires(when, a, b) || (r.unless && fired.has(r.unless))) continue;
    fired.add(key);
    const opts: Partial<typeof r> = { ...r };
    delete opts.when;
    delete opts.unless;
    out.push({ ...opts, id: r.id, key: `${key}:${r.id}` });
  }
  return out;
}
