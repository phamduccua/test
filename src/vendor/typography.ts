/** Read the global CSS font for APIs such as canvas that cannot resolve var(). */
export function getWebFontFamily(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
}

/** Build a canvas/FontFaceSet font while preserving the caller's size and weight. */
export function webFont(px: number, bold = false): string {
  return `${bold ? 'bold ' : ''}${px}px ${getWebFontFamily()}`
}
