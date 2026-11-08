/**
 * Shim cho 'react': vài file .ts của kit lab3d export hook `useXxx` dựa trên useSyncExternalStore.
 * Trang này không dùng React nên các hook đó không bao giờ được gọi; shim chỉ để module nạp được.
 */
export function useSyncExternalStore<T>(_subscribe: (cb: () => void) => () => void, getSnapshot: () => T, _getServerSnapshot?: () => T): T {
  return getSnapshot()
}
