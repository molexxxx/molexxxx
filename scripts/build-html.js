import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Mustache from 'mustache';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Minify in CI (GitHub Actions sets CI=true) or when --minify flag passed.
const MINIFY = process.env.CI === 'true' || process.argv.includes('--minify');

function minifyCss(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')          // strip /* ... */ comments
    .replace(/\s+/g, ' ')                       // collapse whitespace
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')       // tighten around punctuation
    .replace(/;}/g, '}')                        // drop trailing semicolons
    .replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')')
    .trim();
}

const data = JSON.parse(readFileSync(resolve(root, 'resume.data.json'), 'utf8'));

// Precompute first-letter initial for letter-tile fallback (mustache can't slice).
if (Array.isArray(data.projects)) {
  for (const p of data.projects) p.initial = (p.name || '?').charAt(0).toUpperCase();
}

const ghPath = resolve(root, 'data.github.json');
if (existsSync(ghPath)) {
  try { data.github = JSON.parse(readFileSync(ghPath, 'utf8')); }
  catch { /* ignore */ }
}

// Pre-compute the animated top badges (Resume / Repos / Gists / npm) with stat
// values pulled from the cached GitHub payload. Each badge gets an inline SVG
// icon and a unique id used by the in-template particle animation defs.
const GH_USER = data.github?.user?.login || 'tonywied17';
const NPM_USER = 'molex222';
const ICON_SVG = {
  resume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.1-.75.08-.74.08-.74 1.21.09 1.85 1.24 1.85 1.24 1.08 1.85 2.83 1.32 3.52 1.01.11-.78.42-1.32.76-1.62-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z"/></svg>',
  gist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  npm: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 7v10h6v-7h3v7h11V7H2zm5 8H5V9h2v6zm8 0h-2V9h-2v6h-2V9h6v6z"/></svg>',
};
function n(v) { return (v == null || Number.isNaN(v)) ? '–' : String(v); }
const t = data.github?.totals ?? {};
data.badges = [
  { id: 'resume', label: 'Resume', value: 'PDF', href: 'resume.pdf', download: true, iconSvg: ICON_SVG.resume, accentVar: 'badge-c1' },
  { id: 'repos',  label: 'Repos',  value: n(t.repos),  href: `https://github.com/${GH_USER}?tab=repositories`, iconSvg: ICON_SVG.github, accentVar: 'badge-c2' },
  { id: 'gists',  label: 'Gists',  value: n(t.gists),  href: `https://gist.github.com/${GH_USER}`, iconSvg: ICON_SVG.gist, accentVar: 'badge-c3' },
  { id: 'npm',    label: 'npm',    value: n(t.npm),    href: `https://www.npmjs.com/~${NPM_USER}`, iconSvg: ICON_SVG.npm, accentVar: 'badge-c4' },
];
data.ghUser = GH_USER;

const tpl = readFileSync(resolve(root, 'template/resume.html.mustache'), 'utf8');

// Keep HTML escaping on for safety. (Avatar / URLs go through href which is fine.)
const html = Mustache.render(tpl, data);

const outDir = resolve(root, 'dist');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'index.html'), html, 'utf8');

const cssSrc = readFileSync(resolve(root, 'template/resume.css'), 'utf8');
writeFileSync(resolve(outDir, 'resume.css'), MINIFY ? minifyCss(cssSrc) : cssSrc, 'utf8');
copyFileSync(resolve(root, 'template/resume.js'), resolve(outDir, 'resume.js'));

// Copy any non-source files (images, etc.) from template/ alongside the html.
for (const entry of readdirSync(resolve(root, 'template'))) {
  if (/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(entry)) {
    copyFileSync(resolve(root, 'template', entry), resolve(outDir, entry));
  }
}

// Copy assets/ verbatim into dist/assets/ so referenced photos/files ship with the site.
const assetsSrc = resolve(root, 'assets');
if (existsSync(assetsSrc)) {
  const assetsOut = resolve(outDir, 'assets');
  mkdirSync(assetsOut, { recursive: true });
  for (const entry of readdirSync(assetsSrc)) {
    const s = resolve(assetsSrc, entry);
    if (statSync(s).isFile()) copyFileSync(s, resolve(assetsOut, entry));
  }
  console.log('  ✓ dist/assets/');
}

console.log('  ✓ dist/index.html');
console.log(`  ✓ dist/resume.css${MINIFY ? ' (minified)' : ''}`);
console.log('  ✓ dist/resume.js');
