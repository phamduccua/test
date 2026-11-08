#!/usr/bin/env bash
# Sao chép kit lab3d của STEM SmartLab vào src/vendor/lab3d (idempotent).
# Quyết định (chặng 0):
#  - Bỏ geo/, petri/ (Địa lí, vi sinh) trừ geo/globe/coords.ts (interact/globePick.ts cần).
#  - Bỏ history/ trừ walk.ts (mẫu đi bộ), post.ts (hậu kỳ SSAO), types.ts.
#  - Xóa file React (.tsx, hook) – trang này không dùng React; các file .ts còn lại chỉ import
#    `useSyncExternalStore` thì được phục vụ bởi shim src/vendor/react-shim.ts (alias 'react').
#  - Vá: assets.ts (âm thanh do Vite phục vụ từ public/), re-export của file đã xóa trong các index.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${KIT_SRC:-../sach_dien_tu/Frontend/src}"
AUDIO="${KIT_AUDIO:-../sach_dien_tu/Backend/src/main/resources/static/api/assets/lab3d/audio}"
DST=src/vendor/lab3d
[ -d "$SRC/kit/lab3d" ] || { echo "Không thấy $SRC/kit/lab3d" >&2; exit 1; }

rsync -a --delete \
  --exclude '/geo/' --exclude '/petri/' --exclude '/history/' \
  --exclude '*.tsx' \
  --exclude '/ui/useCollapse.ts' \
  --exclude '/audio/useLabSound.ts' \
  --exclude '/audio/voice/useStepNarration.ts' \
  "$SRC/kit/lab3d/" "$DST/"
mkdir -p "$DST/geo/globe" "$DST/history"
cp "$SRC/kit/lab3d/geo/globe/coords.ts" "$DST/geo/globe/coords.ts"
for f in walk.ts post.ts types.ts; do cp "$SRC/kit/lab3d/history/$f" "$DST/history/$f"; done
cp "$SRC/kit/typography.ts" src/vendor/typography.ts
mkdir -p src/content
cp "$SRC/content/lab3d.json" src/content/lab3d.json

# Vá điểm nối ra ngoài kit
cat > "$DST/assets.ts" <<'TS'
/** Tài sản của kit (âm thanh) do Vite phục vụ từ public/api/assets/lab3d/. */
export const assetBase = () => '/api/assets/lab3d/';
TS
cat > "$DST/index.ts" <<'TS'
// Kit lab3d (sao chép từ STEM SmartLab). Bản gốc export SimHost (React) – trang này dùng src/app/host.ts.
export type { SimModule } from './sim/types'
export { createScope, type SimScope } from './sim/scope'
export type { StageKind } from './engine/stages/types'
export * from './ui/index'
TS

# Gỡ re-export tới file đã xóa
sed -i -E '/useLabSound/d' "$DST/audio/index.ts"
sed -i -E '/useStepNarration|VoiceToggle/d' "$DST/audio/voice/index.ts"
sed -i -E "/useCollapse|from '\.\/Icon'/d" "$DST/ui/index.ts"

# Âm thanh CC0: chỉ lab/ và ui/
mkdir -p public/api/assets/lab3d/audio
rsync -a --delete "$AUDIO/lab/" public/api/assets/lab3d/audio/lab/
rsync -a --delete "$AUDIO/ui/" public/api/assets/lab3d/audio/ui/
cp "$AUDIO/ATTRIBUTION.md" public/api/assets/lab3d/audio/ATTRIBUTION.md
node -e '
const fs=require("fs");const p=process.argv[1];const m=JSON.parse(fs.readFileSync(p+"/manifest.json","utf8"));
m.sounds=m.sounds.filter(s=>/^(lab|ui)\//.test(s.file));
fs.writeFileSync(process.argv[2],JSON.stringify(m,null,1)+"\n");
' "$AUDIO" public/api/assets/lab3d/audio/manifest.json
echo "sync-kit: xong ($(find "$DST" -type f | wc -l) file kit, $(node -e 'console.log(require("./public/api/assets/lab3d/audio/manifest.json").sounds.length)') âm thanh)"
