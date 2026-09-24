/**
 * Shared tokens and helpers for the profile's datasheet-style SVGs.
 * Every generator draws from these so ink, rules, type, and number
 * formatting stay identical across the header, pills, and activity cards.
 */

/** Font stack matching GitHub's own page text, so SVG text sits beside it cleanly. */
export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";

/** Color tokens per GitHub theme. `trace` is the only hue and is reserved for plotted data. */
export const INK = {
  light: {
    ink: '#1f2328',
    muted: '#59636e',
    rule: '#d1d9e0',
    trace: '#b7410e',
    danger: '#d1242f',
  },
  dark: {
    ink: '#e6edf3',
    muted: '#9198a1',
    rule: '#3d444d',
    trace: '#e8704a',
    danger: '#f85149',
  },
};

/**
 * Returns the token set for a theme.
 * @param {boolean} dark
 */
export function tokens(dark)
{
  return dark ? INK.dark : INK.light;
}

/**
 * Escapes text for use in XML content or attribute values.
 * @param {unknown} s
 * @returns {string}
 */
export function escapeXml(s)
{
  return String(s).replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

/**
 * Formats a count the same way everywhere: grouped digits below 10,000, then 12.3k and 1.2M.
 * @param {number} n
 * @returns {string}
 */
export function fmtNum(n)
{
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString('en-US');
}

/**
 * Picks the singular or plural form of a word for a count.
 * @param {number} n
 * @param {string} one
 * @param {string} [many]
 * @returns {string}
 */
export function plural(n, one, many = one + 's')
{
  return n === 1 ? one : many;
}

const ADVANCE_11 = {
  ' ': 3.1, '!': 3.7, '"': 4.7, '#': 7.0, '$': 6.2, '%': 9.6, '&': 7.6, "'": 2.6,
  '(': 3.7, ')': 3.7, '*': 5.5, '+': 6.5, ',': 3.1, '-': 3.7, '.': 3.1, '/': 4.2,
  '0': 6.2, '1': 6.2, '2': 6.2, '3': 6.2, '4': 6.2, '5': 6.2, '6': 6.2, '7': 6.2,
  '8': 6.2, '9': 6.2, ':': 3.1, ';': 3.1, '<': 6.5, '=': 6.5, '>': 6.5, '?': 5.2,
  '@': 10.5,
  A: 7.0, B: 6.9, C: 7.2, D: 7.8, E: 6.3, F: 6.0, G: 7.9, H: 7.9, I: 2.9, J: 3.2,
  K: 6.7, L: 5.7, M: 9.3, N: 7.9, O: 8.2, P: 6.7, Q: 8.2, R: 7.1, S: 6.4, T: 6.2,
  U: 7.7, V: 6.8, W: 10.2, X: 6.6, Y: 6.2, Z: 6.7,
  '[': 3.7, '\\': 4.2, ']': 3.7, '^': 6.5, _: 5.5, '`': 5.5,
  a: 5.7, b: 6.2, c: 5.2, d: 6.2, e: 5.9, f: 3.6, g: 6.2, h: 6.2, i: 2.6, j: 2.6,
  k: 5.6, l: 2.6, m: 9.5, n: 6.2, o: 6.2, p: 6.2, q: 6.2, r: 4.1, s: 5.0, t: 3.8,
  u: 6.2, v: 5.6, w: 8.2, x: 5.6, y: 5.6, z: 5.0,
  '{': 6.5, '|': 2.9, '}': 6.5, '~': 6.5,
};

/**
 * Estimates rendered text width in px. Calibrated on Segoe UI and padded so the
 * wider San Francisco and Noto faces still fit inside the same box.
 * @param {string} s
 * @param {number} [size]
 * @param {number} [weight]
 * @returns {number}
 */
export function textWidth(s, size = 11, weight = 400)
{
  let w = 0;
  for (const c of s) w += ADVANCE_11[c] ?? 6.2;
  const boldFactor = weight >= 600 ? 1.06 : 1;
  return Math.ceil(w * (size / 11) * boldFactor * 1.08);
}
