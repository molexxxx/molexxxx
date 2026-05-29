import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Mustache from 'mustache';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const data = JSON.parse(readFileSync(resolve(root, 'resume.data.json'), 'utf8'));

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

console.log('  ✓ dist/index.html');
console.log('  ✓ dist/resume.html');
console.log('  ✓ dist/resume.css');
console.log('  ✓ dist/resume.js');
