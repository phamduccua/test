import * as THREE from 'three';
import type { SimContext } from '../../sim/types';
import { createBeaker, createErlenmeyer, createGraduatedCylinder, createRoundFlask, createTestTube } from '../glassware/items';
import { createFunnel, createGlassRod, createPetriDish } from '../glassware/misc';
import { createPipette } from '../glassware/pipette';
import { createAlcoholLamp } from '../equipment/alcoholLamp';
import { createCentrifuge } from '../equipment/centrifuge';
import { createDigitalScale } from '../equipment/digitalScale';
import { createDropper } from '../equipment/dropper';
import { createCuttingBoard, createGlassBowl, createKitchenKnife } from '../equipment/kitchen';
import { createLabFridge } from '../equipment/labFridge';
import { createMortar } from '../equipment/mortar';
import { createReagentBottle } from '../equipment/reagentBottle';
import { createRetortStand } from '../equipment/retortStand';
import { createSpatula } from '../equipment/spatula';
import { createStopwatch } from '../equipment/stopwatch';
import { createThermometer } from '../equipment/thermometer';
import { createTripodGauze } from '../equipment/tripodGauze';
import { createTubeHolder } from '../equipment/tubeHolder';
import { createTubeRack } from '../equipment/tubeRack';
import { createWaterBath } from '../equipment/waterBath';
import { createAquarium } from '../equipment/aquarium';
import { createBeakerBath } from '../equipment/beakerBath';
import { createBiosafetyCabinet } from '../equipment/biosafetyCabinet';
import { createFoamBox } from '../equipment/foamBox';
import { createHeatBlock } from '../equipment/heatBlock';
import { createStereoMicroscope } from '../equipment/stereoMicroscope';
import { createThermostat } from '../equipment/thermostat';
import { createUvLamp } from '../equipment/uvLamp';
import { createDensitometer } from '../microbio/densitometer';
import { createInvertedMicroscope } from '../micromanip/invertedMicroscope';
import { createGrowthShelf } from '../tissueCulture/growthShelf';
import { mm } from '../units';
import { createAgarPlate } from '../microbio/agarPlate';
import { createBunsenBurner } from '../microbio/burner';
import { createCultureTube } from '../microbio/cultureTube';
import { createIncubator } from '../microbio/incubator';
import { createMicroscope } from '../microscopy/microscope';
import { createRazor } from '../microscopy/props';
import { createInoculatingLoop, createWashBasin, createWashBottle } from '../microscopy/smearTools';
import { createBasket, createBowl } from '../containers/bowl';
import { createCartonBox } from '../containers/box';
import { createCan, createCup } from '../containers/cup';
import { createJar } from '../containers/jar';
import { createCookPot, createJug, createKettle } from '../containers/kitchenware';
import { createPetri } from '../containers/petri';
import { createPlate, createSpotPlate } from '../containers/plate';
import { createTray, createWovenTray } from '../containers/tray';
import { createLabelledTube, createMicroTube } from '../containers/tube';
import { createSwab } from '../antibiogram/tools';
import { createScalpel } from '../tissueCulture/tools';
import {
  createChopsticks, createGarlicPress, createKnife, createLabRuler, createMicropipette, createNeedle, createPencil, createRazorBlade,
  createScissors, createSpoon, createTransferPipette, createTweezers,
} from '../handTools';
import { DESK_EQUIPMENT } from './deskEquipment';
import { labText } from '../../text';

/** Nhóm dụng cụ trong thư viện (thứ tự = thứ tự hiển thị). */
export const EQUIPMENT_FAMILIES = {
  glass: labText('t_3d00363f012e'),
  container: labText('t_60f3551e2186'),
  tool: labText('t_8a60aad4947f'),
  heat: labText('t_c6e055af2a75'),
  device: labText('t_c2c41b8d5610'),
  cabinet: labText('t_99760218229f'),
  micro: labText('t_26c746b86bc6'),
  microbio: 'Vi sinh',
  hand: labText('t_3630c2e3f166'),
} as const;
export type EquipmentFamily = keyof typeof EQUIPMENT_FAMILIES;

/** Một dụng cụ dùng chung: tên hiển thị, hàm tạo kit (`api` = cách gọi để tra), nhóm. */
export interface EquipmentEntry {
  id: string;
  name: string;
  family: EquipmentFamily;
  api: string;
  make(ctx: SimContext): THREE.Object3D;
}

type HasGroup = THREE.Object3D | { group: THREE.Object3D } | { mesh: THREE.Object3D };
const obj = (x: HasGroup): THREE.Object3D => (x instanceof THREE.Object3D ? x : 'group' in x ? x.group : x.mesh);
const e = (id: string, family: EquipmentFamily, name: string, api: string, make: (ctx: SimContext) => HasGroup): EquipmentEntry => ({
  id, family, name, api, make: (ctx) => obj(make(ctx)),
});

/**
 * Danh mục MỌI dụng cụ dùng chung của kit (Hoá, Sinh, Địa, nhóm khác). Thêm component mới vào kit thì thêm một dòng ở đây –
 * thư viện (createEquipmentGallery, sim KIT-DUNGCU) tự bày ra để kiểm màu/tỉ lệ dưới preset bench.
 */
export const EQUIPMENT: EquipmentEntry[] = [
  e('test-tube', 'glass', labText('t_c65927738c6c'), 'createTestTube(ctx, 16, 160)', (c) => createTestTube(c)),
  e('beaker', 'glass', labText('t_75fd881d8e72'), 'createBeaker(ctx, 250)', (c) => createBeaker(c)),
  e('beaker-50', 'glass', labText('t_884ff873c837'), 'createBeaker(ctx, 50)', (c) => createBeaker(c, 50)),
  e('beaker-150', 'glass', labText('t_2c79299bb7ae'), 'createBeaker(ctx, 150)', (c) => createBeaker(c, 150)),
  e('beaker-1000', 'glass', labText('t_532d0186fda3'), 'createBeaker(ctx, 1000)', (c) => createBeaker(c, 1000)),
  e('erlenmeyer', 'glass', labText('t_e2a225f280ea'), 'createErlenmeyer(ctx)', (c) => createErlenmeyer(c)),
  e('erlenmeyer-50', 'glass', labText('t_019c82cdc61f'), 'createErlenmeyer(ctx, 50)', (c) => createErlenmeyer(c, 50)),
  e('erlenmeyer-500', 'glass', labText('t_a68b99738252'), 'createErlenmeyer(ctx, 500)', (c) => createErlenmeyer(c, 500)),
  e('round-flask', 'glass', labText('t_9637747acf7d'), 'createRoundFlask(ctx)', (c) => createRoundFlask(c)),
  e('cylinder', 'glass', labText('t_42029e78941b'), 'createGraduatedCylinder(ctx)', (c) => createGraduatedCylinder(c)),
  e('funnel', 'glass', labText('t_433a2d7fcf90'), 'createFunnel(ctx)', (c) => createFunnel(c)),
  e('glass-rod', 'glass', labText('t_a01251c7204d'), 'createGlassRod(ctx)', (c) => createGlassRod(c)),
  e('pipette', 'glass', 'Pipet', 'createPipette(ctx)', (c) => createPipette(c)),
  e('petri', 'glass', labText('t_d1dcfc5bb663'), 'createPetriDish(ctx, 90)', (c) => createPetriDish(c)),
  e('reagent-bottle', 'container', labText('t_73d4e05a9e9d'), "createReagentBottle(ctx, { label })", (c) => createReagentBottle(c, { label: 'NaCl', sublabel: '0,9 %', capColor: 0x1f5fbf })),
  e('glass-bowl', 'container', labText('t_737d1cd4deb6'), 'createGlassBowl(ctx)', (c) => createGlassBowl(c)),
  e('wash-bottle', 'container', labText('t_4f1629308983'), 'createWashBottle(ctx)', (c) => createWashBottle(c)),
  e('dropper-bottle', 'container', labText('t_ae5072e7d7bc'), "createReagentBottle(ctx, { style: 'dropper' })", (c) => createReagentBottle(c, { style: 'dropper', label: labText('t_0e43de5b8c0a'), capColor: 'blue', liquidColor: 0xdcecf4, liquidOpacity: 0.06 })),
  e('dropper-bottle-amber', 'container', labText('t_fd5a86870563'), "createReagentBottle(ctx, { style: 'dropper', amber })", (c) => createReagentBottle(c, { style: 'dropper', amber: true, label: labText('t_dd7678c7951c'), capColor: 'yellow', dropper: 'red', liquidColor: '#e8c45a', liquidOpacity: 0.9 })),
  e('plastic-bottle', 'container', labText('t_a5398a29b552'), "createReagentBottle(ctx, { style: 'plastic' })", (c) => createReagentBottle(c, { style: 'plastic', label: 'NaCl', sublabel: '0,9 %', labelStripe: 'teal', capColor: 'teal', liquidColor: 0xdcecf4, liquidOpacity: 0.06, fill: 0.8 })),
  e('wide-jar-bottle', 'container', labText('t_9418bb405c58'), "createReagentBottle(ctx, { style: 'wide' })", (c) => createReagentBottle(c, { style: 'wide', amber: true, label: 'KMnO₄', labelStripe: 'purple', capColor: '#262b33', solidColor: '#4a1f5c', solidFill: 0.5 })),
  e('jar', 'container', labText('t_0e2ff4843f51'), "createJar(ctx, { preset: 'yogurt' })", (c) => createJar(c, { preset: 'yogurt', liquid: { volumeML: 140, color: '#f2ead8', opacity: 1, turbidity: 1 } })),
  e('jar-pickle', 'container', labText('t_26c1fb608613'), "createJar(ctx, { preset: 'pickle' })", (c) => createJar(c, { preset: 'pickle', liquid: { volumeML: 1800, color: '#e6dc9a', opacity: 0.25 } })),
  e('jar-specimen', 'container', labText('t_156dad868174'), "createJar(ctx, { preset: 'specimen', open })", (c) => createJar(c, { preset: 'specimen', open: true, label: labText('t_71457e17885e'), labelStripe: '#c8372d', liquid: { volumeML: 12, color: '#dcecf4', opacity: 0.08 } })),
  e('jar-anaerobic', 'container', labText('t_0564d32caeac'), "createJar(ctx, { preset: 'anaerobic' })", (c) => createJar(c, { preset: 'anaerobic' })),
  e('jug', 'container', labText('t_7fda8952607c'), 'createJug(ctx)', (c) => createJug(c, { liquid: { volumeML: 700, color: '#cfe6f2', opacity: 0.1 } })),
  e('kettle', 'container', labText('t_f343f4b29203'), 'createKettle(ctx)', (c) => createKettle(c)),
  e('cook-pot', 'container', labText('t_a7e50382caba'), 'createCookPot(ctx, { lid })', (c) => createCookPot(c, { lid: true })),
  e('bowl', 'container', labText('t_febb20602870'), "createBowl(ctx, { grains })", (c) => createBowl(c, { grains: { color: '#eceae2', size: mm(3.4) } })),
  e('bowl-plastic', 'container', labText('t_2225cb286ef5'), "createBowl(ctx, { material: 'plastic' })", (c) => createBowl(c, { material: 'plastic', color: 'orange' })),
  e('basket', 'container', labText('t_a5bcc1f8b0dc'), 'createBasket(ctx)', (c) => createBasket(c)),
  e('wash-basin', 'container', labText('t_bf6df004080f'), 'createWashBasin(ctx)', (c) => createWashBasin(c)),
  e('cup-plastic', 'container', labText('t_05b95e5d25f5'), "createCup(ctx, { preset: 'plastic' })", (c) => createCup(c, { liquid: { volumeML: 110, color: '#cfe6f2', opacity: 0.1 } })),
  e('cup-paper', 'container', labText('t_4781232b4de4'), "createCup(ctx, { preset: 'paper' })", (c) => createCup(c, { preset: 'paper', color: 'red' })),
  e('cup-sputum', 'container', labText('t_7a801590ea7f'), "createCup(ctx, { preset: 'sputum', lid })", (c) => createCup(c, { preset: 'sputum', lid: 'red', label: 'BN 01' })),
  e('cup-bin', 'container', labText('t_562170584a5f'), "createCup(ctx, { preset: 'bin' })", (c) => createCup(c, { preset: 'bin' })),
  e('can', 'container', labText('t_3371716d98a0'), "createCan(ctx, { kind: 'can' })", (c) => createCan(c, { kind: 'can', text: labText('t_65235b4a504e'), sub: labText('t_05b8bd607707') })),
  e('tub', 'container', labText('t_cac16ac3bdfc'), "createCan(ctx, { kind: 'tub' })", (c) => createCan(c, { kind: 'tub', text: labText('t_e308f51b91b7'), sub: labText('t_87f4ff019cc3') })),
  e('carton-box', 'container', labText('t_f5c7c9ca2a9b'), 'createCartonBox(ctx, { title })', (c) => createCartonBox(c, { title: 'Amoxicillin', sub: labText('t_a86acab53ead'), color: 'red' })),
  e('tray', 'container', 'Khay men', 'createTray(ctx)', (c) => createTray(c)),
  e('tray-dissect', 'container', labText('t_c2f8c549e1af'), "createTray(ctx, { floor: '#3a3833' })", (c) => createTray(c, { width: 200, depth: 140, height: 18, floor: '#3a3833' })),
  e('tray-plastic', 'container', labText('t_8b5a7d885b45'), "createTray(ctx, { material: 'plastic' })", (c) => createTray(c, { material: 'plastic', color: 'teal', width: 220, depth: 160 })),
  e('woven-tray', 'container', labText('t_615aa686f86a'), 'createWovenTray(ctx)', (c) => createWovenTray(c, { diameter: 300 })),
  e('plate', 'container', labText('t_b273fbbe2f60'), 'createPlate(ctx)', (c) => createPlate(c)),
  e('spot-plate', 'container', labText('t_48708db8edb5'), 'createSpotPlate(ctx, { cols, rows })', (c) => createSpotPlate(c, { cols: 3, rows: 2, liquid: '#e3d28e' })),
  e('petri-set', 'container', labText('t_87995c63ea5f'), "createPetri(ctx, { lid: 'side', liquid })", (c) => createPetri(c, { lid: 'side', mark: 'A', liquid: { color: '#cfe0b8', opacity: 0.3 } })),
  e('labelled-tube', 'container', labText('t_83c525e2dadc'), 'createLabelledTube(ctx, { label, cap })', (c) => createLabelledTube(c, { label: '1', cap: 'red', liquid: { volumeML: 8, color: '#f0dc7a', opacity: 0.3 } })),
  e('microtube', 'container', labText('t_1c2201c9167d'), 'createMicroTube(ctx)', (c) => createMicroTube(c, { open: 0.6, liquid: { volumeML: 0.8, color: '#e48aa6', opacity: 0.5 } })),
  e('pcr-tube', 'container', labText('t_1d1653e862e0'), "createMicroTube(ctx, { kind: 'pcr' })", (c) => createMicroTube(c, { kind: 'pcr', color: 'yellow' })),
  e('dropper', 'tool', labText('t_235ba28df365'), 'createDropper(ctx)', (c) => createDropper(c)),
  e('spatula', 'tool', labText('t_d0da3a768114'), 'createSpatula(ctx)', (c) => createSpatula(c)),
  e('knife', 'tool', 'Dao', 'createKitchenKnife(ctx)', (c) => createKitchenKnife(c)),
  e('razor', 'tool', labText('t_2be93878018f'), 'createRazor(ctx)', (c) => createRazor(c)),
  e('cutting-board', 'tool', labText('t_83a5a811e2d1'), 'createCuttingBoard(ctx)', (c) => createCuttingBoard(c)),
  e('mortar', 'tool', labText('t_d340a240379c'), 'createMortar(ctx)', (c) => createMortar(c)),
  e('tube-holder', 'tool', labText('t_ab54b288e380'), 'createTubeHolder(ctx)', (c) => createTubeHolder(c)),
  e('tweezers', 'tool', labText('t_cc10e24f0642'), 'createTweezers(ctx, { point, grips, length })', (c) => createTweezers(c)),
  e('tweezers-blunt', 'tool', labText('t_6c90ef79760b'), "createTweezers(ctx, { point: 'blunt', grips: 'green' })", (c) => createTweezers(c, { point: 'blunt', grips: 'green' })),
  e('scissors', 'tool', labText('t_c8e9072e3892'), 'createScissors(ctx, { handles, point })', (c) => createScissors(c)),
  e('needle', 'tool', labText('t_217dd2cee5bc'), 'createNeedle(ctx)', (c) => createNeedle(c)),
  e('lancet', 'tool', labText('t_4d2cd4c4d52d'), "createNeedle(ctx, { kind: 'lancet' })", (c) => createNeedle(c, { kind: 'lancet' })),
  e('scalpel', 'tool', labText('t_5edc5fb947b0'), 'createScalpel(ctx)', (c) => createScalpel(c)),
  e('cleaver', 'tool', labText('t_8782c34de4f9'), "createKnife(ctx, { kind: 'cleaver' })", (c) => createKnife(c, { kind: 'cleaver' })),
  e('razor-single', 'tool', labText('t_9962923887b7'), "createRazorBlade(ctx, { kind: 'single' })", (c) => createRazorBlade(c, { kind: 'single' })),
  e('pencil', 'tool', labText('t_b952a836f185'), 'createPencil(ctx, { color, eraser })', (c) => createPencil(c)),
  e('ruler', 'tool', labText('t_0cf28852a3ad'), 'createLabRuler(ctx, { length: 150 })', (c) => createLabRuler(c)),
  e('ruler-standing', 'tool', labText('t_c26c6b66f2c6'), "createLabRuler(ctx, { kind: 'standing', length })", (c) => {
    const r = createLabRuler(c, { kind: 'standing', length: 500 });
    r.setMark(320);
    return r;
  }),
  e('spoon', 'tool', labText('t_a8711d2928b0'), 'createSpoon(ctx, { kind, handle })', (c) => {
    const s = createSpoon(c);
    s.setLoad(true, '#efe9da');
    return s;
  }),
  e('chopsticks', 'tool', labText('t_17baa9e512d6'), 'createChopsticks(ctx, { length, band })', (c) => createChopsticks(c)),
  e('micropipette', 'tool', 'Micropipette 20 µL', 'createMicropipette(ctx, { range: 20 })', (c) => createMicropipette(c)),
  e('micropipette-200', 'tool', 'Micropipette 200 µL', 'createMicropipette(ctx, { range: 200 })', (c) => {
    const p = createMicropipette(c, { range: 200, volume: 100 });
    p.setLoad('#c8372d');
    return p;
  }),
  e('micropipette-1000', 'tool', 'Micropipette 1000 µL', 'createMicropipette(ctx, { range: 1000 })', (c) => createMicropipette(c, { range: 1000, volume: 500 })),
  e('transfer-pipette', 'tool', labText('t_9293d7af1cf1'), 'createTransferPipette(ctx)', (c) => {
    const p = createTransferPipette(c);
    p.setFill(0.5, '#2e8b57');
    return p;
  }),
  e('garlic-press', 'tool', labText('t_2cd64b8e4c75'), 'createGarlicPress(ctx, { grips })', (c) => createGarlicPress(c)),
  e('swab', 'tool', labText('t_b28d131df424'), 'createSwab(ctx)', (c) => createSwab(c)),
  e('tube-rack', 'heat', labText('t_33d7547d326c'), 'createTubeRack(ctx, { slots: 4 })', (c) => createTubeRack(c, { slots: 4 })),
  e('alcohol-lamp', 'heat', labText('t_d5df2f4e7bce'), 'createAlcoholLamp(ctx, { lit })', (c) => createAlcoholLamp(c, { lit: true })),
  e('tripod', 'heat', labText('t_4412b5f18de6'), 'createTripodGauze(ctx)', (c) => createTripodGauze(c)),
  e('retort-stand', 'heat', labText('t_95b51e72b98c'), 'createRetortStand(ctx)', (c) => createRetortStand(c)),
  e('thermometer', 'heat', labText('t_b1c297cc9e0d'), 'createThermometer(ctx)', (c) => createThermometer(c, { value: 37 })),
  e('beaker-bath', 'heat', labText('t_52aed908af4e'), 'createBeakerBath(ctx, { lit, thermometer })', (c) => {
    const b = createBeakerBath(c, { lit: true, temperature: 100, thermometer: true });
    b.update(0.5, 0);
    return b;
  }),
  e('stopwatch', 'heat', labText('t_283d459e2235'), 'createStopwatch(ctx)', (c) => createStopwatch(c)),
  e('scale', 'device', labText('t_851a8f0e55f5'), 'createDigitalScale(ctx)', (c) => createDigitalScale(c)),
  e('water-bath', 'device', labText('t_58721ec15c5e'), 'createWaterBath(ctx)', (c) => createWaterBath(c)),
  e('centrifuge', 'device', labText('t_4fad8ef92c82'), 'createCentrifuge(ctx)', (c) => createCentrifuge(c)),
  e('heat-block', 'device', labText('t_7a8b3b152c5e'), 'createHeatBlock(ctx, { wells: 12 })', (c) => {
    const h = createHeatBlock(c);
    h.show([30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52], true);
    return h;
  }),
  e('thermostat', 'device', labText('t_e50b87bc3549'), 'createThermostat(ctx)', (c) => createThermostat(c)),
  e('uv-lamp', 'device', labText('t_f93436627a6d'), 'createUvLamp(ctx)', (c) => createUvLamp(c)),
  e('densitometer', 'device', labText('t_7e29cab653c1'), 'createDensitometer(ctx)', (c) => createDensitometer(c)),
  // K1 Tủ & thiết bị lớn (tủ an toàn đứng hàng đầu = phía sau, không che vật nhỏ)
  e('biosafety-cabinet', 'cabinet', labText('t_7ca372be42ae'), "createBiosafetyCabinet(ctx, { kind: 'biosafety' })", (c) => {
    const b = createBiosafetyCabinet(c, { kind: 'biosafety' });
    b.setLight(true);
    b.setFan(true);
    return b;
  }),
  e('fridge', 'cabinet', labText('t_58f1511565e7'), 'createLabFridge(ctx)', (c) => createLabFridge(c)),
  e('incubator', 'cabinet', labText('t_53a94a7d284b'), 'createIncubator(ctx)', (c) => createIncubator(c)),
  e('fridge-1door', 'cabinet', labText('t_b18f04938777'), 'createLabFridge(ctx, { freezer: false, open: { main: 1 } })', (c) =>
    createLabFridge(c, { width: 1.6, height: 2.6, depth: 1.5, freezer: false, shelves: 2, open: { main: 0.75 } })),
  e('incubator-co2', 'cabinet', labText('t_77f2d6cc5e63'), "createIncubator(ctx, { co2: 5, accent: 'teal' })", (c) => {
    const inc = createIncubator(c, { co2: 5, accent: 'teal', shelves: 3, height: 3.2 });
    inc.setOpen(0.5);
    return inc;
  }),
  e('foam-box', 'cabinet', labText('t_42ee1a79df04'), 'createFoamBox(ctx)', (c) => {
    const f = createFoamBox(c, { width: 1.8, depth: 1.8, height: 1.15 });
    f.setCutaway(true);
    f.setLid(true);
    return f;
  }),
  e('ice-box', 'cabinet', labText('t_fb87be43cbe1'), 'createFoamBox(ctx, { lid: false, ice: 9, water: 0.7 })', (c) =>
    createFoamBox(c, { width: mm(170), depth: mm(130), height: mm(62), lid: false, front: 0.62, ice: 9, water: 0.7 })),
  e('growth-shelf', 'cabinet', labText('t_138dcc1537a3'), 'createGrowthShelf(ctx)', (c) => createGrowthShelf(c)),
  e('aquarium', 'cabinet', labText('t_18881d38b625'), 'createAquarium(ctx)', (c) => createAquarium(c)),
  e('microscope', 'micro', labText('t_54c22285d03a'), 'createMicroscope(ctx)', (c) => createMicroscope(c)),
  e('stereo-microscope', 'micro', labText('t_5faca989ac7e'), 'createStereoMicroscope(ctx)', (c) => createStereoMicroscope(c)),
  e('inverted-microscope', 'micro', labText('t_be585b6adeaf'), 'createInvertedMicroscope(ctx)', (c) => createInvertedMicroscope(c)),
  e('agar-plate', 'microbio', labText('t_138a8c69cff9'), 'createAgarPlate(ctx)', (c) => createAgarPlate(c)),
  e('culture-tube', 'microbio', labText('t_bb2783d1b098'), 'createCultureTube(ctx)', (c) => createCultureTube(c)),
  e('bunsen', 'microbio', labText('t_6324cf5dd268'), 'createBunsenBurner(ctx, { lit })', (c) => createBunsenBurner(c, { lit: true })),
  e('loop', 'microbio', labText('t_53a5c7b4b181'), 'createInoculatingLoop(ctx)', (c) => createInoculatingLoop(c)),
  ...DESK_EQUIPMENT,
];
