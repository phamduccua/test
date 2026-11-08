/**
 * The page may read the step captions aloud itself (a UI theme with its own narrator marks `html[data-step-narrator="page"]`).
 * The kit voice then stays silent and hides its toggle, so a step is never said twice.
 */
import { useSyncExternalStore } from 'react';

export const pageNarrates = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.dataset.stepNarrator === 'page';

export function onPageNarrator(cb: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => {};
  const watch = new MutationObserver(cb);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-step-narrator'] });
  return () => watch.disconnect();
}

export const usePageNarrates = (): boolean => useSyncExternalStore(onPageNarrator, pageNarrates, () => false);
