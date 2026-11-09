> **ĐÃ XONG (2026-11-09).** Kết quả và các lệch kế hoạch ghi trong `plans/NHAT-KY.md` mục Chặng 7; ảnh trong `docs/screens/chang-7/`. Phần dưới giữ để tham khảo.

# Chặng 7 — Chất lỏng, chất rắn, khí, nhiệt, đo đạc: nối bộ máy hóa học vào 3D

Đọc trước: `plans/00-tong-quan.md`. Chặng 1 (engine) và 6 (store) đã xong.

## Mục tiêu
Mọi bình có `Mixture` thật. Rót, nhỏ giọt, cho rắn, đun, sinh khí, thu khí, đo đều đi qua `src/chem`; hiện tượng vẽ bằng hiệu ứng kit; kết quả vào bảng và sổ. **3D không chọn hiện tượng theo tên cặp chất, chỉ theo `ReactionResult`.**
Bàn giao: 17 tình huống (7 lớp 9 + 10 Hóa 10 từ bảng vàng) làm được bằng tay, kết quả trùng CLI.

## Bối cảnh cần đọc (trong `src/vendor/lab3d`)
`lab/liquid/*` (`createLiquid`: `setVolume`, `setColor(c, dur)`, `setTurbidity`, `update(dt)`), `lab/effects/*`, `interact/pour.ts` (`createTiltPour`: `receivers[].onPour(amount)`, `fill`, `stream`, `onSpill`, `auto`), `interact/dropper.ts` + `dropperTypes.ts`, `lab/solids/powder.ts`, `lab/microbio/burner.ts`, `lab/effects/flame.ts`, `lab/equipment/{thermometer,stopwatch,paperSheet,splint}.ts`, `lab/kinetics/timeline.ts`; mẫu (chỉ đọc) `sach_dien_tu/Frontend/src/features/hoa10/b22/s01-dung-dich-hcl-tac/{transfer,tubes,bubbleModel,splint}.ts`.

## Thiết kế

### Trạng thái bình (`src/lab/chem/vessels.ts`)
`VesselState { id; meta; mixture; liquid: Liquid|null; fx: { bubbles?, precipitate?, cloud?, foam?, gas? }; temperatureC; heating: { source?; power } }`. Khởi tạo từ `population.chem`. `applyAppearance`: `describe(mixture)` → `setColor(colorHex, 0,6, opacity)`, `setTurbidity(turbidity, 0,6, precipitateColorHex)`, `setVolume`.

### Hành động → engine → hiện tượng (`src/lab/chem/apply.ts`)
```
pour(source, target, ml)      aliquot tách theo tỉ lệ → mix(target.mixture, aliquot, cond(target))
drop(dropper, target)         0,05 mL; chỉ thị → mixture.indicator
addSolid(target, species, g)  addSolid(...)
placeMetal(sample, target)    addSolid(grams); mẫu co theo mol còn lại
heat(target)                  mỗi tick tăng T theo nguồn; heat(mixture, T, cond) khi vượt ngưỡng
tick(dt)                      bình có kinetic: step(mixture, dt, cond) → render(events)
cond(target)                  { temperatureC, heated, catalyst: MnO2 trong solids, inFumeHood: tâm bình trong hoodVolume, open: !stopper }
```
`render(r, target)`:
| Phenomenon | Hiệu ứng kit |
|---|---|
| gas không màu | `createBubbles` rate ∝ intensity; loop `lab/fizz`; > 0,7 thêm `createFoam` |
| gas có màu | `createProfileGas`/`createVolumeGas` màu `colorHex` trên miệng; `lab/gas-hiss` |
| precipitate | `createPrecipitate` + `turbidity` |
| color_change / decolorize | `liquid.setColor` 0,8 s |
| metal_coating | `createPlatedMaterial` cho mẫu |
| temperature | `temperatureC`; nhiệt kế cắm hiện số |
| fume | `createParticles` khói trắng |
Mọi `r` → `store.pushResult`, `pushNotebook`; `r.safety` → `ctx.warn(messageVi)` (danger giữ tới khi xử lý).

### Rót
Cầm bình có `vessel`, rê lên bình nhận trong 6 dm → vòng miệng; **giữ và kéo** → `createTiltPour({ vessel: held, lip: spout, rate: cốc 40 mL/s, ống nghiệm 8, bình tia 5, fill, stream: createPourStream, receivers: [đang trỏ], floorY, onFlow, onSpill })`; `onPour` gộp 100 ms → `pour`. Tràn → vệt trên bàn + safety + sổ. Buret: không nghiêng; khóa mở (knob) → dòng thẳng đứng, rate 0→2 mL/s.

### Nhỏ giọt
`createDropperGesture` (source lọ nhỏ giọt, targets bình trong tầm), 0,05 mL/giọt, `lab/drip`.

### Chất rắn
Thìa: tap lọ rắn → `createPowderHeap` 0,5 g trên thìa → tap bình → `createPowderFall` + `addSolid`, `lab/scoop`. Mẫu kim loại: cầm → tap bình → rơi vào, co theo mol.

### Đun, nhiệt
Bunsen: vòi gas mở + tap đèn (bật lửa) → `burner.lit` + `lab/lighter`, `lab/flame` loop; vật ở socket `top` phía trên nhận power: dT/dt 0,5 °C/s cho 100 mL (nhân 100/mL), nguội 0,01/s về 25; sôi 100 → bọt mạnh + hơi. Đèn cồn: `createFlame({ kind: 'alcohol' })`, power thấp, tối đa ~400 °C với rắn (đủ Cu(OH)₂, NaHCO₃, KMnO₄; không đủ CaCO₃ → engine `NEEDS_HEAT`). Nhiệt kế cắm → `setValue(T)` + `setMeasurement`. Đồng hồ: `createPushButton` start/stop/reset.

### Khí
Bộ điều chế (bình + nút 2 lỗ + phễu + ống dẫn) lắp đủ qua sockets → khí theo ống tới `outletLocal`; đầu ống trong bình thu (gas jar úp trong chậu / ống nghiệm) → thể tích thu tăng (mức nước hạ); không → tỏa ra (an toàn nếu độc). Thử khí: que đóm (`createSplint` ember/flame) + H₂ → `lab/h2-pop`; O₂ → bùng; CO₂ vào nước vôi trong (mix) → đục; quỳ ẩm gần Cl₂ → mất màu.

### Dấu X, đồ thị, động học
`crossCard` dưới bình: độ thấy = f(turbidity, cột lỏng) → sự kiện "khuất dấu X" ghi giờ. Chuỗi (khí, nhiệt độ) → `store.setChart`. `Simulation.update(dt)` (dt đã nhân tốc độ) → `tick(dt)`; `frame(realDt)` cho đi bộ. Tạm dừng → hóa học đứng.

## Các bước
### 7.1 Trạng thái bình + ngoại hình — kiểm màu CuSO₄, KMnO₄, FeCl₃, HCl, mức đúng.
### 7.2 Rót + nhỏ giọt — HCl→NaOH + phenolphthalein; HCl→H₂SO₄ không + lý do; BaCl₂→Na₂SO₄; HCl→Na₂CO₃; 10 lần nhỏ = 1 lần lớn.
### 7.3 Rắn + kim loại — Zn/HCl sủi dần, Zn co; Cu/HCl không; Fe đinh/CuSO₄ đỏ bám; CaCO₃ bột.
### 7.4 Đun, nhiệt kế, đồng hồ — Cu + H₂SO₄ đặc nguội không, đun → SO₂ + cảnh báo; Cu(OH)₂ đen; CaCO₃ đèn cồn `NEEDS_HEAT`; trung hòa 50 + 50 ≈ +6,8 °C.
### 7.5 Khí, thu khí, thử khí — H₂ "pép"; KMnO₄ + HCl đặc trong/ngoài tủ hút; CO₂ nước vôi.
### 7.6 Dấu X, đồ thị, động học — Na₂S₂O₃ 25 °C ≈ 60 s, 35 °C ≈ 30 s; Zn + HCl 1 M và 2 M đồ thị dốc gấp đôi; H₂O₂ ± MnO₂.
### 7.7 Âm hóa học + 17 tình huống — loop `lab/fizz`, `bubbles-soft/strong`, `acid-bubble`, `boiling-water-cc0` theo cường độ; đối chiếu từng ca với `npm run chem -- mix …`; ảnh `docs/screens/chang-7/`.

## Tiêu chí nghiệm thu
- [ ] 17 tình huống đúng, trùng CLI (phương trình, reasonCode).
- [ ] Không mã nào trong `src/lab/chem` chọn hiện tượng theo tên cặp chất.
- [ ] Tạm dừng → đứng; ×2 → nhanh gấp đôi; FPS không giảm > 15 % khi 6 bình sủi.

## Lỗi thường gặp
Gọi engine mỗi frame khi rót; quên `liquid.update(dt)`; `surface` phải là hàm; trộn màu thủ công thay vì `describe()`; `inFumeHood` theo tâm bình.

## Bàn giao cho chặng 8
`apply.ts` phát `on('result'|'measure'|'crossHidden'|'gasCollected')`; `vessels.get(id)`; `reset()` về population ban đầu.
