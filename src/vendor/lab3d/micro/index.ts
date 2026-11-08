/** Kit vi mô (B3): nguyên tố, nguyên tử Bohr, phân tử, tinh thể, sân khấu vi mô. */
// Dữ liệu nguyên tố (thuần)
export * from './elements';
// Vật liệu dùng chung
export { microMaterials, type MicroMaterials } from './materials';
// Nguyên tử
export { packSpheres, fibonacciSphere, clusterRadius, assignProtons, seeded, type Vec3 } from './atom/packing';
export { layoutOrbits, sample1sRadius, type OrbitSpec, type OrbitArrangement } from './atom/layout';
export { createNucleus, type Nucleus, type NucleusOptions, type NucleusStyle } from './atom/nucleus';
export { createOrbit, type Orbit, type OrbitStyle, type OrbitVisualOptions } from './atom/orbit';
export { createBohrAtom, type BohrAtom, type BohrAtomOptions } from './atom/bohr';
export { createElectronCloud, type ElectronCloud } from './atom/cloud';
export { createAtomBall, type AtomBallOptions } from './atom/atomBall';
// Phân tử
export type { MoleculeData, MolAtom, MolBond, BondOrder } from './molecule/types';
export { fromZMatrix, centered, type ZRow } from './molecule/zmatrix';
export { MOLECULES, getMolecule } from './molecule/library';
export * from './molecule/analysis';
export * from './molecule/style';
export { createMolecule, type MoleculeView, type MoleculeOptions } from './molecule/builder';
export type { BondView } from './molecule/bonds';
export { createMoleculeAssembly, type MoleculeAssembly, type AssemblyOptions } from './molecule/assembly';
export { createAngleMarkers, type AngleMarkers } from './molecule/angles';
// Tinh thể
export * from './crystal/lattice';
export { NACL, nodesToExtent } from './crystal/presets';
export { createCrystal, type CrystalView, type CrystalOptions, type CrystalMode, type CrystalPalette } from './crystal/builder';
export { createCrystalAssembly, type CrystalAssembly, type CrystalAssemblyOptions } from './crystal/assembly';
export { createCoordinationHighlight, type CoordinationHighlight } from './crystal/coordination';
// Sân khấu & nhãn
export { createMicroStage, type MicroStage, type MicroStageOptions } from './stage/stage';
export { backdropTexture, BACKDROPS, type BackdropColors } from './stage/backdrop';
export { createDust } from './stage/dust';
export { labelObjects, cssColor, type LabelSet } from './labels';
export { eigenSym3, principalOrient } from './molecule/orient';
export { disposeMicroObject } from './dispose';
export { createDualStage, type DualStage, type DualStageOptions, type DualStageSetOptions } from './stage/dualStage';
// Động học hạt & phản ứng (B4)
export { createBrownian, forContacts, type BrownianBox, type BrownianOptions } from './swarm/brownian';
export { createMoleculeSwarm, type MoleculeSwarm, type SwarmOptions } from './swarm/moleculeSwarm';
export { createReactionCluster, type ReactionCluster, type ClusterFrame } from './reaction/cluster';
export { createElectronFlights, type ElectronFlights } from './reaction/electrons';
// Orbital nguyên tử hiđro ψ_nlm (TN-022-01) – thuần
export * from './orbital/hydrogen';
export * from './orbital/names';
export { BOOK_FRAME, IDENTITY_FRAME, psiInScene, axisDir, type AxisFrame } from './orbital/frame';
export * from './orbital/grid';
export { polygonize, type SurfaceMesh } from './orbital/marching';
export { sampleDensity, rng, type DensityPoints } from './orbital/sampling';
export { sliceImage, type SlicePlane, type SliceLayer } from './orbital/slice';
export { orbitalField, type OrbitalField, type OrbitalGridOptions } from './orbital/orbitalGrid';
// Orbital – three
export { createOrbitalModel, type OrbitalModel, type OrbitalModelOptions, type OrbitalDisplay } from './orbital/orbitalModel';
export { createIsosurface, type Isosurface, type IsosurfaceOptions } from './orbital/isosurface';
export { createLobeMaterial, createRimMaterial, type RimMaterial } from './orbital/materials';
export { createOrbitalCloud, type OrbitalCloud } from './orbital/cloud';
export { createDensitySlice, type DensitySlice } from './orbital/sliceMesh';
export { createOrbitalAxes, type OrbitalAxes, type OrbitalAxesOptions } from './orbital/axes';
// Tán xạ Coulomb (Rutherford, TN-013-02) – thuần; Vec3 của module trùng tên → ScatterVec3
export {
  scatterPath, pathPointAt, rutherfordAngle, impactForAngle,
  type ScatterPath, type PathOptions as ScatterPathOptions, type FieldModel, type Vec3 as ScatterVec3,
} from './scattering/coulombPath';
// Số liệu SGK
export { ATOMIC_RADIUS_BOOK, bookRadius, type BookRadius } from './data/atomicRadiusBook';
export {
  IONIZATION_ENERGY, IONIZATION_SET_LABEL, ionization, ionizationOf, type IonizationDatum, type IonizationSet,
} from './data/ionizationEnergy';
export { ELECTRONEGATIVITY_BOOK, electronegativity, type ElectronegativityDatum, type BookCellColor } from './data/electronegativityBook';

// Kit bổ sung (Sinh 10 đợt 1–2 + Hoá Integration 2) – export * theo module.
export * from './cutaway/shell';
export * from './embryo/eggParts';
export * from './embryo/embryo';
export * from './interactions/dottedLines';
export * from './orbitalAtom/atom';
export * from './orbitalAtom/drag';
export * from './orbitalAtom/occupancy';
export * from './orbitalDiagram/arrow';
export * from './orbitalDiagram/box';
export * from './orbitalDiagram/configuration';
export * from './orbitalDiagram/diagram';
export * from './orbitalDiagram/electron';
export * from './orbitalDiagram/filling';
export * from './orbitalDiagram/framing';
export * from './orbitalDiagram/kit';
export * from './orbitalDiagram/layout';
export * from './orbitalDiagram/quiz';
export * from './orbitalDiagram/sound';
export * from './orbitalDiagram/subshell';
export * from './protist/organelles';
export * from './protist/paramecium';
export * from './protist/parameciumShape';
export * from './surface/ionBlocks';
export * from './surface/surfaceModel';
export * from './tissue/brightfield';
export * from './tissue/voronoi';
export * from './virus/phage';
export * from './manipulator/index';
