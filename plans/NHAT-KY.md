# Nhật ký thực hiện

## Chặng 0

### Bước 0.2–0.3 — Sao chép kit
- Nguồn: `sach_dien_tu` commit `87342f4`. Kết quả: 493 file kit trong `src/vendor/lab3d` (3,0 MB), 169 âm thanh `lab/` + `ui/` trong `public/api/assets/lab3d/audio` (9 MB).
- **Lệch kế hoạch (có chủ đích):** không sửa `audio/settings.ts`. Ba file `audio/settings.ts`, `audio/voice/settings.ts`, `audio/voice/presence.ts` (và `audio/voice/pageNarrator.ts`) chỉ dùng `useSyncExternalStore` của React cho hook không được gọi; thay bằng shim `src/vendor/react-shim.ts` qua alias `react` (vite + tsconfig paths). Nhờ vậy `sync-kit` chạy lại không mất bản vá.
- File bị loại: mọi `.tsx`, `ui/useCollapse.ts`, `audio/useLabSound.ts`, `audio/voice/useStepNarration.ts`; thư mục `geo/` (giữ `geo/globe/coords.ts`), `petri/`, `history/` (giữ `walk.ts`, `post.ts`, `types.ts`).
- File bị vá trong vendor: `assets.ts`, `index.ts` (bỏ export SimHost), 3 dòng re-export trong `audio/index.ts`, `audio/voice/index.ts`, `ui/index.ts`.
- Adapter ngoài vendor: `src/data/contentApi.ts` (`apiAssetUrl` trả nguyên đường dẫn, vì `clips.ts` cần).
- `sync-kit` chạy hai lần cho cùng kết quả (so SHA-1). Typecheck 0 lỗi, build xanh.
