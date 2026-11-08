# Bộ máy hóa học (`src/chem`)

Trọng tài tổng quát cho phòng thí nghiệm: nhận "đổ B vào A trong điều kiện C", trả về có phản ứng hay không, phương trình đã cân bằng, hiện tượng, lời giải thích tiếng Việt, cảnh báo an toàn và hỗn hợp sau phản ứng. Thuần TypeScript, không phụ thuộc `three` hay DOM.

## Dùng

```ts
import { mix, addSolid, heat, step, describe, makeSolution, makeSolid, makeWater, makeGas } from '../chem'

const r = mix(makeSolution('HCl', 1, 20), makeSolution('Na2CO3', 0.5, 10))
r.happened          // true
r.equations[0].text // "2HCl + Na₂CO₃ → 2NaCl + CO₂↑ + H₂O"
r.phenomena         // [{ type: 'gas', species: 'CO2', intensity: … }]
r.explanationVi     // "Có phản ứng: sủi bọt khí CO₂."
describe(r.mixtureAfter) // { colorHex, opacity, turbidity, pH, indicatorState, colorSources, … } để vẽ 3D

mix(makeSolution('HCl', 1, 10), makeSolution('H2SO4', 1, 10)).reasonCode // 'SAME_CLASS_ACIDS'
mix(makeSolid('Cu', 1), makeSolution('H2SO4', 18, 10)).wouldHappenIf     // { heated: true, noteVi: 'Sẽ xảy ra nếu đun nóng.' }
step(mix(makeSolid('Zn', 1), makeSolution('HCl', 1, 50)).mixtureAfter, 0.1) // phản ứng xảy ra dần
```

| Hàm | Việc |
|---|---|
| `makeSolution(id, M, mL, indicator?)`, `makeSolid(id, g)`, `makeWater(mL, indicator?)`, `makeGas(id, mol)` | Tạo lượng chất. Hydrat như `CuSO4.5H2O` tính đúng khối lượng mol. |
| `mix(target, added, cond?)` | Đổ `added` vào `target`. Thứ tự có nghĩa (cảnh báo đổ nước vào axit đặc). |
| `addSolid(m, id, g, cond?)` | Cho chất rắn vào. |
| `heat(m, °C, cond?)` | Đun: nhiệt phân, axit đặc nóng, đuổi NH₃. |
| `step(m, giây)` | Tiến các phản ứng động học (kim loại + axit, đá vôi + axit, Na₂S₂O₃ + axit, H₂O₂). Truyền `dt` đã nhân tốc độ mô phỏng. |
| `describe(m)` | Ngoại hình cho 3D. |
| `parseAmount("HCl 1M 20ml +litmus")` | Cú pháp ngắn dùng cho CLI, test, kịch bản bài học. |

Điều kiện `cond`: `heated`, `temperatureC`, `catalyst`, `inFumeHood` (tính theo vị trí bình), `open` (bình hở).

## Mô hình

- **Mức phân tử.** Hỗn hợp lưu số mol từng chất (`solutes`, `solids`, `gases` đã thoát). Ion chỉ dùng để suy luận. Nhờ vậy phương trình ra đúng dạng phân tử như SGK.
- **Chất ghép tự động.** Ngoài ~66 chất khai báo trong `content/chem.json`, mọi cặp cation + anion trong bảng tạo được chất mới kèm tên Việt/Anh, tính tan, khối lượng mol (NaNO₃, CH₃COONa, Cr₂(SO₄)₃…).
- **Tự cân bằng.** Luật chỉ nêu chất tham gia và sản phẩm; hệ số tính bằng không gian nghiệm của ma trận nguyên tố (`util/balance.ts`). Phương trình nhiều nghiệm (KMnO₄ + H₂O₂) ghi hệ số trong JSON.
- **Luật theo thứ tự ưu tiên** (`rules/index.ts`): hòa tan → kim loại kiềm/oxit + nước → bảng oxi hóa – khử → axit – bazơ → kim loại + axit → kim loại + muối → halogen → trao đổi → nhiệt phân → H₂O₂. Mỗi luật trả *ứng viên* và *lý do không xảy ra*; không có ứng viên thì lý do cụ thể nhất được chọn.
- **Động học** dùng `kinetic` trong hỗn hợp; `mix()` chỉ khởi động, `step()` tiêu thụ.

## Thêm chất, thêm phản ứng

- Chất thường (muối, axit, bazơ): thường không cần làm gì, chỉ cần cation/anion có trong `cations`/`anions` của `chem.json`. Thêm ion mới: khai báo ion, dòng tính tan trong `solubility`, màu kết tủa trong `precipitateColors` nếu có.
- Chất đặc biệt (nồng độ "đặc", độc, màu, tên riêng): thêm vào `species`.
- Phản ứng oxi hóa – khử đặc thù: thêm vào `redoxReactions` (`reactants`, `products` kèm pha, `needsAcid`, `requires.concentrated/heated/solid`).
- Nhiệt phân: `decompositions` (`thresholdC`, `catalyst`, `uncatalyzedC`).
- Chữ tiếng Việt: `content/chem-text.json`.

## Kiểm thử

- `npm test`: 106 ca vàng (`tests/chem/golden.json`, gom từ SGK lớp 9 và Hóa 10) + 40 test đơn vị (công thức, dữ liệu, cân bằng, bảo toàn nguyên tố, trộn tăng dần, động học, nhiệt, an toàn, ngoại hình, ranh giới).
- Thêm ca vàng: một dòng JSON `{ id, a, b, then?, op, cond?, t?, expect }`; xem `tests/chem/runCase.ts` cho các khóa `expect`.
- CLI: `npm run chem -- mix "Cu 1g" "H2SO4 18M 10ml" --heated`, `npm run chem -- heat "KClO3 1g" 400`, `npm run chem -- list`.

## Giới hạn đã biết

- Cân bằng hóa học (FeSCN²⁺, CrO₄²⁻/Cr₂O₇²⁻) chưa mô phỏng hằng số K; FeCl₃ + KSCN coi như hoàn toàn.
- Muối axit (NaHSO₄, NaHCO₃ tạo dần khi thiếu axit) chưa tách nấc.
- Hữu cơ, điện phân, pin điện hóa: ngoài phạm vi.
