import type { Pose } from './layout'

/** Tư thế nhìn từ điểm `from` (dm) tới điểm `to`. */
export function lookAtPose(from: [number, number, number], to: [number, number, number]): Pose {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const yawDeg = (Math.atan2(dx, dz) * 180) / Math.PI
  const pitchDeg = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI
  return { x: from[0], y: from[1], z: from[2], yawDeg, pitchDeg }
}

/** Sáu góc máy đối chiếu ảnh mẫu trong reference/images (hậu tố tên file). */
export const COMPARE_VIEWS: { id: string; label: string; reference: string; pose: Pose }[] = [
  { id: 'front-bench', label: 'Từ bàn giáo viên nhìn ra cửa sổ', reference: 'e816f2890e', pose: lookAtPose([0, 17, -40], [0, 9, 10]) },
  { id: 'teaching-wall', label: 'Tường giảng dạy', reference: 'f8f3a946db', pose: lookAtPose([-36, 17, 30], [12, 12, -42]) },
  { id: 'safety', label: 'Trạm an toàn', reference: '0be195b3ab', pose: lookAtPose([-24, 16, 8], [-48, 12, -14]) },
  { id: 'fume', label: 'Tủ hút và tủ chất dễ cháy', reference: 'a981ac60a3', pose: lookAtPose([22, 16, -6], [48, 13, -24]) },
  { id: 'titration', label: 'Bộ chuẩn độ', reference: '2f60ff79ae', pose: lookAtPose([-4, 14, 6], [-10, 11, 13]) },
  { id: 'heating', label: 'Bộ đun nóng', reference: '694a567207', pose: lookAtPose([0.5, 13.5, -26.5], [-5, 10, -32.3]) },
]
