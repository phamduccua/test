# Nhật ký thực hiện

## Chặng 0

### Bước 0.2–0.3 — Sao chép kit
- Nguồn: `sach_dien_tu` commit `87342f4`. Kết quả: 493 file kit trong `src/vendor/lab3d` (3,0 MB), 169 âm thanh `lab/` + `ui/` trong `public/api/assets/lab3d/audio` (9 MB).
- **Lệch kế hoạch (có chủ đích):** không sửa `audio/settings.ts`. Ba file `audio/settings.ts`, `audio/voice/settings.ts`, `audio/voice/presence.ts` (và `audio/voice/pageNarrator.ts`) chỉ dùng `useSyncExternalStore` của React cho hook không được gọi; thay bằng shim `src/vendor/react-shim.ts` qua alias `react` (vite + tsconfig paths). Nhờ vậy `sync-kit` chạy lại không mất bản vá.
- File bị loại: mọi `.tsx`, `ui/useCollapse.ts`, `audio/useLabSound.ts`, `audio/voice/useStepNarration.ts`; thư mục `geo/` (giữ `geo/globe/coords.ts`), `petri/`, `history/` (giữ `walk.ts`, `post.ts`, `types.ts`).
- File bị vá trong vendor: `assets.ts`, `index.ts` (bỏ export SimHost), 3 dòng re-export trong `audio/index.ts`, `audio/voice/index.ts`, `ui/index.ts`.
- Adapter ngoài vendor: `src/data/contentApi.ts` (`apiAssetUrl` trả nguyên đường dẫn, vì `clips.ts` cần).
- `sync-kit` chạy hai lần cho cùng kết quả (so SHA-1). Typecheck 0 lỗi, build xanh.
- zustand 5 (`create`) import mặc định `React` → shim có thêm default export (`useSyncExternalStore`, `useCallback`, `useDebugValue`).

### Bước 0.4–0.5 — Host + cảnh thử (nghiệm thu)
- `src/app/host.ts` thay SimHost (React): `Engine` + `createSimSession` + `create(ctx)` + `attach` + `engine.setStage`; đồng bộ chạy/dừng/tốc độ từ `useSim`; `reset()`, `view()`.
- `src/app/caption.ts`: dải caption + cảnh báo tạm (Tailwind), chặng 6 thay.
- CSS kit nạp trong `app.css`: tokens, chip, SimHost, SimGui, SimTheme, SimOverlay, Hud, SimWarning.
- Kiểm bằng Chromium headless (SwiftShader, chất lượng tự hạ `low`): cốc 250 mL của kit + chất lỏng + vạch chia, viền sáng khi rê, tooltip "Bấm để nghe tiếng", bảng "Tham số" (lil-gui, thanh trượt thể tích), caption đổi khi bấm; không lỗi console; bấm cốc tải `manifest.json` và `lab/glass-put.webm` (200). 36 draw calls, 68 nghìn tam giác. Ảnh `docs/screens/chang-0/dev-scene*.png`.
- Chưa kiểm: nghe âm thật và chất lượng `medium/high` trên GPU thật (cần mở trên máy có màn hình).

| Mục | Giá trị |
|---|---|
| three | 0.186.1 |
| postprocessing | 6.39.6 |
| lil-gui | 0.21.x |
| zustand | 5.1.0 |
| vite / tailwindcss | 6.4.5 / 4.3.5 |
| vitest / typescript | 5.1.0 / 5.8.x |
| Bundle build | JS 1,1 MB (gzip 358 kB), CSS 45 kB – tối ưu tách chunk ở chặng 8 |

## Chặng 1 — Bộ máy hóa học (xong 2026-11-08)

- `src/chem` + `content/chem.json` (66 chất khai báo, 19 cation × 23 anion ghép tự động) + `content/chem-text.json`.
- `npm test`: **146 test xanh** = 106 ca vàng + 40 test đơn vị. Mọi `ReasonCode` có ít nhất một ca. Bộ test bắt được lỗi gài thử (2/2).
- Số liệu kiểm: dấu X Na₂S₂O₃ 25 °C 64 s, 35 °C 32 s; Zn 1 g/HCl 1 M còn 0,048 g sau 600 s; H₂ 2 M/1 M = 2,00; trung hòa ΔT 6,83 °C; O₂ có/không MnO₂ gấp ~5300 lần.
- Đầu ra CLI 8 lệnh mẫu: `docs/screens/chang-1/cli.txt`.
- **Lệch kế hoạch (có chủ đích):**
  - Mô hình mức phân tử thay vì mức ion: phương trình phân tử đúng SGK, luật vẫn tổng quát (tính tan, dãy hoạt động, pKa, halogen).
  - Hệ số tự cân bằng bằng đại số tuyến tính, nên bảng `redoxReactions` chỉ cần chất, không cần hệ số (trừ KMnO₄ + H₂O₂).
  - Bỏ `NEEDS_LIGHT`, `ALREADY_AT_EQUILIBRIUM`: không dùng trong phạm vi Hóa 10.
  - FeSCN chưa mô phỏng hằng số cân bằng (ghi ở README, "Giới hạn").
  - `chemText` dùng khóa đọc được (`reason.SAME_CLASS_ACIDS`), không dùng khóa SHA-1.
  - Thêm `@types/node` (devDependency, chỉ kiểu) cho CLI và test.
- Chưa có: giáo viên duyệt `species` và bảng ca vàng.

## Chặng 2 — Phòng khối xám + đi bộ (xong 2026-11-09)

- `src/lab/layout.ts` (nguồn sự thật bố cục), `collision.ts`, `blockout.ts`, `walk.ts`, `debug.ts`, `index.ts` (`freeLabModule`). `src/app/main.ts` mặc định chạy phòng lab; `?scene=dev` mở lại cảnh thử kit; `?mode=debug` bật số liệu + nhãn.
- Điều khiển: kéo chuột chỗ trống nhìn quanh (OrbitControls tâm quay cách mắt 0,5 dm), W/S đi, A/D bước ngang, ←/→ quay, Shift chạy, nút ▲▼◀▶ cảm ứng; F3 số liệu, F4 bay (Space/C lên xuống), F5 điểm nhìn, F6 nhãn.
- Kiểm bằng Chromium headless: đi 1,5 s ≈ 28 dm; lao vào bàn đảo dừng đúng mép bàn − bán kính người; chạy dọc lối giữa hai đảo không vướng; không lỗi console. Ảnh 7 điểm nhìn + `top-compare.png` (so ảnh mặt bằng mẫu) trong `docs/screens/chang-2/`.
- Test: 12 test mới (layout + va chạm), tổng 158 xanh. Có test **tìm đường BFS** trên lưới 0,5 dm: từ cửa đi tới được 11 chỗ đứng quan trọng.
- **Lệch kế hoạch:**
  - Bảng layout trong kế hoạch làm hai hàng ghế giữa hai bàn đảo chồng kín lối đi (khe 0,4 dm). Đã dời theo Z: bàn GV z −32,5; đảo 1 z −11,5; đảo 2 z 17,5; ghế sát mép bàn (z −20,5 / −2,5 / 8,5 / 26,5); lối giữa hai hàng ghế 8 dm. Bàn tường cửa sổ rút còn 86,5 dm để ghép chữ L với bàn tường kho (z 20…42). Xe đẩy dời về (−41, −30) cho thoáng cửa. Ghế va chạm 3 × 3 dm.
  - Bán kính người 2,5 dm (25 cm, vai người lớn) thay 3 dm.
  - Không màn "Nhấp để vào phòng" vì không khóa con trỏ; thay bằng bảng điều khiển ngắn bấm để ẩn.
  - Hướng: nhìn +Z thì X− (tường an toàn) nằm bên phải màn hình – quy ước của three.js, bố cục vẫn khớp ảnh mẫu khi xoay.
- Khác ảnh mẫu, chờ người điều phối quyết: ảnh mẫu đặt tủ hút giữa tường kho; kế hoạch (và hiện tại) đặt ở z −26 gần tường giảng dạy. Sửa một dòng trong `layout.ts` nếu muốn đổi.
- FPS máy thật chưa đo (headless dùng render phần mềm, ~11 FPS không có ý nghĩa). Draw calls 66–108, tam giác < 3 nghìn.

## Chặng 3 — Nội thất và vật thể (xong 2026-11-09)

- Builder riêng (`src/lab/builders/`): bàn đảo hai mặt (mô-đun cánh/ngăn kéo 6 dm có node `door_*`/`drawer_*`, kệ giữa 2 tầng, 3 vòi gas đồng mỗi bên, 2 bồn rửa, ổ cắm), bàn một mặt (bàn GV có bồn + vòi gas; bàn tường), ghế đẩu, xe đẩy 2 tầng, tủ hút (cửa kính trượt `sash`, đèn buồng, ống thoát, `hoodVolume`), tủ chất dễ cháy, tủ kính, bảng trắng, khung poster, bảng ghim, móc + áo blouse, giá phơi, vòi sen + bồn rửa mắt, bình chữa cháy, hộp sơ cứu, chăn chữa cháy, biển báo, thùng rác, thùng mảnh vỡ; buret, lọ thu khí, chén nung, bát sứ, chậu, nút cao su, kính bảo hộ, hộp găng.
- Từ kit (bọc thêm siêu dữ liệu): cốc 100/250/500, bình tam giác, ống nghiệm, ống đong, bình cầu, bình định mức, phễu, mặt kính, đĩa petri, đũa, ống hút, chai thuốc thử, lọ nhỏ giọt, bình tia, giá ống nghiệm, giá đỡ, kiềng lưới, đèn Bunsen, đèn cồn, nhiệt kế, đồng hồ bấm giờ, que đóm, thìa, ống nhỏ giọt, kẹp, bể ổn nhiệt, cân, cối chày, khay, sổ, bút, giấy dấu X, đinh sắt, đồng hồ treo tường. Bộ lắp sẵn: bộ chuẩn độ, bộ đun (dây gas nối vòi bàn GV).
- **Chai thuốc thử lấy màu dung dịch từ bộ máy hóa học** (`describe(makeSolution(...))`): CuSO₄ xanh, KMnO₄ tím, FeCl₃ vàng nâu… tự đúng; nhãn ghi công thức + nồng độ, "đặc" khi vượt ngưỡng; nắp màu theo loại chất.
- Bày 59 chai/lọ hóa chất + dụng cụ (`room/population.ts`, toạ độ cục bộ theo vật cha). Phòng trưng bày `?mode=showroom&batch=furniture|fixtures|safety|glassware|apparatus|reagents|all`. Khối xám cũ: `?mode=blockout`.
- **LOD (`src/lab/lod.ts`) – lệch kế hoạch, cần thiết:** thủy tinh kit 20–65 nghìn tam giác/vật. Gần (< 9 dm) giữ nguyên kit; xa dùng bản ≤ 28 điểm × 16 lát, kính thường thay kính khúc xạ. Tam giác cao nhất (toàn cảnh) 656 nghìn (< 900 nghìn).
- Số liệu (headless): draw call 63–2.744 tuỳ góc nhìn – **vượt mục tiêu 600, để chặng 4 gộp/instancing**. Ảnh: `docs/screens/chang-3/showroom-*.png`, `room-*.png`.
- Test: +5 (danh sách bày đồ hợp lệ, chất có trong bộ máy hóa học), tổng 163 xanh.
- Sửa trong lúc làm: buret 7 dm không vừa tủ kính → bỏ; dây gas lệch 0,5 dm; vòi sen quay ra phòng (`facing: '+x'`); thanh chắn kệ.
- Chưa làm (thuộc chặng 4): mặt biển báo, poster, bảng tuần hoàn, nội dung bảng trắng, nhãn tủ còn trống; ánh sáng còn tạm (hemisphere + 1 đèn hướng).

## Chặng 4 — Làm đẹp (xong 2026-11-09)

- **Ánh sáng** (`src/lab/lighting.ts`): env phòng sáng của Engine (yếu, 0,32), tone mapping Neutral (đúng màu dung dịch), bán cầu dịu, **đèn trần đặt ngay dưới trần** (bóng mềm dưới ghế/dụng cụ, trần không chắn), **nắng chéo qua lỗ cửa sổ thật** (tường cửa sổ dựng thành mảng có lỗ + trần đổ bóng → mảng nắng và bóng khung cửa trên sàn/bàn), đèn bổ trợ yếu. Bóng tĩnh (`invalidateShadows()` khi đồ dời chỗ): high 2048, medium 1024, low tắt. Kính/dung dịch dùng `setLabMaterialLook` preset bench của kit (gọi trước khi dựng đồ).
- Không dùng env 'lab-studio' của kit: hợp cảnh cận một bàn nhưng làm kim loại trong phòng lớn phản chiếu màu tối. Không dùng hậu kỳ lịch sử (ACES làm lệch màu dung dịch).
- **Hậu kỳ** (`src/lab/post.ts`): `createLabPost` của kit (bloom ngưỡng cao, Neutral, tương phản, vignette, SMAA/MSAA); low không hậu kỳ.
- **Theo góp ý "sáng hơn mẫu"**: hạ bán cầu 1,6 → 0,62, bỏ phát sáng tường, sàn xám đậm hơn, thêm nắng qua cửa sổ; tương phản gần ảnh mẫu hơn (`compare-*.png`).
- **Nội dung bề mặt** (`src/lab/textures/`): 6 loại biển an toàn (sơ cứu, rửa mắt, vòi sen, chăn, bình chữa cháy, lối ra), 8 biểu tượng GHS vẽ tay, poster "Ký hiệu cảnh báo nguy hiểm", poster "Nội quy an toàn" (8 điều), **bảng tuần hoàn 118 nguyên tố** có chú giải nhóm, bảng trắng "Tính chất hóa học của axit", dải chữ tủ hút, nhãn tủ dễ cháy, mặt hộp sơ cứu/chăn chữa cháy, nhãn bình CO₂. Bảng tuần hoàn dời sang tường giảng dạy cạnh bảng trắng (như ảnh mẫu).
- **Giảm draw call** (`src/lab/optimize.ts`): gộp mảnh tĩnh theo vật liệu; cánh tủ/ngăn kéo đang đóng gộp một mesh, nút gốc giữ ẩn, `releaseMovable(root, name)` tách đúng cánh cần mở (chặng 5 dùng); vật nhỏ gộp mesh màu đỉnh. LOD 3 mức (< 9 dm nguyên bản kit; 9–25 dm kính + dung dịch gộp RGBA, nhãn giữ; > 25 dm nhãn thành giấy trơn); `refreshLod(obj)` dựng lại bản xa khi dung dịch đổi (chặng 7).

| Góc (nấc low) | Draw call trước → sau | Tam giác |
|---|---|---|
| Cửa ra vào | 1.675 → 484 | 486 nghìn |
| Giữa hai bàn đảo | 1.593 → 560 | 503 nghìn |
| Bàn giáo viên | 2.224 → 624 | 675 nghìn |
| Toàn cảnh từ trên (gỡ lỗi) | 2.744 → 912 | 810 nghìn |

- Góc đối chiếu ảnh mẫu: `src/lab/cameraPresets.ts` (F5), ảnh + `compare.md` trong `docs/screens/chang-4/`.
- Test: +22 (bảng tuần hoàn 20, gộp/tách cánh tủ 2), tổng 185 xanh.
- Chưa đo: FPS trên GPU thật ở 3 nấc; rò bộ nhớ khi tải lại sim nhiều lần (chưa có nút đổi sim trong trang – để chặng 6 có toolbar).
