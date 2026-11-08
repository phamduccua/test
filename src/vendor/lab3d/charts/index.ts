/** Đồ thị (B4): đồ thị đường canvas, màn hình bộ thu số liệu 3D, cột 3D, lưới xu hướng tuần hoàn, histogram log. */
export { drawPlot, type PlotSeries, type PlotStyle } from './plotCanvas';
export { createPlotPanel, type PlotPanel } from './plotPanel';
export { createBars3d, type Bars3D } from './bars3d';
// Lưới xu hướng bảng tuần hoàn (TN-035-03)
export type { TrendDatum, TrendMode, ColorMode, TrendGridOptions, Slot } from './periodic/types';
export * from './periodic/layout';
export * from './periodic/colorScale';
export { createTrendGrid, type TrendGrid } from './periodic/trendGrid';
export { createMark, markGeometries, type Mark, type MarkGeometries } from './periodic/marks';
export { createGridBase, type GridBase } from './periodic/gridBase';
export { createLineupBoard, type LineupBoard, type BoardFrame } from './periodic/lineupBoard';
export { createTrendArrow, type TrendArrow, type TrendArrowOptions } from './periodic/trendArrow';
// Histogram thang log (HTML canvas trên khung 3D, TN-013-02)
export {
  createLogHistogram, type LogHistogram, type LogHistogramOptions, type LogHistogramData, type HistSeries,
} from './scattering/logHistogram';
// Khung trục 3D + đường gấp khúc dày + vùng tô (TN-036-01); AxisFrame đổi tên tránh trùng orbital AxisFrame (micro)
export { createAxisFrame3d, type AxisFrame as AxisFrame3d, type AxisFrameOptions as AxisFrame3dOptions } from './axes/axisFrame3d';
export { createTubePolyline, type TubePolyline, type TubePolylineOptions } from './lines/tubePolyline';
export { createProfileRibbon, type ProfileRibbon } from './lines/profileRibbon';

// Kit bổ sung (Sinh 10 đợt 1–2 + Hoá Integration 2) – export * theo module.
export * from './periodic/bilinear';
export * from './periodic/trendSurface';
export * from './thermoBars/thermoBars3d';
export { createResultCard, type ResultCard, type ResultCardOptions } from './cards/resultCard';
