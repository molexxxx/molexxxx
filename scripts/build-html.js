import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Mustache from 'mustache';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

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

const tpl = readFileSync(resolve(root, 'template/resume.html.mustache'), 'utf8');

// Keep HTML escaping on for safety. (Avatar / URLs go through href which is fine.)
const html = Mustache.render(tpl, data);

const outDir = resolve(root, 'dist');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'resume.html'), html, 'utf8');
writeFileSync(resolve(outDir, 'index.html'), html, 'utf8'); // GitHub Pages default
copyFileSync(resolve(root, 'template/resume.css'), resolve(outDir, 'resume.css'));
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
console.log('  ✓ dist/resume.html');
console.log('  ✓ dist/resume.css');
console.log('  ✓ dist/resume.js');
