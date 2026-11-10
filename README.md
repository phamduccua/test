# Phòng thí nghiệm Hóa học 3D (Hóa 10)

Phòng thí nghiệm ảo đi lại tự do: học sinh đi trong phòng, tự lấy hóa chất và dụng cụ trên kệ, rót, nhỏ, đun, thử khí… Mọi thao tác được một **bộ máy hóa học theo quy luật** phán xét. Bộ máy không chạy theo kịch bản: hai axit đổ vào nhau thì báo "không xảy ra phản ứng" kèm lý do; muối + axit không tạo kết tủa, khí hay chất điện li yếu cũng vậy. Có phản ứng thì hiện hiện tượng, phương trình đã cân bằng và cảnh báo an toàn.

Phạm vi: Hóa 10 (GDPT 2018) trên nền kiến thức lớp 9. Không có bài học theo bước: đây là phòng **thí nghiệm tự do**.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: bộ máy hóa học (ca vàng), bày đồ, đặt đồ, gộp mesh, lõi hóa học của phòng
npm run typecheck
npm run build      # ra dist/ (trang tĩnh, ~11 MB gồm âm thanh)
npm run preview    # chạy thử dist/
npm run chem -- mix "HCl 1M 10mL" "Na2CO3 0.5M 10mL"   # hỏi bộ máy từ dòng lệnh

# Kiểm tra trên trình duyệt thật (cần `npm run dev` đang chạy; dùng Chrome/Edge có sẵn, đặt CHROME_PATH nếu ở chỗ khác)
npm run sweep      # quét đặt đồ toàn phòng + đinh vào mọi loại bình + Làm lại; mã thoát 1 nếu có lỗi
npm run shots      # chụp 6 góc đối chiếu ảnh mẫu vào docs/screens/ + đo khung hình (thêm: -- medium 1600 900)
```

### Lightmap (ánh sáng nướng sẵn)

Phần tĩnh của phòng (tường, sàn, trần, thân tủ, mặt bàn, kệ) có lightmap nướng bằng Blender Cycles: ánh sáng **gián tiếp** (ánh dội giữa các bề mặt, che khuất mềm ở góc, gầm, khe tủ). Ánh sáng trực tiếp và bóng đổ vẫn tính thời gian thực. Tệp đã nướng nằm trong `public/lightmap/` (atlas 2048 px), tự gắn ở nấc medium/high; `?nolightmap` để so sánh, `?lmgain=0.15` để chỉnh độ mạnh.

**Đổi bố trí hay nội thất phòng thì nướng lại** (mesh không khớp số đỉnh sẽ bị bỏ qua và in cảnh báo trên console):

```bash
npm run dev                                   # cửa sổ khác
BLENDER="C:/đường/dẫn/blender.exe" npm run lightmap               # 2048 px, 64 mẫu: ~6–7 phút trên CPU
BLENDER=... npm run lightmap -- --size 1024 --samples 16          # bản thử nhanh (~1 phút)
```

Cần Blender 4.x (bản zip chạy ngay, không cần cài). Quy trình: `scripts/lightmap/export.mjs` (trình duyệt xuất mesh tĩnh + vật che + vị trí đèn) → `scripts/lightmap/bake.py` (Blender: mở UV chung một atlas, nướng, khử nhiễu OIDN) → `src/lab/lightmap.ts` gắn lúc chạy.

`dist/` là trang tĩnh, đặt ở gốc tên miền vì âm thanh nạp từ `/api/assets/lab3d/audio/`.

### Cờ trên URL

| Cờ | Ý nghĩa |
|---|---|
| `?q=low\|medium\|high` | Chất lượng hình (mặc định tự đoán: GPU tích hợp → medium; cũng chọn được ở "Hình" trên thanh công cụ) |
| `?fixedres` | Tắt độ phân giải động (nấc medium/low tự hạ độ phân giải khi < 28 khung/s) |
| `?mode=ui` | Xem thử giao diện với kết quả thật của bộ máy (không ghi đè sổ đã lưu) |
| `?mode=debug` | Nhãn vật thể + bảng số liệu (F3) |
| `?mode=blockout` | Phòng khối xám (chặng 2) |
| `?mode=showroom&batch=furniture\|fixtures\|safety\|glassware\|apparatus\|reagents\|all` | Phòng trưng bày từng nhóm đồ |
| `?scene=dev` | Cảnh thử kit |

Phím: W A S D đi, kéo chuột nhìn, Q trả đồ, E xem nhãn, F5 điểm nhìn nhanh, F4 bay, F3 số liệu. Toàn bộ thao tác nằm trong nút **?** trên thanh công cụ.

## Kiến trúc

```
src/chem/          Bộ máy hóa học thuần TS (không three, không DOM) – xem src/chem/README.md
src/content/       chem.json (chất, độ tan, dãy hoạt động, thế điện cực, động học…), chem-text.json (lời giải thích)
src/lab/           Phòng 3D
  layout.ts          mặt bằng, toạ độ thật (1 đơn vị = 1 dm), điểm xuất phát, điểm nhìn
  room/              dựng phòng, bày đồ (population.ts), gộp mesh
  builders/          nội thất, thiết bị an toàn, dụng cụ (bọc kit, gắn ObjectMeta: bề mặt, ổ cắm, phần mở được, bình chứa)
  interact/          cầm – đặt – cắm ổ – trượt – mở cánh tủ – đẩy xe; móc InteractionHooks cho hóa học
  chem/core.ts       lõi hóa học của phòng (thuần, có test): nội dung bình, "dùng A lên B" = rót/nhỏ/xúc/thả, đun, động học, que đóm, dấu X, dẫn khí
  chem/scene.ts      nối lõi vào 3D: chất lỏng, bột, bọt, kết tủa, khí màu, âm, đèn cồn/Bunsen, nhiệt kế, đồng hồ, ống dẫn khí
  lighting.ts        đèn, bóng nắng bám người chơi, môi trường chụp từ chính phòng (PMREM), lọc bất đẳng hướng
  post.ts            hậu kỳ: AO (N8AO), bloom, tone mapping Neutral, SMAA; độ phân giải động
  lod.ts, optimize.ts  LOD 3 mức (nấc cao giữ bản chi tiết tới 20 dm), gộp draw call
  materials.ts, textures/   vật liệu; texture bề mặt tự sinh lặp liền (surface.ts); biển báo/poster/bảng tuần hoàn
  interact/placement.ts  quyết định đặt đồ thuần (decidePlace: ổ cắm, đường ngắm, vùng cấm, chỗ trống) – dùng cho cả thao tác và gợi ý
src/ui/            Giao diện DOM + Tailwind: thanh công cụ, màn hình bắt đầu, bảng kết quả, sổ thí nghiệm (lưu localStorage), thẻ chất, HUD
src/vendor/lab3d/  Kit 3D chép từ STEM SmartLab (đồ thủy tinh, chất lỏng, hiệu ứng, cử chỉ, âm thanh, hậu kỳ)
src/app/           Engine host thay cho SimHost React của kit
```

**Nguyên tắc:** 3D không bao giờ chọn hiện tượng theo tên cặp chất. Mọi hiệu ứng (bọt, kết tủa, đổi màu, khí màu, nóng lên) vẽ từ `ReactionResult.phenomena` và sự kiện động học của bộ máy.

### Kit `src/vendor/lab3d`

Chép từ `sach_dien_tu/Frontend/src/kit/lab3d` bằng `npm run sync-kit` (`scripts/sync-kit.sh`). Script này bỏ phần React, bỏ địa lý/lịch sử không dùng, và sửa `assets.ts` để âm thanh nạp từ `public/api/assets/lab3d/`. `react` được trỏ sang `src/vendor/react-shim.ts` (đủ cho các store zustand của kit). Không sửa tay trong `src/vendor/`: sửa ở repo gốc rồi chạy lại `sync-kit`.

## Thêm chất

1. Thêm chất vào `src/content/chem.json` → `species` (công thức, tên Việt/Anh, loại, pha, ion, độ mạnh, màu, nguy hiểm). Muối/bazơ mới cần ion đã có trong bảng tính tan. Kim loại cần có trong dãy hoạt động. Chất oxi hóa cần có trong bảng thế điện cực.
2. Viết lời giải thích mới (nếu có) vào `src/content/chem-text.json`.
3. Thêm ca vàng vào `tests/chem/`, chạy `npm test`.
4. Bày chai trong phòng: thêm vào `src/lab/room/population.ts`, vd. `{ species: 'KNO3', conc: 0.5 }` trong một hàng `row(...)`. Màu dung dịch tự lấy từ bộ máy.

## Hiệu năng (đo thật: Intel UHD 630, Chrome, 1600×900, 6 góc đối chiếu – `npm run shots`)

| Nấc | Khung/s | Ghi chú |
|---|---|---|
| high | 9–17 | đủ độ phân giải, AO đầy đủ, bóng 4096; dành cho card rời |
| medium (mặc định với GPU tích hợp) | 27–38 | độ phân giải tự hạ còn ×0,6–0,7 |
| low (390×844, cỡ điện thoại) | 60 | không bóng, không hậu kỳ |

Card tích hợp nghẽn ở số điểm ảnh phải tô (giảm nửa độ phân giải → khung hình ×2,5); thêm/bớt AO, khúc xạ kính chỉ đổi 2–3 khung/s.
Bộ máy hóa học mỗi bước, 6 ống đang sủi: 0,72 ms.

## Giới hạn đã biết

- Mới đo trên một máy (Intel UHD 630); chưa đo card rời và điện thoại thật (có nút ▲▼◀▶ và chạm/giữ cho cảm ứng).
- Lightmap chỉ có ánh sáng gián tiếp cho phần tĩnh; cánh tủ, ngăn kéo, đồ trên bàn không có lightmap (dùng AO màn hình). Lòng cửa gió trên trần hơi sáng hơn thật.
- Nấc medium/low: từ ≈ 9 dm bình dùng bản LOD xa (thấy màu dung dịch, không thấy bọt/kết tủa đang rơi); nấc high giữ bản chi tiết tới 20 dm.
- Lượng rót cố định theo bình nhận (ống nghiệm 2 mL, cốc nhỏ 10 mL, cốc lớn 25 mL); rót nhiều lần để thêm.
- Chưa có thu khí bằng đẩy nước, buret chuẩn độ, đồ thị theo thời gian, bể ổn nhiệt.
- Hữu cơ, điện hóa và Hóa 11/12 chưa có luật.

## Bản quyền âm thanh

Âm thanh trong `public/api/assets/lab3d/audio/` đều là CC0, nguồn ghi trong `ATTRIBUTION.md` cùng thư mục.
