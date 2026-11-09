> **ĐÃ XONG (2026-11-09).** **Phần bài học (JSON, thanh bước, Tự động) đã bỏ theo yêu cầu: phòng là thí nghiệm tự do.** Kết quả và các lệch kế hoạch ghi trong `plans/NHAT-KY.md` mục Chặng 8; ảnh trong `docs/screens/chang-8/`. Phần dưới giữ để tham khảo.

# Chặng 8 — Bài học JSON, tiến độ, âm thanh, hiệu năng, build tĩnh, bàn giao

Đọc trước: `plans/00-tong-quan.md`. Chặng 7 đã xong.

## Mục tiêu
Bốn bài học của riêng dự án (JSON), mỗi bài có thanh bước "Các bước thực nghiệm" với Tự động của kit nhưng vẫn cho tự do khám phá; lưu tiến độ; hoàn thiện âm thanh, hiệu năng, cảm ứng; build tĩnh để triển khai; tài liệu bàn giao.
Bàn giao: `npm run build` ra `dist/` chạy được bằng `npm run preview`; 4 bài làm trọn bằng tay và bằng Tự động; README.

## Bối cảnh cần đọc
`vendor/lab3d/interact/procedure.ts`, `procedureTypes.ts` (`ProcedureStep { id, title, caption, hint, enter?, action?, done?, skip? }`), `procedureVoice.ts`, `progressEvent.ts`; mẫu `sach_dien_tu/Frontend/src/features/hoa10/b22/s01-dung-dich-hcl-tac/interact.ts` (chỉ đọc).

## Thiết kế

### Bài học (`src/lessons/*.json`, kiểu `src/lab/lessons/types.ts`)
```ts
interface Lesson { id: string; title: string; grade: 10; objectives: string[]; steps: LessonStep[]; freeExplore: true }
interface LessonStep { id: string; title: string; caption: string; hint?: { object: string } ; done: Condition; auto?: Action[] }
type Condition = { type: 'reaction'; a: string; b: string; happened: boolean } | { type: 'measured'; key: string } | { type: 'placed'; item: string; zone: string } | { type: 'wearing'; item: 'goggles' } | { type: 'inHood'; item: string } | { type: 'crossHidden'; vessel: string } | { type: 'any'; of: Condition[] }
type Action = { type: 'carry'; item: string; zone: string } | { type: 'pour'; from: string; to: string; ml: number } | { type: 'knob'; item: string; value: number } | { type: 'wait'; s: number }
```
`src/lab/lessons/runner.ts` dịch `Lesson` → `createProcedure` của kit: `done` kiểm bằng sự kiện `apply`/`store`; `auto` chạy bằng `hand.carryTo`, `grab.carryTo`, `tiltPour.auto`, `knob.set`.

| Bài | Bước chính (≥ 6 bước, ≥ 1 bước "không phản ứng") |
|---|---|
| `lam-quen` | đeo kính; tìm trạm an toàn; mở sash tủ hút; lấy một lọ về bàn; soi nhãn; ghi sổ |
| `hcl-va-halide` | Zn + HCl; Cu + HCl (không); HCl + NaHCO₃ → CO₂ nước vôi; AgNO₃ vào NaCl/NaBr/KI/NaF; kết luận |
| `oxi-hoa-khu` | Fe đinh + CuSO₄; Cu + AgNO₃; Cu + FeSO₄ (không); KMnO₄ + FeSO₄ + H₂SO₄; Cu + HNO₃ loãng trong tủ hút; xác định chất oxi hóa/khử |
| `toc-do-phan-ung` | Zn + HCl 0,5 M và 2 M (đồ thị H₂); Na₂S₂O₃ + HCl phòng và ấm (dấu X); H₂O₂ ± MnO₂; đá vôi mảnh/bột; kết luận 4 yếu tố |
| `halogen` | nước clo + NaBr, + KI (hồ tinh bột); nước brom + KI; nước brom + NaCl (không); giấy màu ẩm vào Cl₂ trong tủ hút; dãy tính oxi hóa |

### Tiến độ (`src/lab/progress.ts`)
`localStorage['freelab:<lessonId>']`: bước xong, sổ (≤ 200 dòng), cài đặt điều khiển; "Làm lại từ đầu" → `apply.reset()` + xóa tiến độ bài. `emitLabProgress` của kit vẫn phát (không ai nghe cũng được).

### Âm, hiệu năng, cảm ứng
Nền `lab/lab-ambience` + `room-tone`; thuyết minh bước `createProcedureVoice` tôn trọng loa. Ngân sách: draw calls ≤ 600, tam giác ≤ 900 000, GPU ổn định khi đổi bài 10 lần. `low`: không hậu kỳ/bóng, hạt giảm 50 %. Cảm ứng kiểm DevTools + điện thoại thật.

## Các bước
### 8.1 Khung bài học — `lessons/types.ts`, `runner.ts`; `createFreeLab(ctx, { lesson })`; màn hình bắt đầu liệt kê bài từ JSON.
### 8.2 Nội dung 5 bài — 5 file JSON (nội dung tiếng Việt), chạy trọn bằng tay và Tự động.
### 8.3 Tiến độ và Làm lại từ đầu.
### 8.4 Âm và thuyết minh.
### 8.5 Hiệu năng, cảm ứng, nấc low — số liệu vào NHAT-KY.
### 8.6 Build tĩnh và bàn giao — `npm run build`, `npm run preview`; `README.md` gốc repo: kiến trúc (`src/chem`, `src/lab`, `src/vendor/lab3d` + cách `sync-kit`), cách thêm chất (`content/chem.json`), cách thêm bài (JSON), cờ `?mode=`, `?q=`, ngân sách, giới hạn đã biết, giấy phép âm thanh CC0 (`ATTRIBUTION.md` đã chép); commit cuối, tag `v0.1`.

## Tiêu chí nghiệm thu
- [ ] 5 bài chạy trọn; mỗi bài có bước "không phản ứng" hiện đúng lý do.
- [ ] `build` + `preview` chạy; `typecheck`, `test` xanh.
- [ ] README đầy đủ; giáo viên làm thử và duyệt lời giải thích của trọng tài.

## Mở rộng để sau
Hóa 11/12 (chỉ thêm dữ liệu + bài), điện hóa, hữu cơ (bộ luật nhóm chức), khóa con trỏ tùy chọn, bake ánh sáng, trang giáo viên xem sổ nhiều học sinh.
