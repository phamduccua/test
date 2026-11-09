import { createLabPost } from '../vendor/lab3d/lab/room/labPost'
import type { SimContext } from '../vendor/lab3d/sim/types'

/**
 * Hậu kỳ của kit (createLabPost): bloom ngưỡng cao (đèn trần, cửa sổ, ngọn lửa), tone mapping Neutral, tương phản nhẹ, vignette,
 * khử răng cưa (high: MSAA 4×, medium: SMAA). 'low' → không hậu kỳ (kit trả null).
 * Không dùng hậu kỳ lịch sử (SSAO + ACES): ACES làm dung dịch ngả xám/tím, sai màu hóa chất.
 */
export function createRoomPost(ctx: SimContext) {
  return createLabPost(ctx, { bloom: 0.22, contrast: 0.06, vignette: 0.18, saturation: 0.03 })
}
