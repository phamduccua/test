# Chặng 4 — Làm đẹp: ánh sáng, hậu kỳ, vật liệu, texture, nhãn, poster

Đọc trước: `plans/00-tong-quan.md`. Chặng 3 đã xong.

## Mục tiêu
Đưa phòng lên gần ảnh mẫu bằng bộ ánh sáng và hậu kỳ của kit, bổ sung texture canvas và nhãn/poster. Nấc chất lượng theo `ctx.quality` (`?q=low|medium|high` của kit).
Bàn giao: 6 cặp ảnh đối chiếu trong `docs/screens/chang-4/compare.md` được duyệt; FPS high ≥ 60 (GPU rời), medium ≥ 40 (tích hợp), low chạy không hậu kỳ.

## Bàn giao từ chặng 3 (đọc trước)
- Draw call hiện tới ~2.700 khi nhìn toàn cảnh: ưu tiên gộp hình tĩnh của nội thất (cánh tủ, tay nắm, khung trần) và instancing ghế/đèn ở bước 4.6.
- LOD đã có (`src/lab/lod.ts`, ngưỡng 9 dm); khi đổi vật liệu kính phải giữ bản xa không dùng transmission.
- Mặt cần vẽ: `signFace`, `posterFace`, `boardFace`, `label_L/R`, mặt giấy hộp sơ cứu/chăn chữa cháy, `exit` sign; nội dung bảng tuần hoàn treo tường kho.
- Nhãn 3D của kit ẩn mặc định (hiện khi con trỏ gần; "Hiện mọi nhãn" trong Tham số).

## Bối cảnh cần đọc (trong `src/vendor/lab3d`)
`lab/room/labLighting.ts`, `lightingPresets.ts` (`LAB_LOOKS`), `lighting.ts` (`createLightRig(span, levels)`), `lab/room/labPost.ts` (`createLabPost`: bloom, Neutral tone mapping, tương phản, vignette, SMAA/MSAA), `history/post.ts` (`createHistoryPost`: thêm SSAO nhưng ACES làm lệch màu dung dịch), `lab/materials/look.ts` (`setLabMaterialLook`), `lab/materials/textures.ts`, `materials/canvas.ts`, `lab/glassware/wrapLabel.ts`, `charts/periodic/*`, `micro/elements/*`, `engine/quality.ts`, `sim/capture.ts`.

## Thiết kế

### Ánh sáng phòng
- `scene.environment = ctx.sharedEnvironment('lab-studio')`, `environmentIntensity` 0,5–0,7; `renderer.toneMapping = NeutralToneMapping`, exposure ≈ 1,0.
- Đèn tấm: mặt phát sáng `MeshBasicMaterial({ toneMapped: false })` `#f4f8ff` + tối đa 4 `RectAreaLight` gộp theo hàng nếu FPS cho phép, không thì `PointLight` yếu ở 4 vị trí.
- `createLightRig(100, LAB_LOOKS.bench.lights)`: key đổ bóng mềm hướng qua cửa sổ, shadow map 2048, camera bóng ±50 × ±45, bias −0,0005, normalBias 0,02.
- Bóng tĩnh: `shadowMap.autoUpdate = false`, `invalidateShadows()` khi vật di chuyển.
- `setLabMaterialLook(ctx, LAB_LOOKS.bench.materials)`.

### Hậu kỳ theo chất lượng
high: `createLabPost(ctx, { bloom: 0,3, contrast: 0,08, vignette: 0,22 })` + bóng 2048; medium: `createLabPost` + bóng 1024; low: không hậu kỳ, không bóng. Thử `createHistoryPost` một phiên, ghi kết luận về màu dung dịch vào NHAT-KY.

### Texture canvas (`src/lab/textures/`)
`ceilingTile`, `wallPlaster`, sàn `tileTexture('#c9cdd2', '#b9bec4', 6, 0,04)`, mặt bàn `MeshPhysicalMaterial({ color: 0x1b1c1e, roughness: 0,45, clearcoat: 0,1 })`, đồng thau `metalness 1, roughness 0,3, 0xc9a24a`; `ghsPictogram(kind)` 8 hình; `safetySign(type)`; `hazardPoster`, `labRulesPoster`, `whiteboardContent` (phương trình trung hòa + bảng titre như `f8f3a946db`), `resultsSheet`, `periodicTable` (vẽ từ `micro/elements` nếu đủ 118, không thì bổ sung `textures/elements.ts`), `windowView`, `exitSign`. Texture canvas đặt `colorSpace = SRGBColorSpace`, ≥ 512 px cho mặt 7 × 5 dm.

### Góc máy đối chiếu (`?mode=cam&view=`)
| view | ảnh | mắt (dm) → nhìn |
|---|---|---|
| front-bench | `e816f2890e` | (0, 16,5, −31) → +Z |
| teaching-wall | `f8f3a946db` | (−30, 17, 30) → (10, 14, −42) |
| safety | `0be195b3ab` | (−25, 16, 5) → (−48, 13, −12) |
| fume | `a981ac60a3` | (25, 16, −10) → (48, 14, −26) |
| titration | `2f60ff79ae` | (−6, 13, 32) → (0, 11, 20) |
| heating | `694a567207` | (−8, 14, −20) → (0, 10, −26) |
Chụp qua `sim/capture.ts` hoặc màn hình; `compare.md` ảnh mẫu trái, render phải.

## Các bước
### 4.1 Ánh sáng và môi trường — `src/lab/lighting.ts` (`createRoomLighting(ctx, layout, quality) → { rig, invalidateShadows, dispose }`). Kiểm: không cháy sáng, kính có vệt softbox, bóng mềm dưới ghế, FPS 3 nấc.
### 4.2 Hậu kỳ — `src/lab/post.ts` theo bảng. Kiểm: `?q=low` không hậu kỳ.
### 4.3 Vật liệu, texture kiến trúc — `textures/{noise,ceilingTile,wallPlaster,index}.ts`, cập nhật `materials.ts`, `roomShell`.
### 4.4 Nhãn, biển báo, poster, bảng tuần hoàn — `textures/{ghs,signs,posters,periodic,whiteboard,sheets}.ts`; gắn vào node `signFace/posterFace/boardFace/stripeFace/label_*`; lọ: `setLabel(nameEn, formula + nồng độ, stripe)` + tấm GHS nhỏ. Kiểm: đọc được nhãn ở 5 dm.
### 4.5 Góc máy và `compare.md` — `src/lab/cameraPresets.ts` (dùng chung F5).
### 4.6 Hoàn thiện và hiệu năng — gộp hình tĩnh (`BufferGeometryUtils.mergeGeometries`), `InstancedMesh` cho ghế/đèn/lọ cùng cỡ, draw calls ≤ 600, không rò bộ nhớ khi tải lại sim 5 lần.

## Tiêu chí nghiệm thu
- [ ] 6 cặp ảnh được duyệt; CuSO₄ xanh, KMnO₄ tím, FeCl₃ vàng nâu đúng dưới hậu kỳ.
- [ ] 3 nấc chạy, FPS đạt; không sửa `src/vendor`; typecheck xanh.

## Lỗi thường gặp
ACES làm dung dịch ngả xám tím; RectAreaLight không đổ bóng và tốn; quên `colorSpace` texture; quên cập nhật bóng tĩnh.

## Bàn giao cho chặng 5
`lighting.invalidateShadows()`, `cameraPresets`.
