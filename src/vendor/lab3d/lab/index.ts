/** Kit vĩ mô phòng thí nghiệm (B2). Thang đo: 1 đơn vị = 1 dm, mặt bàn y = 0. */
export * from './units';
export type { P2, Tracker, Updatable } from './types';
// Vật liệu
export * from './materials/factories';
export { labMaterials, type LabMaterials } from './materials/kit';
export { LAB_PALETTE, LAB_ACCENT, accentColor, type LabAccent } from './materials/palette';
export { epoxyTextures, woodTexture, tileTexture } from './materials/textures';
export { makeCanvas, canvasTexture } from './materials/canvas';
// Dụng cụ thuỷ tinh
export * from './glassware/profile';
export * from './glassware/shapes';
export { createVessel, latheFromProfile, RENDER_ORDER, type Vessel, type VesselOptions } from './glassware/vessel';
export { createGraduations, type GradMark, type GraduationOptions } from './glassware/graduations';
export * from './glassware/items';
export * from './glassware/misc';
export { chaikin, densify, arc, dedupe, offsetInward } from './glassware/curves';
export { createWrapLabel, type WrapLabel, type WrapLabelOptions } from './glassware/wrapLabel';
// Proxy va chạm thô của vật chứa (createVessel tự gắn) + đo độ xuyên khi rót / đặt (DEV: __ix.overlaps())
export { proxyFromProfile, frustumProxy, shiftProxy, type ClearanceProxy } from './geometry/clearance';
export { setClearance, clearanceOf } from './geometry/clearancePairs';
export { linkPour, measureOverlaps, type Overlap } from './geometry/overlapProbe';
export { setRimHinge, rimHingeAt } from './geometry/rimHinge';
// Chất lỏng & hiệu ứng
export { createLiquid, createGasFill, type Liquid, type LiquidOptions } from './liquid/liquid';
export { liquidShape, liquidInner } from './liquid/meniscus';
export { createLiquidMaterial, applyLiquidLook, type LiquidLook } from './liquid/liquidMaterial';
export { createLayeredLiquid, type LayeredLiquid, type LayerSpec, type LiquidLayer } from './liquid/layeredLiquid';
export { createLevelClip, type LevelClip } from './liquid/levelClip';
export { createBubbles, type Bubbles, type BubbleOptions } from './effects/bubbles';
export { createParticles, type Particles, type ParticleOptions } from './effects/particles';
export { PARTICLE_PRESETS, type ParticlePresetName } from './effects/particlePresets';
export type { ParticleConfig } from './effects/particleModel';
export { createPrecipitate, type Precipitate, type PrecipitateOptions } from './effects/precipitate';
export { createPrecipitateCloud, type PrecipitateCloud, type PrecipitateCloudOptions } from './effects/precipitateCloud';
export { createFlame, type Flame, type FlameOptions } from './effects/flame';
export { createFoam, type Foam, type FoamOptions } from './effects/foam';
export { createSuspension, type Suspension, type SuspensionOptions } from './effects/suspension';
export { createPourStream, createPourAction, type PourStream, type PourStreamOptions, type PourAction, type PourPose } from './effects/pour';
// Thiết bị
export { createAlcoholLamp, type AlcoholLamp } from './equipment/alcoholLamp';
export { createRetortStand, type RetortStand, type RetortStandOptions } from './equipment/retortStand';
export { createTubeRack, type TubeRack } from './equipment/tubeRack';
export { createTubeHolder } from './equipment/tubeHolder';
export { holderGrip, type HolderGrip, type HolderGripOptions } from './equipment/holderGrip';
export { createDropper, dropperBulb } from './equipment/dropper';
export { createThermometer, type Thermometer } from './equipment/thermometer';
export { createDigitalScale, type DigitalScale } from './equipment/digitalScale';
export { createSplint, type Splint, type SplintState } from './equipment/splint';
export { createStopwatch, type StopwatchView } from './equipment/stopwatch';
export { createPaperSheet, drawCrossMark, type PaperOptions } from './equipment/paperSheet';
export { createSpatula, type Spatula } from './equipment/spatula';
export { createNail, type Nail } from './equipment/nail';
export { createPlatedMaterial, type PlatedMaterial } from './materials/plating';
export { createOpenTubeRack, type OpenTubeRack } from './equipment/openTubeRack';
export { createPipetteStand, type PipetteStand } from './equipment/pipetteStand';
export { createReagentBottle, type ReagentBottle, type ReagentBottleOptions, type ReagentBottleStyle } from './equipment/reagentBottle';
// Thao tác (hoạt cảnh tay)
// Ống hút nhỏ giọt CHUẨN: createDripAction. createDropperAction = lớp tương thích (TN-115-04).
export { createDripAction, type DripAction, type DripTask, type DripActionOptions } from './actions/dripInto';
export { createDropperAction, type DropperAction, type DropJob, type DropperActionOptions } from './actions/dropperAction';
export { createVesselShaker, type VesselShaker } from './actions/shakeVessel';
// Điểm sáng cộng màu / chớp sáng (không cần post-processing)
export { createGlowPoints, createFlashPool, type GlowPoints, type FlashPool } from './scattering/glowPoints';
// Phòng
export { createLabStage, type LabStage, type LabStageOptions } from './room/stage';
export { createBench, type BenchOptions, type BenchTop } from './room/bench';
export { createLabRoom } from './room/labRoom';
export { createLightRig, kelvinToColor, type LightRig } from './room/lighting';
export { createWallShelf } from './room/shelf';
export { createContactShadow } from './room/contactShadow';
export { createLabLighting, type LabLighting, type LabLightingOptions } from './room/labLighting';
export { createLabPost, type LabPost, type LabPostOptions } from './room/labPost';
export { createLabBackdrop, type BackdropOptions } from './room/backdrop';
export { LAB_LOOKS, type LabLightingPreset, type LabLook, type LightLevels, type BackdropColors as LabBackdropColors } from './room/lightingPresets';
// Tương tác
export { createPicker, type Picker, type PickerHandlers } from './interaction/picker';
export { createOutline, createOutlineMaterial } from './interaction/outline';
export { createCameraTween, type CameraTween } from './interaction/cameraTween';
// Động học (thuần)
export * from './kinetics/timeline';
// Kính hiển vi & tiêu bản (Sinh 10, từ TN-071-01) – xem docs/kit-notes/TN-071-01.md
export { createMicroscope, type Microscope } from './microscopy/microscope';
export { createSlideKit, type SlideKit } from './microscopy/slide';
export { createFieldView, type FieldView } from './microscopy/fieldView';
export { createMover, createSequence, createTimers, type Mover, type Pose, type Step } from './microscopy/motion';
export { createLeaf, createRazor, createBlotter } from './microscopy/props';
export { fitOilObjective, type Objective, type OilTurret } from './microscopy/oilObjective';
export { createScopeField, type ScopeField } from './microscopy/scopeField';
export { createInoculatingLoop, createWashBottle, createWashBasin, type InoculatingLoop } from './microscopy/smearTools';
export { createTripodGauze, type TripodGauze, type TripodGauzeOptions } from './equipment/tripodGauze';
export { createIceCubes, type IceCubes, type IceCubesOptions } from './equipment/iceCubes';
export { createPipette, type Pipette, type PipetteOptions } from './glassware/pipette';
export { phColor, createPhCard } from './indicators/ph';

// Kit bổ sung (Sinh 10 đợt 1–2 + Hoá Integration 2) – export * theo module.
export * from './anatomy/mouthModel';
export * from './animals/sheep';
// antibiogram: chỉ phần riêng – đĩa thạch/tủ ấm/panh của nó trùng bản chuẩn (microbio, tissueCulture), sẽ gộp.
export { createLawnPainter, type LawnHole, type LawnState } from './antibiogram/lawn';
export { createAntibioticDisc, createDiscCartridges, type DiscSpec } from './antibiogram/discs';
export { createSwab, createRuler } from './antibiogram/tools';
export * from './antique/brassMicroscope';
export * from './antique/deskProps';
export * from './antique/notebook';
export * from './antique/paperSlide';
export * from './antique/studyRoom';
export * from './centrifuge/lcd';
export * from './centrifuge/machine';
export * from './centrifuge/panel';
export * from './centrifuge/rotor';
export * from './centrifuge/rotorPoses';
export * from './centrifuge/tube';
export * from './dye/dyeField';
export * from './dye/dyeLiquid';
export * from './effects/profileGas';
export * from './effects/volumeGas';
export * from './electric/ammeter';
export * from './electric/battery';
export * from './electric/bulb';
export * from './electric/circuit';
export * from './electric/conductivity';
export * from './electric/dialFace';
export * from './electric/electrode';
export * from './electric/glow';
export * from './electric/parts';
export * from './electric/powerSupply';
export * from './electric/wire';
export * from './equipment/aquarium';
// equipment/centrifuge (chỉ danh mục thiết bị dùng) trùng bản chuẩn centrifuge/machine – sẽ gộp, không export.
export * from './equipment/kitchen';
export * from './equipment/labFridge';
export * from './equipment/orbitalShaker';
export * from './equipment/stereoMicroscope';
export * from './equipment/uvLamp';
export * from './equipment/waterBath';
export * from './frog/frog';
export * from './frog/skin';
export * from './frog/tadpole';
export * from './grinding/mortar';
export * from './microbio';
export * from './micromanip/invertedMicroscope';
export * from './micromanip/micromanipulator';
export * from './microscopy/cavitySlide';
export * from './plants/onionBulb';
export * from './plants/solanum';
export * from './solids/balloon';
export * from './solids/crystalFlakes';
export * from './solids/needleDeposit';
export * from './solids/powder';
export * from './solids/rock';
export * from './solids/watchGlass';
export * from './surface-bubbles/model';
export * from './surface-bubbles/surfaceBubbles';
export * from './tissueCulture/growthShelf';
export * from './tissueCulture/hood';
export * from './tissueCulture/tobacco';
export * from './tissueCulture/tools';
export { createRig, createJobs, lift, type Rig, type RigOptions } from './actions/rig';
export { EQUIPMENT, EQUIPMENT_FAMILIES, type EquipmentEntry, type EquipmentFamily } from './catalog/equipment';
export { createEquipmentGallery, type EquipmentGallery } from './catalog/gallery';
// K1 Tủ & thiết bị lớn (tủ an toàn sinh học, thùng xốp/hộp đá, đun cách thuỷ, khối gia nhiệt, bộ điều nhiệt)
export * from './equipment/biosafetyCabinet';
export * from './equipment/foamBox';
export * from './equipment/beakerBath';
export * from './equipment/heatBlock';
export * from './equipment/thermostat';
// Đồ chứa dùng chung (K2): lọ nắp, ca/ấm/nồi, bát/rổ, cốc/lon, khay/mẹt, đĩa sứ/đĩa giếng, hộp giấy, đĩa petri đủ bộ, ống nhãn/nắp, eppendorf.
export { createJar, JAR_PRESETS, type Jar, type JarOptions, type JarPreset } from './containers/jar';
export { createJug, createKettle, createCookPot, type Jug, type JugOptions, type Kettle, type CookPot } from './containers/kitchenware';
export { createBowl, createBasket, type Bowl, type BowlOptions, type Basket } from './containers/bowl';
export { createCup, createCan, CUP_PRESETS, type Cup, type CupOptions, type CupPreset, type Can } from './containers/cup';
export { createTray, createWovenTray, type Tray, type TrayOptions } from './containers/tray';
export { createPlate, createSpotPlate, type Plate, type PlateOptions, type SpotPlate, type SpotPlateOptions } from './containers/plate';
export { createCartonBox } from './containers/box';
export { createPetri, type Petri, type PetriLid, type PetriOptions } from './containers/petri';
export { createLabelledTube, createMicroTube, addTubeLabel, type LabelledTube, type LabelledTubeOptions, type MicroTube, type MicroTubeOptions } from './containers/tube';
// Dụng cụ cầm tay dùng chung (K3): panh, kéo, kim, dao, dao lam, bút chì, thước, thìa, đũa, micropipette, pipet nhựa, dụng cụ ép.
export * from './handTools';
// Bàn tay & đồ để bàn (K4)
export * from './desk';
export { createDeliveryTube, type DeliveryTube, type DeliveryTubeOptions } from './glassware/deliveryTube';
