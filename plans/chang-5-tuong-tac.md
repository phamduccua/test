# Chặng 5 — Tương tác: nhìn, cầm mang đi, đặt, kéo thả tại chỗ, vặn, mở, đẩy xe, soi nhãn, âm thao tác

Đọc trước: `plans/00-tong-quan.md`. Chặng 4 đã xong.

## Mục tiêu
Lấy đồ này đồ kia đúng nghĩa: viền sáng + gợi ý khi nhìn; bấm để cầm và mang đi khắp phòng; bấm mặt bàn/kệ/khay/socket để đặt; kéo thả tại chỗ bằng cử chỉ kit; vặn vòi gas, mở cửa tủ, kéo sash, đẩy xe; soi nhãn. Mọi thao tác có âm. Chưa có hóa học.

## Bàn giao từ chặng 3–4 (đọc trước)
- Cánh tủ, ngăn kéo, sash, cần gạt vòi gas đang ĐÓNG được gộp vào một mesh (`src/lab/optimize.ts`). Trước khi gắn `createHinge`/`createHandle` cho một phần, gọi `releaseMovable(objRoot, nodeName)` để hiện lại đúng nút đó (các phần khác vẫn gộp).
- Đồ cầm được bọc `THREE.LOD` (`src/lab/lod.ts`): raycast nên nhắm nhóm bọc (`userData.meta`), không nhắm mesh bên trong. Khi đổi chất lỏng gọi `refreshLod(obj)`.
- Đồ dời chỗ thì gọi `__lighting.invalidateShadows()` (bóng tĩnh).

## Bối cảnh cần đọc (trong `src/vendor/lab3d/interact`)
`pointer.ts`, `pointerTypes.ts`, `types.ts` (`pointerHub(ctx)`, `PointerTarget`, `hub.setLayer`, `hub.busy`, toast/tooltip), `hover.ts` (`createHoverFx`), `grab.ts` + `grabTypes.ts` (`createGrabbable`, `carryTo`), `dropZones.ts`, `knob.ts`, `hinge.ts`, `handle.ts`, `slider3D.ts`, `pushButton.ts`, `hint.ts`, `tooltip.ts`, `constraints.ts` (`pushOutXZ`); `lab/interaction/cameraTween.ts`; `audio/index.ts` (`createSimSound`, `soundOnInteract`); mẫu phối hợp: `sach_dien_tu/Frontend/src/features/hoa10/b22/s01-dung-dich-hcl-tac/{interact,tools,sound}.ts` (chỉ đọc).

## Thiết kế
### Hai tầng thao tác
1. **Tại chỗ (kit)**: `createGrabbable` cho vật trên bàn trong tầm (kéo trong mặt phẳng, thả vào `DropZone` hoặc xuống bàn).
2. **Mang đi** (`src/lab/interact/hand.ts`): **tap** vật → rời cha (`attach` giữ world), gắn "tay" trước camera (lệch x +3,5, y −2,5, z −6 dm, lắc nhẹ, `dampFactor`); đi bình thường; **tap** mặt `placeable`/socket → đặt (snap bằng `DropZones.dropInto`, hoặc tự do tại điểm tia với kiểm `footprint`, bóng mờ xanh/đỏ); **Q** hoặc nút HUD → đặt xuống. Một vật trên tay; khi bận, `blocked()` của target khác trả lý do (toast hub).

### Socket = DropZone
`meta.sockets` → `DropZone` (anchor world, radius, `accepts` theo kind, `snap` pose cục bộ, `exitY` cho ống nghiệm). Bề mặt `placeable` → zone cột lớn. `src/lab/interact/zones.ts` tạo một lần.

### Movables → cử chỉ kit
Cửa/cánh: `createHinge`; ngăn kéo, sash, rèm: `createHandle` hoặc `createSlider3D` (đọc API, chọn trượt theo trục); vòi gas `lever`, vòng gió `collar`, khóa buret `stopcock`: `createKnob({ min 0, max 1, angles [0, π/2] })`; nút: `createPushButton`. Trạng thái trong `src/lab/state.ts` (`Map<instanceId, Record<string, number>>`, phát sự kiện `on('pick'|'place'|'movable'|'inspect')`).

### Xe đẩy
Tap tay đẩy → xe theo camera cách 8 dm, xoay theo yaw, `pushOutXZ` với collider; vật trên khay là con của xe; loop `lab/cart-roll`, `lab/cart-bump`. Tap lần nữa thả.

### Soi nhãn
Giữ > 0,4 s trên lọ hoặc tap lọ đang cầm → nâng lên trước mặt + thẻ HTML tạm (chặng 6 làm đẹp): tên EN/VI, công thức, nồng độ, GHS; Esc/tap thoát.

### Đi bộ ↔ tương tác
`walk.setEnabled(false)` khi `hub.busy()`; kéo chỗ trống = nhìn quanh; WASD hoạt động khi đang cầm.

### Âm (`src/lab/sound.ts`)
`createSimSound(ctx, { id: 'freelab', ambient: [{ key: 'room', id: 'lab/lab-ambience', level: 0,35 }], loops: { cart: { id: 'lab/cart-roll', at: cart, refDistance: 6 } } })`; `soundOnInteract` cho `ui/pick`, `ui/drop`, `ui/drop-ok`, `ui/wrong`; đặt `lab/glass-put`/`lab/snap`; nắp `lab/cap-unscrew`/`cap-screw`; cửa `lab/click-small`; vòi gas `lab/gas-hiss` loop; sash `lab/stopper-squeak`; `setSpatialScale(6)`.

## Các bước
### 5.1 Target + viền — `interact/registry.ts` (duyệt `placed`, `PointerTarget` + `createHoverFx`, hint "Bấm để cầm"), `state.ts`.
### 5.2 Tay và đặt — `interact/hand.ts`, `interact/zones.ts`, `interact/placement.ts` (thuần, test vitest: chồng footprint, điểm hạ). Kiểm: lọ từ đảo 1 sang đảo 2; ống nghiệm cắm giá; vào tủ hút; lên khay xe; thả sai → toast; Q.
### 5.3 Kéo thả tại chỗ — `createGrabbable` cho mọi vật cầm được (`zones` chung, `lift 0,3`, `placeOnFloor: true`, `bounds` mặt bàn, `colliders` lân cận; `blocked()` khi tay bận). Kiểm: kéo cốc vào kiềng; rút ống khỏi giá (`exitY`) cắm ô khác.
### 5.4 Vặn, mở, trượt, bấm — `interact/movables.ts` từ `meta.movables`. Kiểm: vòi gas + hiss; sash 0→6; cửa 110°; ngăn kéo; rèm; khóa buret; vòng gió.
### 5.5 Xe đẩy — `interact/cart.ts`.
### 5.6 Soi nhãn — `interact/inspect.ts` + thẻ tạm Tailwind.
### 5.7 Âm — `sound.ts`; kiểm bằng `window.__snd` (dev hook kit).
### 5.8 Phối hợp và checklist 20 thao tác (`docs/screens/chang-5/checklist.md`); thử `grab.carryTo` (chuẩn bị cho Tự động).

## Tiêu chí nghiệm thu
- [ ] 20 thao tác đạt; không vật bay/chui bàn; cảm ứng tap cầm/đặt được.
- [ ] Không sửa `src/vendor`; typecheck, test xanh; FPS không giảm > 10 %.

## Lỗi thường gặp
`camera.add(obj)` khi camera không trong scene → không render (dùng `scene.add(camera)` một lần hoặc đặt pose mỗi frame); dùng `add()` thay `attach()`; target lồng nhau cần `priority`; quên `ctx.track`.

## Bàn giao cho chặng 6
`state.ts` phát sự kiện; thẻ soi nhãn tạm sẽ được thay.
