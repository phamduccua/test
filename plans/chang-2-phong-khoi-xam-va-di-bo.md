# Chặng 2 — Phòng khối xám đúng tỉ lệ (dm) + đi lại góc nhìn thứ nhất

Đọc trước: `plans/00-tong-quan.md`. Chặng 0 đã xong (`host.ts` chạy `SimModule`).

## Mục tiêu
`src/lab/index.ts` xuất `createFreeLab(ctx, opts): Simulation` là module chính mà `host.ts` chạy. Phòng dựng bằng khối hộp màu phẳng đúng kích thước; đi WASD, kéo chuột nhìn quanh, va chạm. Chốt tỉ lệ và điều khiển trước khi dựng đẹp.

## Bối cảnh cần đọc
`vendor/lab3d/history/walk.ts` (mẫu đi bộ: `blocked`, đích OrbitControls sát mắt, `walkControls`, nút ▲▼◀▶, phím chỉ nhận khi con trỏ trong khung, `frame(dt)` chia bước), `sim/types.ts`, `engine/stages/presets.ts` (camera lab mặc định near 0,05 far 200 – đổi), `engine/labels.ts`.

## Bảng layout (`src/lab/layout.ts`) — dm, rộng X × cao Y × sâu Z, tâm đáy
**Kiến trúc:** floor/ceiling 96 × 84 (y 0 / 30); wall_teach (0, −43) 100 × 30 × 2; wall_window (0, +43); wall_safety (−49, 0) 2 × 30 × 84; wall_store (+49, 0); door (−35, −42) 9 × 21; window_1..4 x = −33/−11/11/33, z 42, 16 × 12, bệ y 13.
**Bàn, tủ:** bench_teacher (0, −26) 30 × 9 × 8; bench_island_1 (0, −5) 48 × 9 × 15 (kệ giữa 40 × 8,5 × 3, tầng y 12,5 và 15,5); bench_island_2 (0, 20) như trên; bench_wall_window (0, 38,75) 90 × 9 × 6,5; bench_wall_store (44,75, 29) 6,5 × 9 × 18; fume_cupboard (43,5, −26) 9 × 24 × 15; cabinet_flammables (45,5, −13) 5 × 18 × 9; cupboard_glazed_1/2 (45,75, 0)/(45,75, 10) 4,5 × 20 × 10; cart (−26, −35) 8 × 9 × 5.
**Ghế (14, mặt y 6,5, r 1,8):** z −15,5: x −16/−5/6/17; z 5,5: x −11/0/11; z 9,5: x −16/−5/6/17; z 30,5: x −11/0/11.
**Tường giảng dạy:** whiteboard x 6, 24 × 12, đáy 9,5; clock x 6, ∅ 3, tâm y 24; poster_hazard x −19, poster_rules x −12, 6 × 8,5, đáy 13,5; pinboard x 24, 12 × 9, đáy 11; coat_hooks x −26, y 17; exit_sign x −35, y 22,5. **Tường kho:** poster_periodic z −33, 16 × 10, đáy 13. **Tường cửa sổ:** pegboard x 43, 8 × 8, đáy 13.
**Trạm an toàn (X = −48):** shower_eyewash (−45, −10) cột r 0,2 cao 23; floor_striping (−42, −10) 12 × 12; first_aid (−47,5, −23) 3 × 3 × 1,2 đáy 15,5; fire_blanket (−47,5, −19) đáy 14,5; extinguisher (−46,5, −16) r 0,8 cao 5,5 đáy 8; 4 biển y 21; bin_steel (−43, 3) r 2 cao 6; bin_sharps (−45, 7,5) 2,5 × 4 × 2,5.
**Trần:** đèn 12 × 6 tại x ∈ {−36, −12, 12, 36} × z ∈ {−30, −10, 10, 30}; miệng gió (−24, 0), (24, 0).
**Xuất phát:** (−35, 16,5, −36) nhìn +Z. **Va chạm:** bench, fume, cabinet, cart, stool (3,6 × 3,6), shower (2 × 2), bin, 4 tường → `getColliders()`.

## Điều khiển
Kéo chuột trên chỗ trống = nhìn quanh (OrbitControls đích cách mắt 0,5 dm, `minDistance 0,1`, `maxDistance 2`, polar 0,35–2,2, zoom/pan tắt). WASD/mũi tên đi, Shift chạy, nút ▲▼◀▶ cảm ứng. Tốc độ 20 dm/s, chạy 36, bán kính người 3. Không khóa con trỏ.

## Các bước

### 2.1 Layout + test
`src/lab/layout.ts` (`LayoutItem`, `ROOM`, `SPAWN`, `LAYOUT`, `getColliders()`), `tests/lab/layout.test.ts` (không trùng id; trong phòng; hai đảo không chồng; 14 ghế; 4 tường).

### 2.2 Blockout
`src/lab/blockout.ts` (`buildBlockout(ctx, layout) → { group, colliders }`): BoxGeometry màu phẳng qua `ctx.track`; bench thêm hộp mặt bàn tối 0,4; window mặt phẳng trong suốt; đèn `MeshBasicMaterial toneMapped:false`; nhãn id bằng `ctx.labels.add` bật tắt F6. Màu: sàn `#c9ccd1`, tường `#ecece8`, trần `#f4f4f2`, thân bàn `#f2f2ef`, mặt bàn `#202124`, tủ hút `#e6e6e3`, tủ vàng `#f2c21b`, ghế `#d9b98a`, xe `#b8bcc0`, an toàn `#1faa59`/`#d62828`, cửa sổ `#9ec3e6`, cửa `#dcdcd6`. Ánh sáng tạm hemisphere 1,0 + directional 1,2 từ (30, 60, 40).
`src/lab/index.ts` `createFreeLab(ctx, { mode: 'play'|'debug' })`: dựng blockout, `camera.fov 62, near 0,1, far 400`, `ctx.fitSafeArea(false)`, `ctx.setHudPlacement('top-right')`. `main.ts` chạy module này thay `devScene` (giữ devScene qua `?scene=dev`).
**Kiểm tra:** ảnh từ trên (F5 → (0, 120, 0)) so `560a441d6b`; lưu `docs/screens/chang-2/top.png`.

### 2.3 Đi bộ
`src/lab/walk.ts` (`createFreeWalk(ctx, area, o)`) chép logic `history/walk.ts` với hằng dm; bỏ chế độ overview; `teleport(pose)`; điểm nhìn F5: cửa (−35, −36, yaw 0), bàn giáo viên (0, −33, 180), trạm an toàn (−30, −10, −90), tủ hút (32, −26, 90), cửa sổ (0, 30, 0), toàn cảnh. Nút ▲▼◀▶ CSS riêng `src/lab/lab.css` (chép và đổi tên lớp `hv-pad`). Gọi `walk.frame(realDt)` trong `Simulation.frame`. Đặt camera ở `SPAWN` trước khi `create()` trả về (nút góc nhìn của toolbar dùng tư thế này). API: `frame`, `teleport`, `setEnabled(bool)`.
**Kiểm tra:** lối giữa hai đảo (10 dm) đi lọt; không kẹt góc; cảm ứng chạy trong DevTools mobile.

### 2.4 Debug + nghiệm thu
`src/lab/debug.ts`: overlay Tailwind góc dưới phải (FPS tự đo, `renderer.info`, vị trí, yaw), bật `?mode=debug` hoặc F3. Đi 3 phút, ghi FPS NHAT-KY, 5 ảnh F5 vào `docs/screens/chang-2/`.

## Tiêu chí nghiệm thu
- [ ] Vào phòng, đi, chạy, nhìn quanh; không xuyên collider; lối 10 dm đi lọt.
- [ ] Ảnh top-down khớp bố cục mẫu.
- [ ] `npm test`, `typecheck` xanh; FPS ≥ 60 máy phát triển.
- [ ] Người điều phối duyệt tỉ lệ; mọi chỉnh sửa vào `layout.ts`.

## Lỗi thường gặp
Quên đổi `far` → tường bị cắt; `OrbitControls.target` xa mắt → camera bị kéo; listener `window` không `ctx.track`; BoxGeometry tâm giữa nhưng layout tâm đáy → `y = (item.y ?? 0) + h/2`.

## Bàn giao cho chặng 3
`layout.ts`, `getColliders()`, `createFreeLab`, `walk` ổn định.
