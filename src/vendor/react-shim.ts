/**
 * Shim cho 'react': vài file .ts của kit lab3d và zustand (`create`) gắn hook React dựa trên useSyncExternalStore.
 * Trang này không dùng React nên các hook đó không bao giờ được gọi; store vẫn dùng được qua getState/setState/subscribe.
 */
export function useSyncExternalStore<T>(_subscribe: (cb: () => void) => () => void, getSnapshot: () => T, _getServerSnapshot?: () => T): T {
  return getSnapshot()
}
export function useCallback<T>(fn: T): T {
  return fn
}
export function useDebugValue(): void {}

export default { useSyncExternalStore, useCallback, useDebugValue }
