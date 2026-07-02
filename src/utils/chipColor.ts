/**
 * Chip color math for the §2.4 alpha-film formula (design-brief).
 *
 * One stored color per calendar/list (user data). Text/film derive at
 * runtime via CSS relative-color syntax; this module mirrors that math in
 * JS only to run the §9.3.3 contrast guard: if the derived chip text would
 * land under 4.5:1 on the film-over-canvas, the chip falls back to `--ink`
 * text over a 32% film (class `chip-guard` in calendar.css).
 *
 * Conversions ported from docs/design-research/color-math.mjs (no deps).
 */

const DEG = Math.PI / 180;

function gammaToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function linearToGamma(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

type Rgb = [number, number, number]; // gamma-encoded 0..1

function srgbToOklch(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const [lr, lg, lb] = [r, g, b].map(gammaToLinear);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l),
    m_ = Math.cbrt(m),
    s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.hypot(a, bb);
  let H = Math.atan2(bb, a) / DEG;
  if (H < 0) H += 360;
  return [L, C, H];
}

function oklchToRgb(L: number, C: number, H: number): Rgb {
  const a = C * Math.cos(H * DEG);
  const b = C * Math.sin(H * DEG);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  const lin: Rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((c) =>
    Math.min(1, Math.max(0, linearToGamma(Math.min(1, Math.max(0, c)))))
  ) as Rgb;
}

function relLum([r, g, b]: Rgb): number {
  const [R, G, B] = [r, g, b].map(gammaToLinear);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(c1: Rgb, c2: Rgb): number {
  const l1 = relLum(c1);
  const l2 = relLum(c2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Alpha-composite fg over bg in gamma space (matches browser color-mix use here). */
function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]) as Rgb;
}

/** Parse #rgb / #rrggbb / rgb(a). Returns null for anything else. */
export function parseColor(input: string | undefined | null): Rgb | null {
  if (!input) return null;
  const str = input.trim();
  const hex = str.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    if (hex.length === 3) {
      return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16) / 255) as Rgb;
    }
    return [0, 1, 2].map(
      (i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255
    ) as Rgb;
  }
  const rgb = str.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (rgb) return [+rgb[1] / 255, +rgb[2] / 255, +rgb[3] / 255] as Rgb;
  return null;
}

// Canvas colors per theme (index.css --background)
const CANVAS_LIGHT: Rgb = [0xfa / 255, 0xfb / 255, 0xfc / 255]; // #fafbfc
const CANVAS_DARK: Rgb = [0x0c / 255, 0x11 / 255, 0x12 / 255]; // #0c1112

const guardCache = new Map<string, boolean>();

/**
 * §9.3.3 runtime guard. True when the §2.4 derived text passes 4.5:1 on the
 * film-over-canvas; false → the chip needs the `chip-guard` fallback
 * (`--ink` text + 32% film). Unparseable colors fail safe (guard on).
 */
export function chipTextPasses(
  color: string,
  theme: 'light' | 'dark'
): boolean {
  const key = `${theme}|${color}`;
  const cached = guardCache.get(key);
  if (cached !== undefined) return cached;

  const rgb = parseColor(color);
  let ok = false;
  if (rgb) {
    const [, C, H] = srgbToOklch(...rgb);
    if (theme === 'dark') {
      // film 24% over canvas; text oklch(from c 0.82 min(c,0.1) h)
      const film = composite(rgb, 0.24, CANVAS_DARK);
      const text = oklchToRgb(0.82, Math.min(C, 0.1), H);
      ok = contrast(text, film) >= 4.5;
    } else {
      // film 12% over canvas; text oklch(from c 0.5 c h)
      const film = composite(rgb, 0.12, CANVAS_LIGHT);
      const text = oklchToRgb(0.5, C, H);
      ok = contrast(text, film) >= 4.5;
    }
  }
  guardCache.set(key, ok);
  return ok;
}
