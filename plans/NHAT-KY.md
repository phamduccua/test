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
