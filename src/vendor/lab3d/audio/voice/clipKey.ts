/**
 * Key of a pre-generated voice clip: the first 16 hex chars of SHA-256 over the UTF-8 bytes of the NFC text (the same
 * rule as the clip generator). Web Crypto when the page has it; plain http (e.g. a school LAN server) has no
 * `crypto.subtle`, so a small pure SHA-256 takes over there. Results are cached per text.
 */
const keys = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** First 32 bits of the fractional parts of the `root`-th roots of the first `count` primes (SHA-256 constants). */
function primeRoots(count: number, root: number): Uint32Array {
  const out = new Uint32Array(count);
  for (let p = 2, n = 0; n < count; p++) {
    let prime = true;
    for (let d = 2; d * d <= p; d++) if (p % d === 0) prime = false;
    if (prime) out[n++] = ((p ** (1 / root) % 1) * 2 ** 32) >>> 0;
  }
  return out;
}

const K = primeRoots(64, 3);
const H0 = primeRoots(8, 2);

/** Pure SHA-256 (fallback when Web Crypto is missing). */
export function sha256(data: Uint8Array): Uint8Array {
  const h = H0.slice();
  const n = (((data.length + 9 + 63) >> 6) << 6) >>> 0;
  const buf = new Uint8Array(n);
  buf.set(data);
  buf[data.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(n - 8, Math.floor(data.length / 0x20000000));
  view.setUint32(n - 4, (data.length * 8) >>> 0);
  const w = new Uint32Array(64);
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      w[i] = (w[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + w[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) | 0;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, k].forEach((v, i) => (h[i] = (h[i] + v) | 0));
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  h.forEach((v, i) => ov.setUint32(i * 4, v));
  return out;
}

const hex16 = (bytes: Uint8Array) => Array.from(bytes.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');

async function digest(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.normalize('NFC'));
  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (subtle) {
    try {
      return hex16(new Uint8Array(await subtle.digest('SHA-256', data)));
    } catch {
      /* fall through to the pure hash */
    }
  }
  return hex16(sha256(data));
}

/** Clip key of one spoken part (cached). */
export function clipKey(part: string): Promise<string> {
  const known = keys.get(part);
  if (known) return Promise.resolve(known);
  let p = pending.get(part);
  if (!p) {
    p = digest(part).then((k) => {
      keys.set(part, k);
      pending.delete(part);
      return k;
    });
    pending.set(part, p);
  }
  return p;
}

/** The key when it has been computed already (sync callers such as `durationMs`). */
export const knownClipKey = (part: string): string | undefined => keys.get(part);
