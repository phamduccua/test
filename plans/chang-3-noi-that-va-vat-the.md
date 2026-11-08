# Chặng 3 — Nội thất và vật thể: tái dùng kit + builder riêng + lắp đầy phòng

Đọc trước: `plans/00-tong-quan.md`. Chặng 2 đã xong.

## Mục tiêu
Thay khối xám bằng vật thể thật. **Dụng cụ, lọ, thiết bị lấy từ kit**; tự dựng kiến trúc, bàn đảo, tủ, trạm an toàn và vài món kit thiếu. Chế độ trưng bày `?mode=showroom&batch=` để duyệt từng lô. Vật liệu kit mặc định (`labMaterials`), chưa tinh chỉnh.
Bàn giao: showroom từng lô; `?mode=play` phòng lắp đủ theo `population.ts`; tam giác ≤ 900 000.

## Bối cảnh cần đọc (trong `src/vendor/lab3d`)
`lab/index.ts` (grep trước khi tự viết), `lab/units.ts`, `lab/materials/{kit,palette}.ts`, `lab/room/bench.ts` (`createBench({ width, depth, height = 9, top, cabinetColor })`, mặt bàn ở y 0 của group, sàn ở −height), `lab/glassware/*`, `lab/equipment/*`, `lab/microbio/burner.ts`, `lab/solids/*`, `lab/containers/*`, `lab/desk/*`, `lab/microscopy/smearTools.ts` (`createWashBottle`), `lab/catalog/{equipment,gallery}.ts` (mẫu trưng bày), `interact/dropZones.ts` (kiểu `DropZone`), `engine/dispose.ts`.

## Thiết kế

### Siêu dữ liệu (`src/lab/builders/types.ts`)
```ts
export type Category = 'architecture'|'furniture'|'fixture'|'glassware'|'apparatus'|'safety'|'consumable'|'decor';
export interface ObjectMeta {
  kind: string; displayName: string; category: Category; grabbable: boolean;
  footprint?: { w: number; d: number; h: number };
  grabOffset?: [number, number, number];
  placeable?: Array<{ box: { min: [number,number,number]; max: [number,number,number] }; kind: 'bench'|'shelf'|'tray'|'hood'|'floor' }>;
  sockets?: Array<{ name: string; pos: [number,number,number]; accepts: string[]; radius: number }>;
  vessel?: import('../../vendor/lab3d/lab/glassware/vessel').Vessel; capacityMl?: number; mouthRadius?: number; spout?: [number,number,number];
  movables?: Array<{ name: string; node: string; type: 'rotate'|'translate'; axis: 'x'|'y'|'z'; min: number; max: number; initial: number }>;
  colliders?: Array<{ min: [number,number,number]; max: [number,number,number] }>;
  chem?: { speciesId: string; concM?: number; volumeMl?: number; grams?: number };
}
export type Builder<P extends object = Record<string, never>> = (ctx: Tracker, params?: Partial<P>) => THREE.Group; // group.userData.meta
```
Gốc ở tâm đáy, mặt trước +Z. Vật từ kit = wrapper gọi hàm kit rồi điền `meta`.

### Vật liệu
Chỉ `labMaterials(ctx)` + `LAB_PALETTE`; thiếu (đồng thau, phenolic đen, vàng an toàn) → `src/lab/materials.ts` cache theo ctx.

### Trưng bày
`createFreeLab(ctx, { mode: 'showroom', batch })`: lưới (nội thất cách 60, còn lại 12), nhãn `ctx.labels.add`, OrbitControls mặc định, `[` `]` nhảy vật.

### Ngân sách
Thủy tinh ≤ 3 000 tam giác; thiết bị ≤ 2 000; nội thất ≤ 12 000; tủ hút ≤ 15 000; phòng ≤ 900 000.

## Các bước

### 3.1 Hạ tầng
`builders/types.ts`, `registry.ts` (`register`, `build`, `listKinds`), `helpers.ts` (box/cyl/lathe/tube/plane qua `labMaterials`, cache geometry, `attachToSocket`), `src/lab/materials.ts`, `src/lab/showroom.ts`; `index.ts` đọc `?mode=`.

### 3.2 Lô A: kiến trúc + nội thất (`builders/architecture.ts`, `furniture.ts`)
| builder | cách làm |
|---|---|
| `roomShell` | sàn plane + `tileTexture` xám nhạt; 4 tường; trần lưới ô 6 dm bằng gờ; gờ chân tường 0,8; khung cửa sổ + 4 ô kính + bệ + trục rèm r 0,4 + tấm rèm (node `blind_N`, translate y 0→9); cửa + khung + tay nắm (node `door`, rotate 0→90); đèn tấm 12 × 6 × 0,5 emissive; miệng gió |
| `islandBench` | `createBench(ctx, { width: 48, depth: 15, height: 9, top: 'epoxy', cabinetColor: LAB_PALETTE.cabinet })` dịch lên 9; thay mặt bằng phenolic đen; 2 bồn 5 × 4 sâu 2 tại x ±19 + vòi cổ ngỗng (tube, chrome); kệ giữa đế 40 × 1,5 × 3, 5 cột r 0,15 tới 17,5, 2 tầng 40 × 0,2 × 3 tại 12,5 và 15,5 có thanh chắn; 3 `gasTap` mỗi bên tại x −16/0/16; 2 ổ cắm mỗi bên; `placeable` mặt bàn + 2 tầng |
| `teacherBench` (30 × 8) | 1 bồn, 1 vòi gas, không kệ |
| `wallBench` | `createBench` + đổi mặt |
| `stool` | mặt gỗ r 1,8 dày 0,3; 4 chân r 0,12 choãi 6°; torus R 1,6 ở y 2,2 |
| `cart` | khung thép 8 × 5, tầng y 2,5 và 8,5, 4 bánh r 0,5, tay đẩy; `placeable tray`; `params.pushable` |
| `tray` | `createTray` kit |

### 3.3 Lô B: tủ và cố định (`builders/fixtures.ts`)
`fumeCupboard` (tủ dưới 15 × 8,5 × 9 với 2 cánh node `door_L/R`, mặt bàn đen, buồng, **sash** 13 × 9 node `sash` translate y 0→6, nóc có node `signFace`, ống khói tới 30, `placeable hood`, `params.hoodVolume`), `flammablesCabinet` (9 × 18 × 5 vàng, 2 cánh, `label_L/R`), `glazedCupboard` (10 × 20 × 4,5, 2 cánh kính + 2 đặc, 3 kệ placeable), `whiteboard` (node `boardFace`, khay, 3 `createPen`), `posterFrame(w,h)` (`posterFace`), `pinBoard`, `coatHooks` + áo blouse, `wallClock` (thử `createClock` của `lab/desk/clock.ts`), `pegBoard`, `gasTap` (đồng r 0,2 cao 0,8, cần node `lever` rotate 0→90, socket `hose`), `powerSocket`, `floorDrain`, `hazardStriping` (`stripeFace`), `skirting`.

### 3.4 Lô C: an toàn (`builders/safety.ts`)
`showerEyewash`, `fireExtinguisher`, `fireBlanketBox`, `firstAidBox` (`signFace`), `safetySign(type)` (firstAid, eyeWash, emergencyShower, fireBlanket, fireExtinguisher, exit, goggles, noFood, flammable, corrosive, toxic, keepSashLow), `steelBin`, `sharpsBin` — kích thước như layout chặng 2.

### 3.5 Lô D: dụng cụ từ kit (`builders/kitItems.ts`) + tự dựng (`glasswareExtra.ts`)
| kind | hàm kit | meta |
|---|---|---|
| `beaker100/250/500` | `createBeaker(ctx, n)` | vessel, capacity, mouthRadius, spout +x |
| `erlenmeyer250`, `testTube`, `cylinder100`, `roundFlask250` | `createErlenmeyer`, `createTestTube`, `createGraduatedCylinder`, `createRoundFlask` | vessel |
| `funnel`, `glassRod`, `pipette25`, `deliveryTube` | hàm cùng tên | |
| `reagentBottle` | `createReagentBottle(ctx, { style: 'bottle', label, sublabel, amber, liquidColor, fill, capColor })` | vessel 500, `chem` từ population; nhãn do kit vẽ |
| `dropperBottle` | `createReagentBottle({ style: 'dropper', dropper: 'black' })` | chỉ thị |
| `washBottle`, `solidJar` (`createJar` / `style 'wide'` + `solidColor`) | | `params.grams` |
| `dropper spatula nail splint thermometer stopwatch tubeRack tubeHolder retortStand tripodGauze bunsenBurner alcoholLamp waterBath iceCubes digitalScale mortar watchGlass petri notebook pen tray` | hàm cùng tên | `tubeRack` sockets theo `slots`; `retortStand` socket `clamp`; `tripodGauze` socket `top`; `bunsenBurner` `params.lit`, socket `flame` |
| `crossCard` | `createPaperSheet({ width: 1, depth: 1, draw: drawCrossMark })` | |
| `powderHeap` | `createPowderHeap(ctx, vessel.profile, { color })` | trong solidJar |
| `metalSample(kind)` | Zn cụm `createCrystalFlakes`/cầu xám; Fe `createNail`; Mg dải; Cu/Al lá; Na khối | grams mặc định Zn 1, Fe 2, Mg 0,1, Cu 0,5, Al 0,3, Na 0,2 |
Tự dựng: `burette50` (`buildProfile` ống r 0,65 dài 60 + khóa node `stopcock` rotate 0→90 + đầu nhọn, `spout`), `volumetricFlask250`, `gasJar` (nắp node `lid`), `evaporatingDish`, `crucible`, `goggles`, `glovesBox`, `trough` (vessel 6000), `rubberStopper(holes)`, `thistleFunnel`.
**Kiểm tra:** showroom `glassware`, `apparatus`; Bunsen + kiềng + lưới + cốc chồng bằng `attachToSocket`; so ảnh `2f60ff79ae`, `694a567207`.

### 3.6 Lắp phòng + population
`src/lab/room/roomBuilder.ts` (từng `LayoutItem` → builder; collider từ layout + meta; trả `{ group, colliders, placed: Map<id, { group, meta }> }`), `src/lab/room/population.ts` (`PlacedObject { id; kind; params?; parentId?; surface?; socket?; x; y?; z; rotY?; chem? }`, tọa độ cục bộ theo parent).
Nội dung tối thiểu: kệ đảo 1 trên (amber) NaOH 1 M, HCl 1 M, H2SO4 1 M, HNO3 1 M, CH3COOH 1 M, NH3 dd, Ca(OH)2 dd; dưới (clear) NaCl, KBr, KI, NaBr, AgNO3 0,1 M, Na2CO3, Na2SO4, BaCl2, CuSO4, FeSO4, FeCl3; 3 lọ nhỏ giọt chỉ thị; bình tia. Kệ đảo 2: KMnO4, K2Cr2O7, Na2S2O3, KSCN, H2O2 3 %, nước clo, nước brom, I2/KI, hồ tinh bột, Pb(NO3)2, Na2SO3, NH4Cl, Ba(OH)2, ZnSO4, CaCl2 + chỉ thị + bình tia. Bàn tường cửa sổ: lọ rắn Zn, Fe đinh, Mg, Cu lá, Al lá, CaCO3, MnO2, NaHCO3, CuO, CuSO4·5H2O, S, KClO3; 2 giá ống nghiệm đầy; 4 cốc; 2 ống đong; cối chày; hộp găng; 3 kính; pegboard 6 bình. Tủ hút: H2SO4 đặc 18 M, HNO3 đặc 15 M, HCl đặc 12 M, giá kẹp, cốc. Tủ kính: bình định mức, bình cầu, buret, phễu. Bàn giáo viên: Bunsen + dây gas (`hoseTo`) + kiềng + lưới + cốc, giá kẹp + ống nghiệm, nhiệt kế, đồng hồ, sổ, bút. Đảo 2: bộ chuẩn độ; đảo 1: 2 giá ống nghiệm, 2 cốc, kính, sổ. Xe: khay, 2 bình tia, 2 giá. Áo trên móc, giấy bảng ghim.
`placeOnSurface`, `attachToSocket`; `userData.instanceId = id`.
**Kiểm tra:** `?mode=play` không vật lơ lửng/xuyên; tam giác ≤ 900 000; FPS ≥ 50.

## Tiêu chí nghiệm thu
- [ ] Mọi `kind` trong registry, showroom đúng lô.
- [ ] Bình chứa có `vessel`, `capacityMl`, `mouthRadius`; vật cầm có `footprint`.
- [ ] Không sửa `src/vendor`; typecheck, test xanh.
- [ ] Người điều phối duyệt 5 lô (`docs/screens/chang-3/`).

## Lỗi thường gặp
`createBench` mặt bàn ở y 0 → dịch lên `height`; tạo material mới mỗi builder; vẽ nhãn thứ hai lên lọ kit; tọa độ tuyệt đối cho vật trên kệ.

## Bàn giao cho chặng 4
Node có tên: `boardFace`, `posterFace`, `signFace`, `stripeFace`, `label_*`, `coverFace`; `src/lab/materials.ts` là nơi duy nhất chỉnh vật liệu riêng.
