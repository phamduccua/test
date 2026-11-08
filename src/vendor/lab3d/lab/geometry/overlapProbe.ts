import * as THREE from 'three';
import { bodyPenetration, collectClearance, findClearance, itemAtMouth, near, pourPenetration, type ClearanceItem } from './clearancePairs';

/** Cặp RÓT đang hoạt động: vật rót + vật nhận (vật / điểm miệng thế giới; null = chưa ở tư thế rót). */
interface PourLink {
  pourer: THREE.Object3D;
  receiver(): THREE.Object3D | THREE.Vector3 | null;
}
const links = new Set<PourLink>();

/**
 * Khai báo cặp rót để `overlaps()` đo theo luật RÓT (vật rót không được lọt vào miệng / khối bao vật nhận). Kit tự gọi trong
 * createCarryPour / createTiltPour; sim tự viết hoạt cảnh rót gọi thêm. Trả hàm gỡ (đưa vào ctx.track).
 */
export function linkPour(pourer: THREE.Object3D, receiver: PourLink['receiver']): () => void {
  const l = { pourer, receiver };
  links.add(l);
  return () => void links.delete(l);
}

export interface Overlap {
  a: string;
  b: string;
  /** 'pour' = cặp rót (vật rót lọt vào miệng / thân vật nhận); 'body' = hai thân lấn qua thành nhau. */
  kind: 'pour' | 'body';
  /** Độ xuyên lớn nhất (mm). */
  depth: number;
  /** Tâm miệng hai vật (thế giới, mm) – để lần ra lúc nào / ở đâu. */
  at: [number[], number[]];
}

const mmOf = (p: THREE.Vector3) => p.toArray().map((x) => Math.round(x * 100));
const inScene = (o: THREE.Object3D, root: THREE.Object3D): boolean => (o === root ? true : !!o.parent && inScene(o.parent, root));

function names(items: ClearanceItem[]): string[] {
  const base = items.map((it) => {
    const n = it.obj.name.replace(/-glass$/, '');
    return (it.obj.parent?.name && (!n || n === 'vessel' || it.obj.name.endsWith('-glass')) ? it.obj.parent.name : n) || it.obj.type;
  });
  const seen = new Map<string, number>();
  const total = new Map<string, number>();
  base.forEach((n) => total.set(n, (total.get(n) ?? 0) + 1));
  return base.map((n) => {
    if (total.get(n)! < 2) return n;
    const k = (seen.get(n) ?? 0) + 1;
    seen.set(n, k);
    return `${n}#${k}`;
  });
}

/** Cặp rót đang hoạt động (chỉ số trong `items`). */
function pourPairs(root: THREE.Object3D, items: ClearanceItem[]): Set<string> {
  const out = new Set<string>();
  const v = new THREE.Vector3();
  for (const l of links) {
    if (!inScene(l.pourer, root)) continue;
    const pObj = findClearance(l.pourer);
    const r = l.receiver();
    if (!pObj || !r) continue;
    const p = items.findIndex((it) => it.obj === pObj);
    const at = r instanceof THREE.Vector3 ? r : r.getWorldPosition(v);
    const rec = itemAtMouth(items, at, pObj);
    const q = rec ? items.indexOf(rec) : -1;
    if (p >= 0 && q >= 0) out.add(`${Math.min(p, q)}:${Math.max(p, q)}`);
  }
  return out;
}

/**
 * Mọi cặp vật chứa đang xuyên nhau trong `root` (mm, lớn trước). `min` = bỏ cặp nông hơn (mặc định 0,05 mm);
 * `min < 0` = kèm mọi cặp RÓT đang hoạt động kể cả không xuyên (công cụ kiểm biết lúc nào đang rót).
 */
export function measureOverlaps(root: THREE.Object3D, min = 0.05): Overlap[] {
  const items = collectClearance(root);
  const label = names(items);
  const pours = pourPairs(root, items);
  const out: Overlap[] = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const kind = pours.has(`${i}:${j}`) ? 'pour' : 'body';
      if (kind === 'body' && !near(items[i], items[j])) continue;
      const depth = kind === 'pour' ? pourPenetration(items[i], items[j]) : bodyPenetration(items[i], items[j]);
      if (depth > Math.max(min, 0.05) || (min < 0 && kind === 'pour'))
        out.push({ a: label[i], b: label[j], kind, depth: Math.round(depth * 10) / 10, at: [mmOf(items[i].mouth), mmOf(items[j].mouth)] });
    }
  return out.sort((x, y) => y.depth - x.depth);
}

/** CHỈ DEV: `window.__overlaps()` cho mọi sim (cảnh dùng chung của Engine); `__ix.overlaps()` gọi cùng hàm. */
export function exposeOverlapDevHook(scene: THREE.Object3D): void {
  if (!import.meta.env.DEV) return;
  (window as unknown as { __overlaps?: unknown }).__overlaps = (min?: number) => measureOverlaps(scene, min);
}
