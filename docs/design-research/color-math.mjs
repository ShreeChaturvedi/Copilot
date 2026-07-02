// OKLCH <-> sRGB + WCAG contrast validator for the aqua re-base.
// No deps. Run: node color-math.mjs

const D = Math.PI / 180;
function oklchToOklab(L, C, H) { return [L, C * Math.cos(H * D), C * Math.sin(H * D)]; }
function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
function linearToGamma(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; }
function gammaToLinear(c) { return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function srgbToOklab(r, g, b) { // gamma-encoded 0..1
  const [lr, lg, lb] = [r, g, b].map(gammaToLinear);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}
function oklabToLch(L, a, b) {
  const C = Math.hypot(a, b);
  let H = Math.atan2(b, a) / D; if (H < 0) H += 360;
  return [L, C, H];
}
function oklch(L, C, H) { // -> {rgb:[0..1]x3 gamma, hex, inGamut}
  const [l, a, b] = oklchToOklab(L, C, H);
  const lin = oklabToLinearSrgb(l, a, b);
  const inGamut = lin.every(c => c >= -0.0005 && c <= 1.0005);
  const rgb = lin.map(c => Math.min(1, Math.max(0, linearToGamma(Math.min(1, Math.max(0, c))))));
  return { rgb, hex: '#' + rgb.map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join(''), inGamut };
}
function hexToRgb(hex) { const h = hex.replace('#', ''); return [0, 1, 2].map(i => parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255); }
function relLum([r, g, b]) { const [R, G, B] = [r, g, b].map(gammaToLinear); return 0.2126 * R + 0.7152 * G + 0.0722 * B; }
function contrast(c1, c2) { const [a, b] = [relLum(c1), relLum(c2)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); }
// alpha-composite fg (rgb gamma, alpha) over bg (rgb gamma) in gamma space (browser behavior)
function composite(fg, alpha, bg) { return fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]); }
const fmt = x => Math.round(x * 100) / 100;

// ---------- seeds ----------
const seedGreen = srgbToOklab(...hexToRgb('#47a34e'));
const seedBlue = srgbToOklab(...hexToRgb('#3b82f6'));
console.log('seed today-green oklch:', oklabToLch(...seedGreen).map(fmt));
console.log('seed default-blue oklch:', oklabToLch(...seedBlue).map(fmt));

// ---------- accent candidates ----------
console.log('\n--- accent candidates (hex / inGamut / vs white text / vs ink #0B0C10 text) ---');
const ink = hexToRgb('#0B0C10');
const white = [1, 1, 1];
for (const [L, C, H] of [
  [0.72, 0.145, 175], [0.72, 0.145, 180], [0.72, 0.14, 185], [0.72, 0.13, 190],
  [0.75, 0.14, 180], [0.70, 0.14, 182], [0.68, 0.14, 183],
  [0.56, 0.11, 185], [0.53, 0.10, 185], [0.52, 0.095, 185], [0.50, 0.09, 185],
]) {
  const c = oklch(L, C, H);
  console.log(`oklch(${L} ${C} ${H})`, c.hex, c.inGamut ? 'gamut-ok' : 'OUT', 'white:', fmt(contrast(c.rgb, white)), 'ink:', fmt(contrast(c.rgb, ink)));
}

// ---------- neutral ladders, aqua cast (hue ~200) ----------
console.log('\n--- neutral ladder candidates ---');
const ladder = {
  'void          ': [0.155, 0.009, 200],
  'bg-dark       ': [0.174, 0.008, 200],
  'surface1-dark ': [0.197, 0.012, 202],
  'surface2-dark ': [0.220, 0.014, 203],
  'surface3-dark ': [0.242, 0.015, 204],
  'hairline-dark ': [0.279, 0.019, 202],
  'hairlineS-dark': [0.332, 0.023, 203],
  'bg-light      ': [0.988, 0.002, 200],
  'surface2-light': [0.971, 0.003, 200],
  'hairline-light': [0.932, 0.005, 200],
  'hairlineS-lite': [0.893, 0.008, 200],
  'ink-light     ': [0.206, 0.012, 210],
  'ink2-light    ': [0.361, 0.016, 210],
  'muted-light   ': [0.542, 0.019, 210],
  'faint-light   ': [0.699, 0.015, 210],
  'ink-dark      ': [0.978, 0.003, 190],
  'ink2-dark     ': [0.874, 0.012, 195],
  'muted-dark    ': [0.649, 0.015, 200],
  'faint-dark    ': [0.509, 0.012, 200],
};
const L = {}; // resolved rgb by key
for (const [k, v] of Object.entries(ladder)) { const c = oklch(...v); L[k.trim()] = c.rgb; console.log(k, `oklch(${v.join(' ')})`, c.hex, c.inGamut ? '' : 'OUT-OF-GAMUT'); }

console.log('\n--- text contrast checks (>=4.5 body, >=3 large/secondary-decor) ---');
const checks = [
  ['ink-light on bg-light', L['ink-light'], L['bg-light'], 4.5],
  ['ink2-light on bg-light', L['ink2-light'], L['bg-light'], 4.5],
  ['muted-light on bg-light', L['muted-light'], L['bg-light'], 4.5],
  ['muted-light on surface2-light', L['muted-light'], L['surface2-light'], 4.5],
  ['ink-dark on bg-dark', L['ink-dark'], L['bg-dark'], 4.5],
  ['ink2-dark on bg-dark', L['ink2-dark'], L['bg-dark'], 4.5],
  ['muted-dark on bg-dark', L['muted-dark'], L['bg-dark'], 4.5],
  ['muted-dark on surface3-dark', L['muted-dark'], L['surface3-dark'], 4.5],
];
for (const [name, a, b, min] of checks) {
  const r = contrast(a, b);
  console.log((r >= min ? 'PASS' : 'FAIL'), name, fmt(r));
}

// ---------- chip formula across curated palette ----------
console.log('\n--- chip formula: dark 24% film on surface1-dark, text L=0.82 minC 0.1 | light 12% on white, text L=0.50 ---');
const palette = { // curated picker, accent band 155-205 EXCLUDED
  red: [0.64, 0.15, 25], orange: [0.64, 0.15, 55], yellow: [0.72, 0.14, 95],
  green: [0.64, 0.15, 135], blue: [0.64, 0.15, 235], indigo: [0.60, 0.15, 275],
  violet: [0.64, 0.15, 305], magenta: [0.64, 0.15, 335], slate: [0.64, 0.03, 210],
  brown: [0.56, 0.07, 60],
};
const white1 = hexToRgb('#ffffff');
for (const [name, [l, c, h]] of Object.entries(palette)) {
  const base = oklch(l, c, h);
  const darkBg = composite(base.rgb, 0.24, L['surface1-dark']);
  const darkText = oklch(0.82, Math.min(c, 0.1), h);
  const lightBg = composite(base.rgb, 0.12, white1);
  const lightText = oklch(0.50, c, h);
  const dC = contrast(darkText.rgb, darkBg), lC = contrast(lightText.rgb, lightBg);
  console.log(name.padEnd(8), base.hex, base.inGamut ? '' : 'OUT', '| dark', dC >= 4.5 ? 'PASS' : 'FAIL', fmt(dC), darkText.hex, '| light', lC >= 4.5 ? 'PASS' : 'FAIL', fmt(lC), lightText.hex);
}

// ---------- accent films (today wash) ----------
console.log('\n--- accent washes ---');
const aquaDark = oklch(0.72, 0.145, 180); // candidate
const aquaLight = oklch(0.53, 0.10, 185); // candidate deep
console.log('today wash dark 6%:', composite(aquaDark.rgb, 0.06, L['bg-dark']).map(c => Math.round(c * 255)));
console.log('today wash light 4%:', composite(aquaLight.rgb, 0.04, L['bg-light']).map(c => Math.round(c * 255)));
// non-text: accent vs adjacent bg >= 3:1 for focus ring / now-line
console.log('aqua-dark vs bg-dark (ring/now-line >=3):', fmt(contrast(aquaDark.rgb, L['bg-dark'])));
console.log('aqua-light vs bg-light (ring/now-line >=3):', fmt(contrast(aquaLight.rgb, L['bg-light'])));

// ---------- gamut-exact accent tuning ----------
console.log('\n--- gamut hunt: max in-gamut chroma at candidate L/H ---');
function maxC(L, H) { let lo = 0, hi = 0.2; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; oklch(L, mid, H).inGamut ? lo = mid : hi = mid; } return Math.floor(lo * 1000) / 1000; }
for (const [L, H] of [[0.72, 178], [0.72, 180], [0.72, 182], [0.74, 182], [0.76, 182], [0.53, 182], [0.53, 185], [0.50, 185], [0.49, 182]]) {
  const c = maxC(L, H); const s = oklch(L, c, H);
  console.log(`L=${L} H=${H} maxC=${c}`, s.hex, 'white:', fmt(contrast(s.rgb, white)), 'ink:', fmt(contrast(s.rgb, ink)));
}
console.log('\n--- final accent proposal ---');
const A = { // dark-theme accent tier (bright, carries ink)
  aquaDark: [0.72, 0.125, 182], aquaDarkHover: [0.76, 0.115, 182],
  // light-theme accent tier (deep, carries white)
  aquaLight: [0.53, 0.088, 182], aquaLightHover: [0.49, 0.085, 182],
  amber: [0.75, 0.14, 85], destructive: [0.577, 0.245, 27.325],
};
for (const [k, v] of Object.entries(A)) {
  const c = oklch(...v);
  console.log(k.padEnd(14), `oklch(${v.join(' ')})`, c.hex, c.inGamut ? 'gamut-ok' : 'OUT', 'white:', fmt(contrast(c.rgb, white)), 'ink:', fmt(contrast(c.rgb, ink)));
}
const aqD = oklch(...A.aquaDark), aqL = oklch(...A.aquaLight);
console.log('aquaDark vs bg-dark >=3:', fmt(contrast(aqD.rgb, L['bg-dark'])), '| vs surface3-dark:', fmt(contrast(aqD.rgb, L['surface3-dark'])));
console.log('aquaLight vs bg-light >=3:', fmt(contrast(aqL.rgb, L['bg-light'])), '| vs white:', fmt(contrast(aqL.rgb, white1)));
console.log('ink-dark text on aquaDark film16 over surface3-dark (selected row):', fmt(contrast(L['ink-dark'], composite(aqD.rgb, 0.16, L['surface3-dark']))));
console.log('ink-light text on aquaLight film08 over bg-light:', fmt(contrast(L['ink-light'], composite(aqL.rgb, 0.08, L['bg-light']))));
// mono time labels in accent color on canvas (gutter now-time)
console.log('aquaDark as 11px mono text on bg-dark (>=4.5):', fmt(contrast(aqD.rgb, L['bg-dark'])));
console.log('aquaLight as 11px mono text on bg-light (>=4.5):', fmt(contrast(aqL.rgb, L['bg-light'])));
