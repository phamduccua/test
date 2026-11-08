/** Nội suy song tuyến tính trên lưới đều (thuần). `grid[row][col]`; u ∈ [0, cols−1], v ∈ [0, rows−1]. */
export function bilinear(grid: readonly (readonly number[])[], u: number, v: number): number {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (!rows || !cols) return 0;
  const cu = Math.min(cols - 1, Math.max(0, u));
  const cv = Math.min(rows - 1, Math.max(0, v));
  const i = Math.min(cols - 2, Math.floor(cu));
  const j = Math.min(rows - 2, Math.floor(cv));
  if (cols === 1 || rows === 1) return grid[Math.round(cv)][Math.round(cu)];
  const fu = cu - i;
  const fv = cv - j;
  const a = grid[j][i] * (1 - fu) + grid[j][i + 1] * fu;
  const b = grid[j + 1][i] * (1 - fu) + grid[j + 1][i + 1] * fu;
  return a * (1 - fv) + b * fv;
}
