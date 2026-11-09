import type { ChemLab } from './chem/scene'

/** Điều khiển phòng lab cho giao diện và bài học (phòng lab gán khi dựng xong; mặc định không làm gì). */
export const labApi: { resetView(): void; resetAll(): void; chem: ChemLab | null } = {
  resetView: () => {},
  resetAll: () => {},
  chem: null,
}
