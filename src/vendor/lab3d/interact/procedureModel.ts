/**
 * Trạng thái quy trình theo bước (thuần, không three/DOM): bước hiện tại, lịch sử để hoàn tác, đếm thao tác sai.
 * Bước chỉ hoàn thành khi đúng id bước hiện tại (thao tác thật hoặc demo báo về).
 */
export interface ProcedureModel {
  readonly index: number;
  readonly current: string | null;
  readonly finished: boolean;
  readonly mistakes: number;
  readonly done: readonly string[];
  /** Báo bước `id` xong: true nếu đó là bước hiện tại (đã chuyển bước). */
  complete(id: string): boolean;
  /** Bước `id` đã xong chưa. */
  isDone(id: string): boolean;
  mistake(): number;
  /** Lùi một bước, trả id bước bị hoàn tác (null = đang ở đầu). */
  undo(): string | null;
  reset(): void;
}

export function createProcedureModel(ids: readonly string[]): ProcedureModel {
  let index = 0;
  let mistakes = 0;
  return {
    get index() {
      return index;
    },
    get current() {
      return ids[index] ?? null;
    },
    get finished() {
      return index >= ids.length;
    },
    get mistakes() {
      return mistakes;
    },
    get done() {
      return ids.slice(0, index);
    },
    complete(id) {
      if (ids[index] !== id) return false;
      index++;
      return true;
    },
    isDone: (id) => ids.indexOf(id) >= 0 && ids.indexOf(id) < index,
    mistake: () => ++mistakes,
    undo() {
      if (index === 0) return null;
      index--;
      return ids[index];
    },
    reset() {
      index = 0;
      mistakes = 0;
    },
  };
}
