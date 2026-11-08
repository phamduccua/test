# Chặng 1 — Bộ máy hóa học `src/chem` (thuần logic, test vitest)

Đọc trước: `plans/00-tong-quan.md`. Chặng 0 đã xong. Chặng này không dùng kit.

## Mục tiêu
Bộ máy hóa học thuần TypeScript: nhận "trộn A với B trong điều kiện C", trả "có phản ứng không, phương trình, hiện tượng, lời giải thích, trạng thái sau". Không import `three`, không DOM.
Bàn giao: `npm test` xanh với **≥ 80 ca vàng**; `npm run chem -- mix "HCl 1M 20ml" "Na2CO3 0.5M 10ml"` đúng; `src/chem/README.md`.

Đối chiếu số liệu (chỉ đọc, không import): `sach_dien_tu/Frontend/src/features/hoa10/b22/s01-dung-dich-hcl-tac/model.ts` (Zn + HCl: `K_RATE`, ΔH 153,9 J/mmol), `b15/s01-dinh-sat-dung-dich/model.ts` (Fe + Cu²⁺), `b19/s05-phan-huy-h2o2-co/model.ts`.

## Thiết kế

### Cấu trúc
```
src/chem/
  index.ts  model/types.ts  text.ts (chemText đọc content/chem-text.json)
  data/index.ts (đọc content/chem.json, kiểm hình dạng)  data/atomicMasses.ts
  util/{formula,balance,equation}.ts  stoich.ts
  rules/{types,indicator,acidBase,ionExchange,metalAcid,metalSalt,oxide,halogen,redoxPotential,decomposition,equilibrium,dissolution,index}.ts
  engine.ts  kinetics.ts  thermo.ts  safety.ts  describe.ts  explain.ts  README.md
src/content/chem.json       # species, solubility, activity, potentials, volatile, indicators, thermo, kinetics, redoxReactions, decompositions (giáo viên sửa được)
src/content/chem-text.json  # tên tiếng Việt, mẫu câu giải thích, cảnh báo (khóa tự đặt, dễ đọc, ví dụ "reason.SAME_CLASS_ACIDS")
tests/chem/*.test.ts  tests/chem/golden.json
scripts/chem-cli.ts
```

### Kiểu dữ liệu (`model/types.ts`)
```ts
export type Phase = 'aq'|'s'|'l'|'g';
export type SpeciesClass = 'acid'|'base'|'salt'|'metal'|'nonmetal'|'halogen'|'oxide_basic'|'oxide_acidic'|'oxide_amphoteric'|'water'|'indicator'|'gas'|'peroxide'|'other';
export interface IonSpec { cation: string; anion: string; nCat: number; nAn: number; }
export interface Species { id: string; formula: string; nameVi: string; nameEn: string; class: SpeciesClass; phase: Phase; molarMass: number; ions?: IonSpec; strength?: 'strong'|'weak'; defaultConc?: number; concentratedAboveM?: number; color?: { solution?: string; solid?: string; gas?: string }; hazards: Array<'corrosive'|'toxic'|'flammable'|'oxidizer'|'irritant'|'harmful'|'environment'>; tags?: string[]; }
export interface Mixture { volumeL: number; solutes: Record<string, number>; solids: Record<string, number>; gases: Record<string, number>; temperatureC: number; indicator?: 'litmus'|'phenolphthalein'|'methyl_orange'|'universal'|'starch'; kinetic?: Record<string, { progress: number }>; }
export interface Conditions { temperatureC: number; heated: boolean; catalyst?: string; light?: boolean; inFumeHood: boolean; open: boolean; }
export type ReasonCode = 'HAPPENED'|'SAME_CLASS_ACIDS'|'SAME_CLASS_BASES'|'PRODUCTS_ALL_SOLUBLE'|'NO_NEW_ION_PAIR'|'METAL_BELOW_H'|'METAL_LESS_ACTIVE'|'WEAKER_OXIDIZER'|'POTENTIAL_UNFAVORABLE'|'NEEDS_HEAT'|'NEEDS_CONCENTRATED'|'NEEDS_CATALYST'|'NEEDS_LIGHT'|'PASSIVATED'|'INERT'|'DILUTION_ONLY'|'SOLIDS_NO_CONTACT'|'ALREADY_AT_EQUILIBRIUM';
export type Phenomenon = { type: 'gas'; species: string; intensity: number; colorHex?: string; note?: string } | { type: 'precipitate'; species: string; colorHex: string } | { type: 'dissolve'; species: string } | { type: 'color_change'; fromHex: string; toHex: string; note?: string } | { type: 'decolorize'; species: string } | { type: 'metal_coating'; species: string; colorHex: string } | { type: 'temperature'; deltaC: number } | { type: 'fume'; colorHex: string; note?: string } | { type: 'none' };
export interface Term { species: string; coef: number; phase?: Phase; }
export interface Equation { reactants: Term[]; products: Term[]; conditions?: string[]; redox?: boolean; text: string; }
export interface SafetyWarning { code: string; level: 'info'|'warning'|'danger'; messageVi: string; }
export interface ReactionResult { happened: boolean; equations: Equation[]; phenomena: Phenomenon[]; reasonCode: ReasonCode; explanationVi: string; wouldHappenIf?: Partial<Conditions> & { noteVi: string }; safety: SafetyWarning[]; mixtureAfter: Mixture; }
export interface Appearance { colorHex: string; opacity: number; turbidity: number; pH?: number; hasPrecipitate: boolean; precipitateColorHex?: string; gasBubbling: number; }
```

### API (`index.ts`)
`makeSolution(id, concM, volumeMl, indicator?)`, `makeSolid(id, grams)`, `makeWater(ml)`, `mix(a, b, cond?)`, `addSolid(m, id, grams, cond?)`, `heat(m, toC, cond?)`, `step(m, dt, cond?) → { mixture, events, progress }`, `describe(m)`, `explainWhyNot(a, b, cond?)`, `getSpecies`, `listSpecies`.
Bắt buộc: **thuần túy**; **tăng dần được** (10 lần 1 mL = 1 lần 10 mL, sai số < 1e−9); mọi chữ Việt qua `chemText` hoặc `species.nameVi`.

### Vòng lặp luật (`engine.ts`)
`merge(a,b)` → lặp ≤ 12: gom candidate từ RULES theo priority, áp candidate đầu (chất hết), ghi equation + phenomena → thermo, indicator, safety → không equation thì `diagnose`.
Ưu tiên: 1 indicator · 2 acidBase · 3 ionExchange (kết tủa / chất không bền: H2CO3→CO2, H2SO3→SO2, NH4OH→NH3 khi đun, H2S, CH3COOH yếu, H2O) · 4 metalAcid (dãy hoạt động; HNO3/H2SO4 đặc theo bảng `redoxReactions`; thụ động Al/Fe/Cr với đặc nguội) · 5 metalSalt (kim loại kiềm + nước trước) · 6 halogen · 7 redoxPotential (chỉ phản ứng có trong `redoxReactions`) · 8 decomposition (heated + ngưỡng) · 9 equilibrium (FeSCN, CrO4/Cr2O7) · 10 dissolution.
Phản ứng `kinetic: true` (Zn/Mg + HCl, Na2S2O3 + HCl, H2O2, CaCO3 + HCl) không hoàn tất trong `mix()`; `step(dt)` tiêu thụ.
`diagnose` thứ tự: nước → `DILUTION_ONLY`; hai axit; hai bazơ; kim loại + axit (sau H → `METAL_BELOW_H`; axit oxi hóa thiếu đặc/nóng → `NEEDS_CONCENTRATED`/`NEEDS_HEAT`; thụ động → `PASSIVATED`); kim loại + muối → `METAL_LESS_ACTIVE`; halogen → `WEAKER_OXIDIZER`; cặp ion mới nhưng đều tan → `PRODUCTS_ALL_SOLUBLE`; không có cặp mới → `NO_NEW_ION_PAIR`; hai rắn → `SOLIDS_NO_CONTACT`; còn lại `INERT`.
Hiện tượng suy từ dữ liệu: khí lấy `color.gas`; kết tủa lấy `precipitateColor`; màu dung dịch do `describe()` trộn theo nồng độ ion có màu (Cu²⁺ xanh lam, Fe³⁺ vàng nâu, Fe²⁺ lục nhạt, MnO₄⁻ tím, Cr₂O₇²⁻ da cam, CrO₄²⁻ vàng, FeSCN²⁺ đỏ máu, I₂ nâu, Br₂ nâu đỏ, Cl₂ vàng lục nhạt).

## Các bước

### 1.1 Kiểu + chemText + JSON rỗng
`model/types.ts`, `text.ts`, `content/chem.json` và `chem-text.json` khởi đầu. `vitest.config.ts` include `tests/**`.

### 1.2 Tiện ích công thức
`util/formula.ts`: `parseFormula('Fe2(SO4)3')→{Fe:2,S:3,O:12}` (ngoặc lồng, hydrat), `parseIon('SO4^2-')`, `molarMassOf`, `toDisplay('H2SO4')→'H₂SO₄'`, `ionToDisplay`, `elementCounts`. `data/atomicMasses.ts` 30 nguyên tố (H He Li C N O F Na Mg Al Si P S Cl K Ca Cr Mn Fe Ni Cu Zn Br Ag Sn I Ba Pt Au Hg Pb).
**Test:** 10 công thức; H2SO4 98,08 ± 0,05; NaCl 58,44 ± 0,05; hiển thị đúng.

### 1.3 Dữ liệu `chem.json`
**species** (~65): axit `HCl`(đặc ≥ 6 M) `H2SO4`(10) `HNO3`(8) `CH3COOH` `H2CO3` `H2SO3` `H2S` `HBr` `HI` `HF`; bazơ `NaOH KOH Ca(OH)2(0,02 M) Ba(OH)2 NH3` + rắn `Cu(OH)2 Fe(OH)3 Fe(OH)2 Mg(OH)2 Al(OH)3 Zn(OH)2`; muối `NaCl KCl NaBr KBr KI NaI NaF AgNO3 Na2CO3 NaHCO3 CaCO3 Na2SO4 K2SO4 BaCl2 Ba(NO3)2 CuSO4 Cu(NO3)2 FeSO4 FeCl2 FeCl3 Fe2(SO4)3 ZnSO4 ZnCl2 MgSO4 KMnO4 K2Cr2O7 K2CrO4 Na2S2O3 KSCN NH4Cl (NH4)2SO4 Pb(NO3)2 KClO3 KNO3 Na2SO3 Na2S CaCl2 AgCl AgBr AgI BaSO4 PbI2 CuCl2 CuS`; kim loại `Na K Ca Mg Al Zn Fe Ni Sn Pb Cu Ag Au Pt`; halogen `Cl2 Br2 I2 S`; oxit `CuO CaO Fe2O3 Fe3O4 MgO ZnO Al2O3 MnO2 SO2 CO2 NO NO2 P2O5`; khác `H2O H2O2 H2 O2 NH3_g HCl_g starch litmus phenolphthalein methyl_orange universal_indicator`.
**solubility** cation × anion → `S|L|I|D` + `precipitateColor` (AgCl `#f4f4f0`, AgBr `#f1e3a8`, AgI `#e8d44d`, BaSO4 trắng, Cu(OH)2 `#3a7bd5`, Fe(OH)3 `#8b3a1e`, Fe(OH)2 trắng xanh, CuS đen, PbI2 vàng, S vàng nhạt đục, Cu `#b5542a`, Ag xám sáng, CaCO3, Mg(OH)2 trắng).
**activity** `K Na Ca Mg Al Zn Fe Ni Sn Pb H Cu Ag Au Pt`, `reactsWithWater [K,Na,Ca]`.
**potentials** (V): Li −3,04; K −2,93; Ca −2,87; Na −2,71; Mg −2,37; Al −1,66; Zn −0,76; Fe −0,44; Ni −0,26; Sn −0,14; Pb −0,13; H 0; Cu 0,34; I₂ 0,54; Fe³⁺/Fe²⁺ 0,77; Ag 0,80; NO₃⁻/NO 0,96; Br₂ 1,07; O₂ 1,23; Cr₂O₇²⁻ 1,33; Cl₂ 1,36; MnO₄⁻ 1,51; H₂O₂ 1,78; F₂ 2,87; S/H₂S 0,14; SO₄²⁻/SO₂ 0,17.
**volatile**, **indicators** (quỳ đỏ < 5, tím 5–8, xanh > 8; phenolphthalein hồng ≥ 8,2; methyl orange đỏ < 3,1, da cam 3,1–4,4, vàng > 4,4; universal 14 màu; hồ tinh bột + I₂ xanh tím), **thermo** (kJ/mol: trung hòa −57,1; tan NaOH −44,5; NH4Cl +14,8; CaCl2 −82; CaO + H2O −65; Zn + CuSO4 −217; Zn + 2HCl −153,9; Mg + 2HCl −462; Na + H2O −184; H2O2 −98), **kinetics** (Zn + HCl: 1 g hạt trong 50 mL HCl 1 M hết ≈ 600 s, Q10 2; Mg ×20; Na2S2O3 + HCl: 50 mL 0,1 M + 5 mL HCl 1 M ở 25 °C khuất X ≈ 60 s khi S đạt 0,004 mol/L; H2O2 không xúc tác nửa đời ~10⁵ s, có MnO2 ~20 s; CaCO3 mảnh ~120 s), **redoxReactions** đã cân bằng với `requires {concentrated?, heated?, acidId?}` và `blockedBy: 'PASSIVATED'` (Cu + 4HNO3 đặc; 3Cu + 8HNO3 loãng; Cu + 2H2SO4 đặc t°; Fe + 4HNO3 loãng; 2Fe + 6H2SO4 đặc t°; Ag + 2HNO3 đặc; 2KMnO4 + 10FeSO4 + 8H2SO4; 2KMnO4 + 16HCl đặc; K2Cr2O7 + 6FeSO4 + 7H2SO4; 2FeCl3 + Cu; 2FeCl3 + 2KI; 2FeCl3 + Fe; H2O2 + 2KI + H2SO4; 2KMnO4 + 5H2O2 + 3H2SO4; Cl2 + 2NaBr; Cl2 + 2KI; Br2 + 2KI; Cl2 + H2O; Cl2 + 2NaOH; Cl2 + 2FeCl2; SO2 + Br2 + 2H2O; 2Na + 2H2O; Ca + 2H2O; 2Al + 2NaOH + 2H2O; 2NaCl rắn + H2SO4 đặc t°), **decompositions** (ngưỡng °C: 2KClO3 MnO2 400; 2KMnO4 240; CaCO3 825; Cu(OH)2 80; 2NaHCO3 100; 2H2O2 MnO2 25; 2Fe(OH)3 150; NH4Cl 340).
**Test:** mọi formula parse; molarMass lệch < 0,5; ion có trong bảng tan; mọi phương trình bảo toàn nguyên tố; không trùng id.

### 1.4 Dung dịch, mol, cân bằng, định dạng
`stoich.ts`, `util/balance.ts` (`balanceExchange` theo điện tích), `util/equation.ts` (`BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl`, `→(t°)`). **Test:** 20 mL HCl 1 M = 0,02 mol; 6 cặp cân bằng; định dạng.

### 1.5 Khung engine, diagnose, describe, explain
`rules/types.ts`, `engine.ts`, `describe.ts` (alpha = min(1, C/C_ref); đục theo kết tủa; pH, Ka 1,8e−5 cho yếu), `explain.ts` (mẫu câu trong `chem-text.json` có `{a}`, `{b}`, `{cond}`). **Test:** nước + nước → `DILUTION_ONLY`; CuSO₄ 0,5 M xanh lam.

### 1.6 Luật A + golden A (≥ 27)
| # | A | B | Kỳ vọng |
|---|---|---|---|
| 1 | HCl | NaOH | có, ΔT > 0 |
| 2 | HCl + phenolphthalein | NaOH dư | không màu → hồng |
| 3 | HCl | H2SO4 | không, `SAME_CLASS_ACIDS` |
| 4 | NaOH | KOH | không, `SAME_CLASS_BASES` |
| 5 | HCl | Na2SO4 | không, `PRODUCTS_ALL_SOLUBLE` |
| 6 | HCl | Na2CO3 | có, CO₂ |
| 7 | HCl | AgNO3 | kết tủa trắng |
| 8 | BaCl2 | Na2SO4 | kết tủa trắng |
| 9 | NaCl | KNO3 | không |
| 10 | CuSO4 | NaOH | xanh lam |
| 11 | FeCl3 | NaOH | nâu đỏ |
| 12 | H2SO4 | BaCl2 | trắng |
| 13 | HCl | CuO rắn | rắn tan, dd xanh |
| 14 | HCl | Cu(OH)2 rắn | dd xanh |
| 15 | H2SO4 loãng | Na2SO3 | SO₂ |
| 16 | HCl | CaCO3 rắn | sủi bọt (động học) |
| 17 | NaOH | NH4Cl đun | NH₃; không đun → không khí |
| 18 | Ca(OH)2 dd | CO2 sục | vẩn đục |
| 19–21 | quỳ tím với HCl / NaOH / NaCl | — | đỏ / xanh / tím |
| 22 | CH3COOH | NaOH | có |
| 23 | CH3COOH | Na2CO3 | CO₂ |
| 24 | HCl | H2O | `DILUTION_ONLY`, nồng độ giảm đúng |
| 25 | Pb(NO3)2 | KI | vàng |
| 26 | Na2S | CuSO4 | đen |
| 27 | NaHCO3 | HCl | CO₂ |

### 1.7 Luật B + golden B (≥ 22)
| # | A | B | Kỳ vọng |
|---|---|---|---|
| 1 | Zn | HCl loãng | H₂ (động học) |
| 2 | Cu | HCl loãng | không, `METAL_BELOW_H` |
| 3 | Cu | H2SO4 loãng | không |
| 4 | Cu | H2SO4 đặc nguội | không, `NEEDS_HEAT` + wouldHappenIf |
| 5 | Cu | H2SO4 đặc đun | SO₂, dd xanh |
| 6 | Cu | HNO3 loãng | NO hóa nâu |
| 7 | Cu | HNO3 đặc | NO₂ nâu đỏ |
| 8 | Al | HNO3 đặc nguội | `PASSIVATED` |
| 9 | Fe | H2SO4 đặc nguội | `PASSIVATED` |
| 10 | Fe | CuSO4 | Cu đỏ bám, xanh → lục nhạt |
| 11 | Cu | FeSO4 | `METAL_LESS_ACTIVE` |
| 12 | Cu | AgNO3 | Ag bám, dd dần xanh |
| 13 | Ag | CuSO4 | không |
| 14 | Mg | HCl | rất nhanh |
| 15 | Na | H2O | mãnh liệt, danger |
| 16 | Na | CuSO4 dd | 2 phương trình |
| 17 | Au | HCl | `INERT` |
| 18 | Zn | ZnSO4 | `NO_NEW_ION_PAIR` |
| 19 | CaO | H2O | tỏa nhiệt |
| 20 | Fe2O3 | HCl | vàng nâu |
| 21 | Al | NaOH | H₂ |
| 22 | Fe | HCl | FeCl₂ |

### 1.8 Luật C + golden C (≥ 26)
| # | A | B / điều kiện | Kỳ vọng |
|---|---|---|---|
| 1 | nước clo | NaBr | vàng nâu |
| 2 | nước clo | KI | nâu; + hồ tinh bột xanh tím |
| 3 | nước brom | KI | có |
| 4 | nước brom | NaCl | `WEAKER_OXIDIZER` |
| 5 | I2 | NaBr | không |
| 6 | AgNO3 | NaCl / NaBr / KI / NaF | trắng / vàng nhạt / vàng / không |
| 7 | nước clo | NaOH | có |
| 8 | nước clo | FeCl2 | lục nhạt → vàng nâu |
| 9 | KMnO4 + H2SO4 | FeSO4 | tím mất màu |
| 10 | KMnO4 | FeSO4 không axit | `POTENTIAL_UNFAVORABLE` + cần axit |
| 11 | KMnO4 | HCl đặc | Cl₂, danger ngoài tủ hút |
| 12 | KMnO4 | HCl loãng | `NEEDS_CONCENTRATED` |
| 13 | FeCl3 | Cu | có |
| 14 | FeCl3 | KI | I₂ |
| 15 | FeCl3 | KSCN | đỏ máu |
| 16 | H2O2 | KI + H2SO4 | I₂ |
| 17 | H2O2 | MnO2 | O₂ mạnh |
| 18 | H2O2 | để yên | gần như không |
| 19 | KClO3 | đun + MnO2 | O₂ |
| 20 | KClO3 | đun không MnO2 | `NEEDS_CATALYST` |
| 21 | CaCO3 | đèn cồn | `NEEDS_HEAT` |
| 22 | Cu(OH)2 | đun | xanh → đen |
| 23 | SO2 | nước brom | mất màu |
| 24 | K2Cr2O7 + H2SO4 | FeSO4 | da cam → lục |
| 25 | NaCl rắn | H2SO4 đặc đun | HCl khí |
| 26 | Cl2 + H2O | — | quỳ đỏ rồi mất màu |

### 1.9 Động học, cân bằng, nhiệt
`kinetics.ts step`, `rules/equilibrium.ts` (FeSCN K 1,4e2), `thermo.ts` (ΔT = −ΔH·n/(m·4,18), ≤ 100). **Test:** Zn + HCl 2 M ≈ 2× 1 M; Na2S2O3 35 °C ≈ 2× nhanh; H2O2 + MnO2 > 100×; 50 + 50 mL 1 M → ΔT 6,8 ± 0,5; NH4Cl ΔT < 0; tăng dần 3 cặp.

### 1.10 An toàn
`WATER_INTO_CONC_ACID`, `TOXIC_GAS_OUTSIDE_HOOD` (Cl2 SO2 NO2 H2S NH3 HCl khí khi `!inFumeHood`), `ALKALI_METAL_WATER`, `OXIDIZER_WITH_FLAMMABLE`, `HEATING_CLOSED_VESSEL`, `CONC_ACID_HANDLING`, `HOT_LIQUID` (> 60 °C). **Test:** mỗi mã 1 ca kích hoạt + 1 ca không.

### 1.11 CLI + README
`scripts/chem-cli.ts`: `mix "<id> <M>M <ml>ml|<id> <g>g" ... [--heated] [--temp 60] [--hood] [--catalyst MnO2] [--indicator phenolphthalein]`, `list`, `golden`. README: API, cách thêm chất/luật/ca vàng.

## Tiêu chí nghiệm thu
- [ ] `npm test` xanh, ≥ 80 ca, mỗi `ReasonCode` ≥ 1 lần.
- [ ] `src/chem` không import `three`/DOM (test grep).
- [ ] CLI 5 lệnh đúng; ảnh `docs/screens/chang-1/`.
- [ ] Giáo viên duyệt `species` và 3 bảng vàng.

## Lỗi thường gặp
Quên chất hết; Fe + HCl ra FeCl₃; Cu + HNO₃ ra H₂; Na đẩy Cu; AgF kết tủa; trộn màu hex thô thay vì alpha theo nồng độ.

## Bàn giao cho chặng 2
Chặng 2 không dùng engine.
