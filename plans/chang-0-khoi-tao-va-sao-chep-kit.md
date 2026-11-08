> **ĐÃ XONG (2026-11-08).** Kết quả và các lệch kế hoạch ghi trong `plans/NHAT-KY.md` mục Chặng 0. Phần dưới giữ để tham khảo.

# Chặng 0 — Khởi tạo dự án + sao chép kit + host chạy được

Đọc trước: `plans/00-tong-quan.md`.

## Mục tiêu
Repo `test/` thành dự án Vite + TS + Tailwind chạy được, kit `lab3d` sao chép vào `src/vendor/lab3d` và **typecheck xanh**, có `host.ts` dựng `Engine` + `SimContext` bằng chính mã kit, một cảnh thử hiện cốc 250 mL của kit, xoay được, phát được một âm.

Nguồn kit: `/home/anhvt/GIA_SU/a/local/sach_dien_tu/Frontend/src/kit/lab3d` (gọi là `KIT`), `…/Frontend/src/kit/typography.ts`, `…/Frontend/src/content/lab3d.json`, âm thanh `…/Backend/src/main/resources/static/api/assets/lab3d/audio/`.

## Bối cảnh cần đọc
| File (trong KIT) | Vì sao |
|---|---|
| `engine/Engine.ts` | `new Engine(host)`, `prepareStage('lab')`, cách gắn `Stage` (đọc hàm `setStage`/tương đương), `playing`, `speed`, `setQualityPref` |
| `sim/createContext.ts` | `createSimSession(engine, guiContainer, 'lab')` → `{ ctx, stage, attach(sim), view(), dispose() }` |
| `sim/SimHost.tsx` | **Trình tự** SimHost làm (tạo Engine, session, `await module.create(ctx)`, `attach`, gắn stage vào engine, dọn khi đổi sim) – chép lại bằng TS thuần trong `host.ts` |
| `sim/simStore.ts`, `sim/hudStore.ts` | zustand store cho caption/warning/hud – toolbar riêng `subscribe` vào đây |
| `audio/context.ts`, `audio/settings.ts`, `audio/presence.ts` | mở khóa AudioContext sau cử chỉ, nút loa |
| `assets.ts`, `text.ts` | 2 điểm nối ra ngoài kit |
| `engine/labels.ts`, `engine/labels.css`, `sim/*.css`, `ui/tokens.css`, `interact/interact.css` | CSS kit phải được import |

## Các bước

### Bước 0.1 — Khởi tạo dự án
1. `npm init -y`; cài `three@0.186 postprocessing@6.39 lil-gui@0.21 zustand@5` (dependencies) và `@types/three@0.186 vite vitest typescript tsx tailwindcss @tailwindcss/vite` (dev). Phiên bản chính xác lấy từ `sach_dien_tu/Frontend/package.json`.
2. `tsconfig.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution bundler`, `resolveJsonModule`, `noUnusedLocals false` (kit có biến chưa dùng), `skipLibCheck`, `types: ["vite/client"]`, `include: ["src"]`.
3. `vite.config.ts`: plugin `tailwindcss()`. `src/app/styles/app.css`: `@import "tailwindcss";` + `@theme {}` rỗng + import CSS của kit (liệt kê ở 0.3).
4. Scripts: `dev`, `build`, `preview`, `typecheck`, `test` (`vitest run`), `chem` (`tsx scripts/chem-cli.ts`, chặng 1), `sync-kit` (`bash scripts/sync-kit.sh`).
5. `git mv` 11 ảnh `.webp` vào `reference/images/`. Tạo `plans/NHAT-KY.md`. `.gitignore` chuẩn Node.
**Kiểm tra:** `npm run dev` mở trang placeholder có lớp Tailwind; `npm run build` ra `dist/`.

### Bước 0.2 — Script sao chép kit
**Tạo:** `scripts/sync-kit.sh` (idempotent):
```
SRC=../sach_dien_tu/Frontend/src
rsync -a --delete $SRC/kit/lab3d/ src/vendor/lab3d/ \
  --exclude geo --exclude petri --exclude 'history/**' --include 'history/post.ts' --include 'history/walk.ts' --include 'history/index.ts'   # giữ post.ts + walk.ts (mẫu)
cp $SRC/kit/typography.ts src/vendor/typography.ts
cp $SRC/content/lab3d.json src/content/lab3d.json
cp $SRC/content/history-ui.json src/content/history-ui.json   # chỉ nếu history/*.ts giữ lại còn import
# xóa file React
rm -f src/vendor/lab3d/sim/{SimHost,SimIntro,SimTitle,SimWarning,SoundControl,SimToolbar,SimOverlay,Hud}.tsx \
      src/vendor/lab3d/audio/useLabSound.ts src/vendor/lab3d/audio/voice/{VoiceToggle.tsx,useStepNarration.ts,pageNarrator.ts} \
      src/vendor/lab3d/ui/useCollapse.ts
# âm thanh
mkdir -p public/api/assets/lab3d/audio && rsync -a $SRC/../../Backend/src/main/resources/static/api/assets/lab3d/audio/{lab,ui,manifest.json,ATTRIBUTION.md} public/api/assets/lab3d/audio/
# vá assets.ts
cat > src/vendor/lab3d/assets.ts <<'TS'
/** Tài sản của kit (âm thanh) do Vite phục vụ từ public/. */
export const assetBase = () => '/api/assets/lab3d/';
TS
```
Điều chỉnh danh sách exclude/rm sau khi chạy typecheck ở 0.3 (file nào kéo theo `react`, `d3-geo`, `topojson`, `jspdf`, `geojson` thì xóa hoặc loại). Ghi quyết định cuối vào đầu script.
**Kiểm tra:** chạy 2 lần cho cùng kết quả; `git status` chỉ thấy `src/vendor`, `src/content`, `public`.

### Bước 0.3 — Làm kit typecheck xanh
**Việc:** `npm run typecheck`; xử lý lỗi theo thứ tự: (a) file còn import `react`/thư viện không cài → xóa file đó và các file chỉ phục vụ nó (ví dụ `audio/settings.ts` có hook React: tách phần React ra bằng cách xóa hàm `useAudioSettings`, giữ `getAudioSettings/setAudioSettings/onAudioSettings` – đây là sửa duy nhất được phép ngoài assets.ts, ghi vào NHAT-KY); (b) import `../../content/history-ui.json` trong `history/*` → giữ file JSON; (c) `lab/index.ts` export tới thư mục đã xóa → không nên xảy ra vì chỉ xóa `geo`, `petri`; nếu có thì sửa dòng export đó và ghi NHAT-KY. Import CSS của kit vào `app.css`: `vendor/lab3d/ui/tokens.css`, `ui/chip.css`, `sim/SimHost.css`, `sim/SimGui.css`, `sim/SimTheme.css`, `engine/labels.css`, `interact/interact.css`, và mọi `.css` khác mà file `.ts` còn lại import (grep `import '.*\.css'`).
Lọc `manifest.json` chỉ giữ `sounds` có `file` bắt đầu `lab/` hoặc `ui/`.
**Kiểm tra:** `npm run typecheck` xanh; `npm run build` xanh; kích thước bundle ghi NHAT-KY.

### Bước 0.4 — Host: Engine + SimContext + cảnh thử
**Tạo:** `src/app/main.ts`, `src/app/host.ts`, `src/app/devScene.ts`, `index.html` (khung: `#viewport` full màn hình, `#gui` góc phải cho lil-gui, `#toolbar` trên cùng tạm).
`host.ts`: `createHost(viewport, guiHost)` → `engine = new Engine(viewport)`; `session = createSimSession(engine, guiHost, 'lab')`; `run(module: SimModule)`: `const sim = await module.create(session.ctx); session.attach(sim); <gắn stage vào engine như SimHost làm>`; `dispose()`. Mở khóa âm thanh theo cử chỉ như kit (xem `audio/context.ts`, hàm cho phép khi pointerdown/keydown).
`devScene.ts`: `SimModule` dùng `createLabStage(ctx, { lighting: 'bench' })` + `createBeaker(ctx, 250)` + `createLiquid` 100 mL xanh + `ctx.audio.sfx('lab/glass-put')` khi bấm cốc qua `pointerHub` `onTap`.
**Kiểm tra:** cốc kính có phản chiếu, xoay bằng OrbitControls, bấm cốc nghe tiếng, lil-gui "Tham số" hiện, caption hiện khi gọi `ctx.caption`.

### Bước 0.5 — Nghiệm thu
Ảnh `docs/screens/chang-0/dev-scene.png`; NHAT-KY ghi: phiên bản gói, file kit đã xóa/sửa, kích thước bundle.

## Tiêu chí nghiệm thu
- [ ] `sync-kit.sh` chạy lặp được; `typecheck`, `build` xanh.
- [ ] Cảnh thử: cốc kit + chất lỏng + âm + lil-gui + caption.
- [ ] Không file nào trong `src/vendor` bị sửa ngoài `assets.ts`, `audio/settings.ts` (nếu cần) và danh sách xóa.

## Lỗi thường gặp
- Quên import CSS kit → tooltip/thanh bước/nhãn không hiển thị đúng.
- `Engine` tạo canvas trong `host` và tự `setAnimationLoop`; đừng tạo renderer thứ hai.
- AudioContext chỉ mở sau cử chỉ người dùng; kit đã xử lý, chỉ cần gọi hàm cho phép của `audio/context.ts` ở sự kiện đầu.
- `labText` ném `MISSING_TEXT` nếu `lab3d.json` không được chép đúng.

## Bàn giao cho chặng 1
Chặng 1 (hóa học) không cần kit; chỉ cần vitest và `tsx` đã cài.
