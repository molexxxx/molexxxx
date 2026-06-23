import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Mustache from 'mustache';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Minify in CI (GitHub Actions sets CI=true) or when --minify flag passed.
const MINIFY = process.env.CI === 'true' || process.argv.includes('--minify');

function minifyCss(src)
{
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')          // strip /* ... */ comments
    .replace(/\s+/g, ' ')                       // collapse whitespace
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')       // tighten around punctuation
    .replace(/;}/g, '}')                        // drop trailing semicolons
    .replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')')
    .trim();
}

const data = JSON.parse(readFileSync(resolve(root, 'resume.data.json'), 'utf8'));

if (Array.isArray(data.projects))
{
  for (const p of data.projects) p.initial = (p.name || '?').charAt(0).toUpperCase();
}

const ghPath = resolve(root, 'data.github.json');
if (existsSync(ghPath))
{
  try { data.github = JSON.parse(readFileSync(ghPath, 'utf8')); }
  catch { /* ignore */ }
}

data.ghUser = data.github?.user?.login || 'molexxxx';

const tpl = readFileSync(resolve(root, 'template/resume.html.mustache'), 'utf8');

const html = Mustache.render(tpl, data);

const outDir = resolve(root, 'dist');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'index.html'), html, 'utf8');

const cssSrc = readFileSync(resolve(root, 'template/resume.css'), 'utf8');
writeFileSync(resolve(outDir, 'resume.css'), MINIFY ? minifyCss(cssSrc) : cssSrc, 'utf8');
copyFileSync(resolve(root, 'template/resume.js'), resolve(outDir, 'resume.js'));

// Copy any non-source files (images, etc.) from template/ alongside the html
for (const entry of readdirSync(resolve(root, 'template')))
{
  if (/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(entry))
  {
    copyFileSync(resolve(root, 'template', entry), resolve(outDir, entry));
  }
}

// Copy assets/ verbatim into dist/assets/ so referenced photos/files ship with the site
const assetsSrc = resolve(root, 'assets');
if (existsSync(assetsSrc))
{
  const assetsOut = resolve(outDir, 'assets');
  mkdirSync(assetsOut, { recursive: true });
  for (const entry of readdirSync(assetsSrc))
  {
    const s = resolve(assetsSrc, entry);
    if (statSync(s).isFile()) copyFileSync(s, resolve(assetsOut, entry));
  }
  console.log('  ✓ dist/assets/');
}

console.log('  ✓ dist/index.html');
console.log(`  ✓ dist/resume.css${MINIFY ? ' (minified)' : ''}`);
console.log('  ✓ dist/resume.js');
