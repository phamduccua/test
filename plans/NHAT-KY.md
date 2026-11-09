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
