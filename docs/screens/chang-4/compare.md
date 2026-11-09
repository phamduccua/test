# Đối chiếu ảnh mẫu – chặng 4

Mỗi ảnh `compare-*.png`: trái là ảnh mẫu (`reference/images/`), phải là render của phòng (chất lượng `medium`, Chromium headless render phần mềm – trên GPU thật chất lượng `high` có MSAA 4× và bóng 2048).
Trong phòng, phím **F5** đi lần lượt qua các góc này (sau 7 điểm nhìn chung).

| Góc | Ảnh mẫu | File |
|---|---|---|
| Từ bàn giáo viên nhìn ra cửa sổ | `e816f2890e` | `compare-front-bench.png` |
| Tường giảng dạy | `f8f3a946db` | `compare-teaching-wall.png` |
| Trạm an toàn | `0be195b3ab` | `compare-safety.png` |
| Tủ hút và tủ chất dễ cháy | `a981ac60a3` | `compare-fume.png` |
| Bộ chuẩn độ | `2f60ff79ae` | `compare-titration.png` |
| Bộ đun nóng | `694a567207` | `compare-heating.png` |

Khác biệt còn lại (có chủ ý hoặc để sau):
- Ảnh mẫu render offline (bake ánh sáng, AO); phòng ta ánh sáng thời gian thực, không AO.
- Vị trí tủ hút khác ảnh mẫu (chờ người điều phối quyết, xem NHAT-KY chặng 2).
- Ảnh mẫu dùng mô hình phân tử, sách, bình hút ẩm trang trí – chưa có (không cần cho thí nghiệm).
