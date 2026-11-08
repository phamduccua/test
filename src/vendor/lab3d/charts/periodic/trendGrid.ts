import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { BOOK_COLORS, SCALE_COOL_WARM, valueColor } from './colorScale';
import { createGridBase, type GridBase } from './gridBase';
import { cellSize, gridGeometry, lineupSlots, markTop, niceTicks, romanGroup, sortedSlots, type GridGeometry } from './layout';
import { createLineupBoard, type LineupBoard } from './lineupBoard';
import { createMark, markGeometries, type Mark } from './marks';
import type { ColorMode, Slot, TrendDatum, TrendGridOptions, TrendMode } from './types';
import './periodic.css';

export interface TrendGrid {
  group: THREE.Group;
  marks: Mark[];
  base: GridBase;
  board: LineupBoard;
  readonly geometry: GridGeometry;
  readonly mode: TrendMode;
  /** Khung hàng đồ thị phụ đang hiện (null = không xếp hàng). */
  readonly lineup: { x0: number; x1: number; z: number; maxR: number } | null;
  setMode(m: TrendMode): void;
  setColorMode(c: ColorMode): void;
  setSphereScale(s: number): void;
  /** Làm mờ các mark không thoả (null = hiện tất cả). `lineup` = các mark được chọn bay ra xếp hàng theo Z. */
  focus(test: ((d: TrendDatum) => boolean) | null, lineup?: boolean): void;
  /** Xếp lại các mark theo giá trị giảm dần trong lưới. */
  setSorted(on: boolean): void;
  setLabels(on: boolean): void;
  hover(m: Mark | null): void;
  /** Chạy lại hiệu ứng mọc lần lượt (theo cột rồi hàng). */
  intro(stagger?: number): void;
  update(dt: number): void;
}

const ease = (t: number) => {
  const c = 1.5;
  const x = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

/** Lưới xu hướng tuần hoàn dùng chung: quả cầu/cột theo giá trị, đổi kiểu mượt, lọc hàng/cột, xếp hàng đồ thị phụ. */
export function createTrendGrid(ctx: SimContext, data: readonly TrendDatum[], opts: TrendGridOptions): TrendGrid {
  const o = { gap: 0.35, minCell: 1.4, labels: true, ...opts };
  let sphereScale = o.sphereScale;
  const barScale = () => o.barScale ?? sphereScale * 2.4;
  const fmt = o.format ?? ((v: number) => String(v));
  const values = data.map((d) => d.value);
  const vmin = Math.min(...values);
  const vmax = Math.max(...values);
  const group = new THREE.Group();
  group.name = 'trend-grid';
  let geometry = gridGeometry(data, cellSize(data, sphereScale, o.gap, o.minCell));
  const base = createGridBase(ctx, geometry.periods, geometry.groups, o.rowLabel ?? ((p) => `${p}`), o.colLabel ?? romanGroup);
  const board = createLineupBoard(ctx, o.unit ?? '');
  board.setVisible(false);
  const geo = markGeometries(ctx);
  const marks = data.map((d) => createMark(ctx, geo, d, 0xffffff, fmt(d.value), geometry.cell));
  group.add(base.group, board.group, ...marks.map((m) => m.group));
  marks.forEach((m, i) => m.group.position.set(geometry.homes[i].x, 0, geometry.homes[i].z));

  let mode: TrendMode = o.mode ?? 'spheres';
  let barT = mode === 'spheres' ? 0 : 1;
  let sphereT = mode === 'bars' ? 0 : 1;
  let sorted = false;
  let picked: number[] | null = null;
  let lined = false;
  let introClock = Infinity;
  let introStagger = 0.06;
  let hovered: Mark | null = null;

  const colorOf = (d: TrendDatum, c: ColorMode) =>
    c === 'scale' || !d.category
      ? valueColor(d.value, vmin, vmax, o.scaleStops ?? SCALE_COOL_WARM)
      : ((o.categoryColors ?? BOOK_COLORS)[d.category] ?? 0xcccccc);
  const setColorMode = (c: ColorMode) => marks.forEach((m) => m.setColor(colorOf(m.datum, c)));
  setColorMode(o.colorMode ?? 'category');

  const place = () => {
    const slots: Slot[] = sorted ? sortedSlots(data, geometry) : geometry.homes;
    const line = picked && lined ? lineupSlots(data, picked, geometry, sphereScale) : null;
    marks.forEach((m, i) => {
      const s = line?.slots.get(i) ?? slots[i];
      m.target.set(s.x, s.y, s.z);
      const on = !picked || picked.includes(i);
      m.opacityTarget = on ? 1 : 0.16;
      m.glowTarget = (m === hovered ? 1 : 0) + (picked && on && lined ? 0.25 : 0);
    });
    board.setVisible(!!line);
    base.setHeaderOpacity(sorted ? 0.25 : 1);
    return line;
  };
  let line = place();
  const relayout = () => {
    geometry = gridGeometry(data, cellSize(data, sphereScale, o.gap, o.minCell));
    base.setCell(geometry.cell);
    for (const m of marks) m.valueTag.parent?.position.setZ(geometry.cell * 0.36);
    line = place();
  };
  relayout();
  const tops: THREE.Vector3[] = [];

  return {
    group,
    marks,
    base,
    board,
    get geometry() {
      return geometry;
    },
    get mode() {
      return mode;
    },
    get lineup() {
      return line;
    },
    setMode(m) {
      mode = m;
    },
    setColorMode,
    setSphereScale(s) {
      sphereScale = s;
      relayout();
    },
    focus(test, lineup = false) {
      picked = test ? data.map((d, i) => (test(d) ? i : -1)).filter((i) => i >= 0) : null;
      lined = lineup && !!picked?.length;
      const keep = picked;
      base.highlight(keep ? (p, g) => keep.some((i) => data[i].period === p && data[i].group === g) : null);
      line = place();
    },
    setSorted(on) {
      sorted = on;
      line = place();
    },
    setLabels(on) {
      for (const m of marks) m.tag.visible = m.valueTag.visible = on;
    },
    hover(m) {
      hovered = m;
      place();
    },
    intro(stagger = 0.06) {
      introStagger = stagger;
      introClock = 0;
      for (const m of marks) m.appear = 0;
    },
    update(dt) {
      const k = 1 - Math.exp(-5 * dt);
      barT += ((mode === 'spheres' ? 0 : 1) - barT) * k;
      sphereT += ((mode === 'bars' ? 0 : 1) - sphereT) * k;
      if (introClock !== Infinity) {
        introClock += dt;
        marks.forEach((m) => {
          const order = (m.datum.group - geometry.groups[0]) * geometry.periods.length + (m.datum.period - geometry.periods[0]);
          m.appear = Math.max(0, ease((introClock - order * introStagger) / 0.7));
        });
        if (introClock > marks.length * introStagger + 1) introClock = Infinity;
      }
      const foot = geometry.cell * 0.56;
      for (const m of marks) {
        m.apply(barT, sphereT, sphereScale, barScale(), foot);
        m.step(dt);
      }
      if (line && picked) {
        const kv = markTop(1, barT, sphereT, sphereScale, barScale());
        const ids = [...line.slots.keys()];
        tops.length = 0;
        for (const i of ids) tops.push(marks[i].group.position.clone().setY(marks[i].top));
        tops.sort((a, b) => a.x - b.x);
        const maxV = Math.max(...ids.map((i) => data[i].value));
        board.update({ x0: line.x0, x1: line.x1, z: line.z - Math.max(line.maxR, foot / 2) - 0.08, k: kv, ticks: niceTicks(maxV, 4), tops });
      }
    },
  };
}
