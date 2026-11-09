> **ĐÃ XONG (2026-11-09).** Kết quả và các lệch kế hoạch ghi trong `plans/NHAT-KY.md` mục Chặng 6; ảnh trong `docs/screens/chang-6/`. Phần dưới giữ để tham khảo.

# Chặng 6 — Giao diện: toolbar riêng, màn hình bắt đầu, bảng kết quả, sổ thí nghiệm, thẻ chất, HUD, chế độ xem thử

Đọc trước: `plans/00-tong-quan.md`. Chặng 5 đã xong (`state.ts` phát sự kiện).

## Mục tiêu
Toàn bộ lớp giao diện của trang, dựng bằng **DOM + Tailwind**, token màu tự khai báo trong `@theme` và tái dùng `--ui-*` của kit cho phần chung với thanh bước/toast kit. Thay thế vai trò SimHost (React) bằng toolbar riêng. Có `?mode=ui` hiển thị mọi bảng với dữ liệu giả.
Bàn giao: ảnh 10 trạng thái trong `docs/screens/chang-6/`.

## Bối cảnh cần đọc (trong `src/vendor/lab3d`)
`sim/simStore.ts` (caption, warning, hudPlacement), `sim/hudStore.ts` (`hudApi`), `engine/Engine.ts` (`playing`, `speed`, `setQualityPref`), `audio/settings.ts` + `audio/context.ts` (bật tắt âm, âm lượng), `ui/tokens.css`, `ui/collapsible.ts`, `ui/icons.ts`, `interact/procedure.ts` + `procedurePanel.ts` (thanh bước), `charts/cards/resultCard.ts`, `charts/lines/*`, `sim/SimHost.css` (bố cục overlay để không đè nhau), `sim/types.ts` (`ViewInsets`).

## Thiết kế

### Token (`src/app/styles/app.css`)
`@theme { --color-lab-ink: #0f172a; --color-lab-accent: #0e9f6e; --color-lab-warn: #d97706; --color-lab-danger: #dc2626; --radius-panel: 12px; --font-sans: system-ui, "Segoe UI", Roboto, Arial, sans-serif; }` (không tải font ngoài). Bảng dùng nền `bg-white/85 backdrop-blur text-lab-ink shadow-lg rounded-[var(--radius-panel)]`, khung tối khi cần `bg-slate-900/70 text-white`. Chữ ≥ 12 px, vùng chạm ≥ 44 px.

### Khung trang (`index.html`, `src/app/layout.ts`)
`#viewport` full màn hình (Engine), `#toolbar` trên (Tailwind flex), `#gui` góc phải trên cho lil-gui "Tham số" (kit tự gắn), `ctx.overlay` của kit nằm trong viewport cho bảng của phòng lab. Màn hình bắt đầu phủ toàn trang trước khi vào.

### Kho trạng thái (`src/lab/ui/store.ts`)
Bộ phát sự kiện nhỏ: `{ held, hover, lastResult, notebook, measurements, lesson: { stepIndex, done[] }, panels }`; `subscribe`, `set`, `pushResult`, `pushNotebook`, `setMeasurement`, `setChart`. Nghe `state.ts` của chặng 5.

### Thành phần
| Thành phần | Nội dung | Nguồn |
|---|---|---|
| Toolbar (`src/app/toolbar.ts`) | tên bài, chạy/tạm dừng (`engine.playing`), tốc độ 1×/2×/5× (`engine.speed`), loa (`setAudioSettings`), chất lượng (`engine.setQualityPref` + tải lại sim), Đặt lại góc nhìn (`session.view('home')`), Làm lại từ đầu (gọi `sim.reset`), nút "?" hướng dẫn | Engine, session |
| Màn hình bắt đầu (`src/app/startScreen.ts`) | tiêu đề, chọn bài học (từ `lessons/*.json`, chặng 8 điền), chọn chất lượng, bảng phím, nút "Vào phòng" (cử chỉ này mở khóa AudioContext) | |
| Caption + An toàn | đọc `useSim` store của kit (`caption`, `warning`, `warningTone`) → hai dải ở đáy/giữa trên; giữ API `ctx.caption/warn` của kit | simStore |
| HUD số đo | `hudApi` của kit → ô góc phải dưới lil-gui: nhiệt kế, đồng hồ, thể tích khí | hudStore |
| Kết quả và kết luận (`ui/resultPanel.ts`) | Hiện tượng (icon), Số liệu, Phương trình (`toDisplay`), Kết luận + "Sẽ xảy ra nếu…"; thử `createResultCard` kit | `ReactionResult` (chặng 7), dữ liệu giả ở chặng này |
| Sổ thí nghiệm (`ui/notebookPanel.ts`) | dòng thời gian giờ/thao tác/bình/kết quả; lọc theo bình; "Xuất JSON" tải file | store.notebook |
| Thẻ chất (`ui/substanceCard.ts`) | tên EN + VI, công thức, nồng độ/khối lượng, GHS (`textures/ghs.ts`), 2 dòng tính chất | `meta.chem` + `getSpecies` |
| Các bước thực nghiệm | thanh bước kit `createProcedure` (3 bước giả ở chặng này) | chặng 8 |
| Hướng dẫn điều khiển (`ui/guide.ts`) | WASD, kéo chuột, bấm, Q, nút cảm ứng; tự hiện lần đầu (`localStorage['freelab:guide']`) | |
| Đồ thị | `charts/lines` cho thể tích khí/nhiệt độ theo thời gian trong bảng kết quả | chặng 7/8 |
Bảng phụ thu gọn thành chip bằng `collapsible` kit; vị trí theo `ctx.viewInsets()`; khung < 900 px: bảng xếp vào vùng cuộn ở đáy.

## Các bước
### 6.1 Khung trang + toolbar + màn hình bắt đầu — `layout.ts`, `toolbar.ts`, `startScreen.ts`; đổi `main.ts` để vào qua màn hình bắt đầu. Kiểm: tạm dừng → hóa học/anim đứng nhưng đi bộ vẫn được; tốc độ 2×; loa; chất lượng; góc nhìn.
### 6.2 Store + khung bảng — `ui/store.ts`, `ui/panel.ts` (`createPanel({ id, title, side, collapsible })`), `ui/placement.ts` theo `viewInsets`; `?mode=ui`.
### 6.3 Kết quả và kết luận — 3 ca giả: có khí; không phản ứng kèm lý do; cần đun nóng.
### 6.4 Sổ thí nghiệm — 30 dòng giả, lọc, xuất.
### 6.5 Thẻ chất + Hướng dẫn — thay thẻ tạm chặng 5.
### 6.6 Caption, An toàn, HUD — nối `useSim`/`hudApi`; chip An toàn đỏ giữ tới khi xử lý.
### 6.7 Thanh bước giả, phím, focus — khi focus trong input, WASD không điều khiển; Esc đóng bảng; Tab qua các nút; chụp 10 trạng thái.

## Tiêu chí nghiệm thu
- [ ] `?mode=ui` đủ: toolbar, bắt đầu, kết quả 3 ca, sổ, thẻ chất, HUD, thanh bước, hướng dẫn, caption, An toàn.
- [ ] Không đè nhau ở 1280 × 720 và 390 × 844.
- [ ] Người điều phối duyệt thiết kế; typecheck xanh.

## Lỗi thường gặp
Phần tử con của `ctx.overlay` phải `pointer-events: auto`; lil-gui cần `#gui` có kích thước; AudioContext phải mở từ click "Vào phòng"; đổi chất lượng của kit yêu cầu dựng lại sim (host `run` lại module).

## Bàn giao cho chặng 7
`store.pushResult(result, context)`, `pushNotebook`, `setMeasurement`, `setChart`; toolbar đọc `engine.speed` để chặng 7 nhân vào động học (kit đã nhân vào `dt` của `update`).
