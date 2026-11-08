/** Kit vi sinh (Sinh 10, từ TN-120-01): đĩa thạch, cấy ria, khuẩn lạc mọc theo thời gian, que cấy nóng đỏ, đèn Bunsen, ống nuôi cấy, tủ ấm. */
// Thuần (không three)
export * from './growth';
export * from './random';
export * from './streak';
export * from './patterns';
export * from './colonies';
// Three
export { createAgarPlate, type AgarPlate, type AgarPlateOptions, type AgarSurface } from './agarPlate';
export { createSurfacePainter, type SurfacePainter } from './surface';
export { createColonyLayer, type ColonyLayer } from './colonyMesh';
export { createHotLoop, type HotLoop } from './hotLoop';
export { createBunsenBurner, type Burner } from './burner';
export { createCultureTube, type CultureTube, type CultureTubeOptions } from './cultureTube';
export { createIncubator, type Incubator, type IncubatorOptions } from './incubator';
