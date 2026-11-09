import * as THREE from 'three'

/**
 * Bày đồ trong phòng. Toạ độ `at` = [u, v] CỤC BỘ của vật cha (u dọc chiều dài, v dọc chiều sâu; +v là mặt trước của vật cha),
 * nên dời bàn trong layout thì đồ đi theo. `surface` lấy từ `meta.surfaces` của vật cha; `socket` gắn vào ổ cắm của vật cha.
 */
export interface Placement {
  id: string
  kind: string
  params?: Record<string, unknown>
  on: string
  surface?: string
  socket?: string
  at: [number, number]
  rot?: number
}

const P: Placement[] = []
const add = (p: Placement) => P.push(p)
/** Giá ống nghiệm + `n` ống nghiệm RỜI cắm vào các lỗ (học sinh rút được từng ống). */
const rack = (id: string, on: string, surface: string, at: [number, number], n: number, rot = 0) => {
  add({ id, kind: 'tubeRack', params: { slots: 6 }, on, surface, at, rot })
  for (let i = 0; i < n; i++) add({ id: `${id}_tube${i + 1}`, kind: 'testTube', on: id, socket: `slot${i}`, at: [0, 0] })
}
const row = (prefix: string, on: string, surface: string, v: number, from: number, to: number, list: Record<string, unknown>[], kind = 'reagentBottle', rot = 0) =>
  list.forEach((params, i) => add({ id: `${prefix}_${i + 1}`, kind, params, on, surface, at: [list.length > 1 ? from + ((to - from) * i) / (list.length - 1) : (from + to) / 2, v], rot }))

// Kệ đảo 1 – tầng trên: axit, bazơ (chai nâu); tầng dưới: muối + chỉ thị + bình tia.
row('i1_acid', 'bench_island_1', 'shelf1', 0, -18, 18, [
  { species: 'HCl', conc: 1, amber: true }, { species: 'H2SO4', conc: 1, amber: true }, { species: 'HNO3', conc: 1, amber: true }, { species: 'CH3COOH', conc: 1, amber: true },
  { species: 'NaOH', conc: 1 }, { species: 'KOH', conc: 1 }, { species: 'NH3', conc: 1, amber: true }, { species: 'Ca(OH)2', conc: 0.02 },
], 'reagentBottle', Math.PI)
row('i1_salt', 'bench_island_1', 'shelf0', 0, -18, 12, [
  { species: 'NaCl', conc: 1 }, { species: 'KBr', conc: 0.5 }, { species: 'KI', conc: 0.1 }, { species: 'NaBr', conc: 0.5 }, { species: 'NaF', conc: 0.5 },
  { species: 'AgNO3', conc: 0.1, amber: true }, { species: 'Na2CO3', conc: 0.5 }, { species: 'Na2SO4', conc: 0.5 }, { species: 'BaCl2', conc: 0.1 },
  { species: 'CuSO4', conc: 0.5 }, { species: 'FeSO4', conc: 0.1 }, { species: 'FeCl3', conc: 0.1 },
], 'reagentBottle', Math.PI)
row('i1_ind', 'bench_island_1', 'shelf0', 0, 14, 18, [
  { label: 'Phenolphtalein', indicator: 'phenolphthalein' }, { label: 'Metyl da cam', indicator: 'methyl_orange', color: '#f08c00' }, { label: 'Quỳ tím', indicator: 'litmus', color: '#7b3fa0' },
], 'dropperBottle', Math.PI)

// Kệ đảo 2 – chất oxi hóa, halogen, muối khác.
row('i2_ox', 'bench_island_2', 'shelf1', 0, -18, 18, [
  { species: 'KMnO4', conc: 0.02, amber: true }, { species: 'K2Cr2O7', conc: 0.05 }, { species: 'H2O2', conc: 0.9, amber: true }, { species: 'Cl2', conc: 0.05, amber: true, label: 'Nước clo' },
  { species: 'Br2', conc: 0.02, amber: true, label: 'Nước brom' }, { species: 'I2', conc: 0.01, amber: true, label: 'Dd iot' }, { species: 'Na2S2O3', conc: 0.1 }, { species: 'KSCN', conc: 0.1 },
], 'reagentBottle', Math.PI)
row('i2_salt', 'bench_island_2', 'shelf0', 0, -18, 12, [
  { species: 'Pb(NO3)2', conc: 0.1 }, { species: 'Na2SO3', conc: 0.5 }, { species: 'NH4Cl', conc: 1 }, { species: 'Ba(OH)2', conc: 0.1 }, { species: 'ZnSO4', conc: 0.5 },
  { species: 'CaCl2', conc: 0.5 }, { species: 'NaHCO3', conc: 0.5 }, { species: 'MgSO4', conc: 0.5 }, { species: 'Na2S', conc: 0.1 }, { species: 'FeCl2', conc: 0.1 },
], 'reagentBottle', Math.PI)
row('i2_ind', 'bench_island_2', 'shelf0', 0, 14, 18, [
  { label: 'Phenolphtalein', indicator: 'phenolphthalein' }, { label: 'Hồ tinh bột', indicator: 'starch', color: '#f4f2ea' }, { label: 'Chỉ thị vạn năng', indicator: 'universal', color: '#4db848' },
], 'dropperBottle', Math.PI)

// Mặt bàn đảo 1: hai chỗ làm thí nghiệm (giá ống nghiệm, cốc, kính, sổ).
for (const [i, u] of [-12, 8].entries()) {
  rack(`i1_rack_${i}`, 'bench_island_1', 'top', [u, -4.5], 5)
  add({ id: `i1_beaker_${i}`, kind: 'beaker250', on: 'bench_island_1', at: [u + 4, -5] })
  add({ id: `i1_goggles_${i}`, kind: 'goggles', on: 'bench_island_1', at: [u - 3.5, -5.8] })
  add({ id: `i1_wash_${i}`, kind: 'washBottle', on: 'bench_island_1', at: [u + 6.5, -4] })
}
add({ id: 'i1_notebook', kind: 'notebook', on: 'bench_island_1', at: [-2, 5], rot: Math.PI })
add({ id: 'i1_dropper', kind: 'dropper', on: 'bench_island_1', at: [-6, -3.2] })
add({ id: 'i1_spatula', kind: 'spatula', on: 'bench_island_1', at: [14, -3.2] })

// Đảo 2: bộ chuẩn độ + phễu + cốc + bình tia; phía sau: giá ống nghiệm, ống đong.
add({ id: 'i2_titration', kind: 'titrationSet', on: 'bench_island_2', at: [-10, -4.5], rot: Math.PI })
add({ id: 'i2_funnel', kind: 'funnel', on: 'bench_island_2', at: [-5, -5] })
add({ id: 'i2_beaker', kind: 'beaker100', on: 'bench_island_2', at: [-3, -4.2] })
add({ id: 'i2_wash', kind: 'washBottle', on: 'bench_island_2', at: [-1, -5.5] })
rack('i2_rack', 'bench_island_2', 'top', [8, 4.5], 4)
add({ id: 'i2_cyl', kind: 'cylinder100', on: 'bench_island_2', at: [13, 4.2] })
add({ id: 'i2_flask', kind: 'erlenmeyer250', on: 'bench_island_2', at: [15.5, 5] })
add({ id: 'i2_thermo', kind: 'thermometer', on: 'bench_island_2', at: [4, -5.8] })

// Bàn giáo viên (mặt trước quay về phía giáo viên): bộ đun nối vòi gas, giá đỡ + ống nghiệm, đồng hồ bấm giờ, sổ.
// hoseTo: vòi gas của bàn ở (−8,5; 9,55; −1,95) cục bộ bàn, bộ đun ở (−5; 9; 0,5) → lệch (−3,5; 0,55; −2,45).
add({ id: 'tb_heating', kind: 'heatingSet', params: { hoseTo: new THREE.Vector3(-3.5, 0.55, -2.45) }, on: 'bench_teacher', at: [-5, 0.5] })
add({ id: 'tb_stand', kind: 'retortStand', on: 'bench_teacher', at: [3, -1.5] })
add({ id: 'tb_stopwatch', kind: 'stopwatch', on: 'bench_teacher', at: [8, 1.5], rot: Math.PI })
add({ id: 'tb_notebook', kind: 'notebook', on: 'bench_teacher', at: [11, 0.8] })
add({ id: 'tb_pen', kind: 'pen', on: 'bench_teacher', at: [12.8, 1.4] })
add({ id: 'tb_scale', kind: 'digitalScale', on: 'bench_teacher', at: [-11, 1], rot: Math.PI })
add({ id: 'tb_lamp', kind: 'alcoholLamp', on: 'bench_teacher', at: [0.5, 1.5] })
add({ id: 'tb_splint', kind: 'splint', on: 'bench_teacher', at: [6, -2] })

// Bàn tường cửa sổ (dài 86,5): lọ chất rắn, dụng cụ dùng chung.
row('wb_solid', 'bench_wall_window', 'top', -1.5, -36, -2, [
  { species: 'Zn', grams: 50, style: 'wide' }, { species: 'Fe', grams: 50, style: 'wide', label: 'Fe (đinh)' }, { species: 'Mg', grams: 10, style: 'wide' }, { species: 'Cu', grams: 50, style: 'wide' },
  { species: 'Al', grams: 20, style: 'wide' }, { species: 'CaCO3', grams: 100, style: 'wide' }, { species: 'MnO2', grams: 20, style: 'wide' }, { species: 'NaHCO3', grams: 100, style: 'wide' },
  { species: 'CuO', grams: 20, style: 'wide' }, { species: 'CuSO4', grams: 50, style: 'wide', label: 'CuSO4.5H2O' }, { species: 'S', grams: 20, style: 'wide' }, { species: 'KClO3', grams: 20, style: 'wide' },
])
rack('wb_rack_1', 'bench_wall_window', 'top', [4, 0.5], 6)
rack('wb_rack_2', 'bench_wall_window', 'top', [10, 0.5], 6)
row('wb_beaker', 'bench_wall_window', 'top', 0, 14, 22, [{}, {}, {}], 'beaker250')
add({ id: 'wb_beaker500', kind: 'beaker500', on: 'bench_wall_window', at: [24.5, 0] })
row('wb_cyl', 'bench_wall_window', 'top', -1.5, 27, 29, [{}, {}], 'cylinder50')
add({ id: 'wb_mortar', kind: 'mortar', on: 'bench_wall_window', at: [32, 0.5] })
add({ id: 'wb_gloves', kind: 'glovesBox', on: 'bench_wall_window', at: [36.5, -0.5] })
row('wb_goggles', 'bench_wall_window', 'top', 1.8, -40, -36, [{}, {}, {}], 'goggles')
add({ id: 'wb_trough', kind: 'trough', on: 'bench_wall_window', at: [-41.5, -1.2] })

// Bàn tường kho: bể ổn nhiệt, cân, lọ thu khí, chén nung, bát sứ.
add({ id: 'sb_bath', kind: 'waterBath', on: 'bench_wall_store', at: [-6, 0] })
add({ id: 'sb_gasjar', kind: 'gasJar', on: 'bench_wall_store', at: [0, -1] })
add({ id: 'sb_crucible', kind: 'crucible', on: 'bench_wall_store', at: [2.5, 0] })
add({ id: 'sb_dish', kind: 'evaporatingDish', on: 'bench_wall_store', at: [5, 0.5] })
add({ id: 'sb_petri', kind: 'petri', on: 'bench_wall_store', at: [7.5, 0.5] })
add({ id: 'sb_watch', kind: 'watchGlass', on: 'bench_wall_store', at: [9.5, 0.5] })

// Tủ hút: axit đặc, giá đỡ, cốc.
row('fh_conc', 'fume_cupboard', 'hood', -1.5, -4.5, -1, [{ species: 'H2SO4', conc: 18, amber: true }, { species: 'HNO3', conc: 15, amber: true }, { species: 'HCl', conc: 12, amber: true }])
add({ id: 'fh_stand', kind: 'retortStand', on: 'fume_cupboard', surface: 'hood', at: [2, -1.5] })
add({ id: 'fh_beaker', kind: 'beaker250', on: 'fume_cupboard', surface: 'hood', at: [4.5, 0.5] })

// Tủ kính: dụng cụ dự phòng.
row('gc1_up', 'cupboard_glazed_1', 'shelf1', 0, -3.2, 3.2, [{}, {}, {}], 'volumetricFlask')
row('gc1_mid', 'cupboard_glazed_1', 'shelf0', 0, -3, 3, [{}, {}], 'roundFlask')
row('gc1_top', 'cupboard_glazed_1', 'shelf2', 0, -3, 3, [{}, {}, {}], 'cylinder50')
row('gc2_up', 'cupboard_glazed_2', 'shelf1', 0, -3, 3, [{}, {}, {}], 'erlenmeyer250')
row('gc2_mid', 'cupboard_glazed_2', 'shelf0', 0, -3, 3, [{}, {}, {}], 'beaker100')
row('gc2_top', 'cupboard_glazed_2', 'shelf2', 0, -2.5, 2.5, [{}, {}], 'funnel')

// Xe đẩy: khay + bình tia + giá ống nghiệm.
add({ id: 'cart_tray', kind: 'tray', on: 'cart', surface: 'tier1', at: [-1.2, 0] })
add({ id: 'cart_wash', kind: 'washBottle', on: 'cart', surface: 'tier1', at: [2.6, -1] })
rack('cart_rack', 'cart', 'tier0', [0, 0], 6)

export const POPULATION: readonly Placement[] = P
