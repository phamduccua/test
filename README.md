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
```

`dist/` là trang tĩnh, đặt ở gốc tên miền vì âm thanh nạp từ `/api/assets/lab3d/audio/`.

### Cờ trên URL

| Cờ | Ý nghĩa |
|---|---|
| `?q=low\|medium\|high` | Chất lượng hình (mặc định tự đoán; low: không bóng, không hậu kỳ) |
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
  lighting.ts, post.ts, lod.ts, optimize.ts, textures/   ánh sáng, hậu kỳ, LOD 3 mức, gộp draw call, biển báo/poster/bảng tuần hoàn
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

## Ngân sách hiệu năng (đo headless SwiftShader, nấc low)

| | Đo được | Mục tiêu |
|---|---|---|
| Draw call (giữa phòng / sát bàn) | 607 / 260 | ≤ 600 điển hình |
| Tam giác | 634 nghìn | ≤ 900 nghìn |
| Bộ máy hóa học mỗi bước, 6 ống đang sủi | 0,72 ms | < 2 ms |

## Giới hạn đã biết

- Chưa đo FPS trên GPU thật ở 3 nấc chất lượng; chưa thử trên điện thoại thật (có nút ▲▼◀▶ và chạm/giữ cho cảm ứng).
- Ở khoảng cách đứng cạnh bàn (≈ 9 dm), bình dùng bản LOD xa: thấy màu dung dịch nhưng không thấy bọt/kết tủa đang rơi. Cầm bình lên để xem rõ.
- Lượng rót cố định theo bình nhận (ống nghiệm 2 mL, cốc nhỏ 10 mL, cốc lớn 25 mL); rót nhiều lần để thêm.
- Chưa có thu khí bằng đẩy nước, buret chuẩn độ, đồ thị theo thời gian, bể ổn nhiệt.
- Hữu cơ, điện hóa và Hóa 11/12 chưa có luật.

## Bản quyền âm thanh

Âm thanh trong `public/api/assets/lab3d/audio/` đều là CC0, nguồn ghi trong `ATTRIBUTION.md` cùng thư mục.
