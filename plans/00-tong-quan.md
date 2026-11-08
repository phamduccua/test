# Tổng quan và quy ước chung — Phòng thí nghiệm Hóa học 3D tự do (trang riêng, mượn kit STEM SmartLab)

File này là **mục lục + quy ước dùng chung**. Mỗi chặng một file, tự đủ: model thực hiện chỉ cần đọc file 00 và file chặng đang làm.

## 1. Sản phẩm

- **Một web app riêng** tại `/home/anhvt/GIA_SU/a/local/test` (repo git riêng, nhánh `main`). Không thuộc danh mục bài học, không cần Backend/MongoDB của STEM SmartLab.
- Học sinh đi lại trong phòng lab 3D góc nhìn thứ nhất, lấy hóa chất và dụng cụ trên kệ, tự do làm thí nghiệm.
- **Bộ máy hóa học là trọng tài tổng quát**: phán xét mọi cặp chất theo luật, không theo kịch bản. Trộn hai axit → "không xảy ra phản ứng" kèm lý do.
- Phạm vi hóa học: Hóa 10 (GDPT 2018): oxi hóa – khử, tốc độ phản ứng, halogen, trên nền lớp 9. Bài học là **JSON của riêng dự án**, không chia theo bài của STEM SmartLab.
- **Mượn kit** `src/kit/lab3d` của STEM SmartLab bằng cách **sao chép vào repo này** (`src/vendor/lab3d`). Không mua, không tải tài sản mới; âm thanh CC0 lấy từ bộ có sẵn bên đó.

## 2. Cấu trúc repo

```
/home/anhvt/GIA_SU/a/local/test
  index.html  package.json  vite.config.ts  tsconfig.json  vitest.config.ts
  public/api/assets/lab3d/audio/{manifest.json, lab/, ui/}   # clip CC0 chép từ Backend STEM SmartLab
  reference/images/*.webp        # 11 ảnh mẫu (chuyển từ gốc repo vào ở bước 0.1)
  scripts/sync-kit.sh            # chép lại kit từ ../sach_dien_tu khi cần
  src/
    vendor/lab3d/                # KIT SAO CHÉP – chỉ sửa 3 chỗ được liệt kê ở chặng 0, còn lại coi như thư viện
    vendor/typography.ts         # kit cần
    content/lab3d.json           # chữ của kit (kit đọc bằng labText)
    chem/                        # bộ máy hóa học thuần (chặng 1)
    lab/                         # phòng lab: layout, room, walk, hand, chem binding, ui (chặng 2–7)
    app/                         # main.ts, host.ts (Engine + createSimSession), toolbar.ts, styles/app.css
    lessons/*.json               # bài học riêng (chặng 8)
  tests/                         # vitest cho chem và các hàm thuần
  docs/screens/chang-N/          # ảnh nghiệm thu
  plans/                         # các file này + NHAT-KY.md
```

## 3. Stack và lệnh

- Vite + TypeScript strict + **Tailwind CSS 4** (`@tailwindcss/vite`) + `three@0.186.x` + `@types/three@0.186.x` + `postprocessing@6.39.x` + `lil-gui@0.21.x` + `zustand@5.x` + Vitest. **Không React** (các file React của kit bị bỏ khi sao chép). Phiên bản phải khớp `sach_dien_tu/Frontend/package.json` để kit chạy đúng.
- Lệnh: `npm run dev`, `npm run build`, `npm run typecheck` (`tsc --noEmit`), `npm test` (vitest), `npm run chem -- <lệnh>` (CLI hóa học), `npm run sync-kit`.

## 4. Quy ước kỹ thuật

### 4.1 Thang đo (theo kit)
**1 đơn vị = 1 dm.** `mm()`, `cm()`, `fromML`, `toML` trong `vendor/lab3d/lab/units.ts`. Phòng 96 × 84 dm, trần 30, mặt bàn 9, mắt 16,5. Gốc ở tâm sàn, Y lên. Tường Z = −42 giảng dạy (cửa vào), Z = +42 cửa sổ, X = −48 an toàn, X = +48 kho.

### 4.2 Kit là thư viện
- **Không sửa tay** file trong `src/vendor/lab3d`. Mọi bản vá nằm trong `scripts/sync-kit.sh` (assets.ts, index.ts, 3 dòng re-export) để chạy lại không mất. Cần hành vi khác → viết bọc ngoài trong `src/lab`.
- `react` được alias tới `src/vendor/react-shim.ts` (vite + tsconfig paths): vài file kit và zustand chỉ cần `useSyncExternalStore`. `src/data/contentApi.ts` là adapter `apiAssetUrl` cho `audio/voice/clips.ts`. Không thêm React thật.
- Khung chạy: `src/app/host.ts` (`createHost(root)` → `run(module)`, `reset()`, `view()`), thay SimHost React của kit. Cảnh thử kit: `src/app/devScene.ts`.
- Kit dùng `labText('t_…')` đọc `src/content/lab3d.json`; khi `src/lab` cần chữ của kit thì gọi `labText`, còn chữ của mình **viết thẳng tiếng Việt trong mã hoặc JSON riêng** (không có ràng buộc khóa SHA-1 ở repo này).
- Mọi vật thể, material, texture, listener tạo trong sim → `ctx.track(...)`.

### 4.3 Điều khiển
Theo cách của kit: kéo chuột trên chỗ trống để nhìn quanh (OrbitControls với đích sát mắt), WASD/mũi tên đi, Shift chạy, nút ▲▼◀▶ cho cảm ứng. **Không khóa con trỏ**, vì `pointerHub`, kéo thả, rót nghiêng, núm vặn của kit chạy theo vị trí con trỏ.

### 4.4 Giao diện
DOM thuần + Tailwind. Token màu: `src/app/styles/app.css` khai báo `@theme` của Tailwind và import `vendor/lab3d/ui/tokens.css` để dùng `--ui-*` khi muốn đồng bộ với bảng của kit (thanh bước, toast). Thanh chạy/dừng/tốc độ/loa/chất lượng do mình làm (`app/toolbar.ts`) vì SimHost của kit là React.

### 4.5 Chất lượng mã
`strict`, không `any`. Hàm thuần (`chem`, `lab/layout`, `lab/placement`) có test vitest. Tên file/biến tiếng Anh; UI tiếng Việt.

## 5. Bản đồ tái dùng kit (bắt buộc dùng, không viết lại)

| Nhu cầu | Trong `src/vendor/lab3d/...` |
|---|---|
| Renderer, vòng lặp, env PMREM, chất lượng, nhãn CSS2D | `engine/Engine.ts`, `engine/quality.ts`, `engine/stages/*` |
| `SimContext` (scene, camera, controls, gui, hud, caption, warn, labels, track, overlay, audio, setRenderHook, sharedEnvironment) | `sim/createContext.ts` (`createSimSession`), `sim/types.ts`, `sim/simStore.ts`, `sim/hudStore.ts` |
| Thủy tinh | `lab/glassware/*`: `createBeaker/Erlenmeyer/TestTube/GraduatedCylinder/RoundFlask/Funnel/GlassRod/Pipette/DeliveryTube`, `buildProfile` + `createVessel` |
| Lọ hóa chất có nhãn | `lab/equipment/reagentBottle.ts` |
| Chất lỏng, hiện tượng | `lab/liquid/*`, `lab/effects/*` (bubbles, precipitate, precipitateCloud, foam, suspension, flame, pour, profileGas, volumeGas, particles) |
| Thiết bị | `lab/equipment/*` (retortStand, tripodGauze, tubeRack, tubeHolder, thermometer, stopwatch, splint, spatula, nail, dropper, paperSheet + drawCrossMark, waterBath, iceCubes, digitalScale, alcoholLamp), `lab/microbio/burner.ts` (Bunsen), `lab/solids/*`, `lab/containers/*`, `lab/desk/*` |
| Bàn, đèn, hậu kỳ, vật liệu, texture | `lab/room/*` (createBench, createLightRig, createLabLighting, createLabPost, LAB_LOOKS), `lab/materials/*`, `history/post.ts` (SSAO) |
| Cử chỉ | `interact/*`: pointerHub, createGrabbable, createDropZones, createTiltPour, createCarryPour, createDropperGesture, createKnob, createHinge, createHandle, createSlider3D, createPushButton, createHoverFx, createHint, createProcedure (+ thanh bước, Tự động, thuyết minh) |
| Đi bộ (mẫu để chép) | `history/walk.ts` |
| Âm thanh | `audio/*` (`createSimSound`, `soundOnInteract`, `ctx.audio`), id trong `public/api/assets/lab3d/audio/manifest.json` |
| Bảng tuần hoàn, đồ thị, thẻ kết quả | `charts/*`, `micro/elements/*` |

Trước khi viết builder hay cử chỉ mới: grep `vendor/lab3d/lab/index.ts` và `vendor/lab3d/interact/index.ts`.

## 6. Các chặng

| Chặng | File | Kết quả bàn giao |
|---|---|---|
| 0 | `chang-0-khoi-tao-va-sao-chep-kit.md` | Dự án Vite + Tailwind chạy; kit sao chép, typecheck xanh; host dựng `Engine` + `ctx`; cảnh thử có cốc kit và âm thanh |
| 1 | `chang-1-bo-may-hoa-hoc.md` | `src/chem` ≥ 80 ca vàng vitest, CLI |
| 2 | `chang-2-phong-khoi-xam-va-di-bo.md` | Phòng khối xám đúng tỉ lệ (dm), đi lại góc nhìn thứ nhất, va chạm |
| 3 | `chang-3-noi-that-va-vat-the.md` | Phòng lắp đầy đủ bằng kit + builder riêng; phòng trưng bày |
| 4 | `chang-4-lam-dep.md` | Ánh sáng, hậu kỳ, texture, nhãn, poster; đối chiếu ảnh mẫu |
| 5 | `chang-5-tuong-tac.md` | Cầm mang đi, đặt, kéo thả, vặn, mở, đẩy xe, soi nhãn, âm thao tác |
| 6 | `chang-6-giao-dien.md` | Toolbar riêng, Kết quả và kết luận, Sổ thí nghiệm, Thẻ chất, HUD, màn hình bắt đầu, chế độ xem thử |
| 7 | `chang-7-chat-long-khi-nhiet.md` | Rót, nhỏ giọt, rắn, đun, khí, đo; engine điều khiển hiện tượng |
| 8 | `chang-8-bai-hoc-va-hoan-thien.md` | 4 bài học JSON, tiến độ, âm thanh, hiệu năng, build tĩnh, bàn giao |

## 7. Quy tắc cho model thực hiện

1. Một bước mỗi phiên, đúng thứ tự. Không gộp.
2. Trước khi bắt đầu: đọc "Bối cảnh" của file chặng; mở các file kit được nêu tên.
3. Sau mỗi bước: `npm run typecheck` và `npm test` xanh.
4. Không sửa `src/vendor/**` (trừ chặng 0). Không sửa file ngoài phạm vi bước; bắt buộc thì ghi `plans/NHAT-KY.md`.
5. Commit mỗi bước: `chang-N buoc-M: <mô tả tiếng Anh>`.
6. Kẹt > 30 phút: ghi NHAT-KY rồi dừng. Không đổi kiến trúc, không thêm thư viện npm ngoài mục 3.
7. Không tải tài sản từ internet. Âm thanh chỉ dùng id trong manifest đã chép.

## 8. Ảnh tham chiếu (`reference/images/`)

| Hậu tố | Nội dung |
|---|---|
| `0be195b3ab` | Trạm an toàn |
| `25bc56e392` | Wireframe toàn phòng |
| `2f60ff79ae` | Bàn chuẩn độ, lọ trên kệ |
| `560a441d6b` | Mặt bằng 9,6 × 8,4 m |
| `694a567207` | Đun nóng với Bunsen |
| `a981ac60a3` | Tủ hút, tủ vàng, tủ kính |
| `bb7fc05a40`, `d85dd8f3cf` | Toàn phòng |
| `ca86e18c97` | Xe đẩy, tủ hút, cột vòi sen |
| `e816f2890e` | Từ bàn giáo viên nhìn ra cửa sổ |
| `f8f3a946db` | Tường giảng dạy |
