import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const htmlPath = resolve(root, 'dist/index.html');

if (!existsSync(htmlPath)) {
  console.error('dist/index.html missing - run `npm run build:html` first.');
  process.exit(1);
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
try {
  const page = await browser.newPage();
  // Force light theme for the PDF regardless of the page's default.
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('resume-theme', 'light'); } catch {}
  });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  const out = resolve(root, 'dist/resume.pdf');
  await page.pdf({
    path: out,
    format: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
  });
  console.log('  ✓ dist/resume.pdf');
} finally {
  await browser.close();
}
