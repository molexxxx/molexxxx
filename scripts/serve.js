import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync, watch } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

const rebuild = () => {
  console.log('› rebuilding html…');
  spawnSync(process.execPath, ['scripts/build-html.js'], { stdio: 'inherit', cwd: root });
};

rebuild();

for (const f of ['resume.data.json', 'template/resume.html.mustache', 'template/resume.css']) {
  const p = resolve(root, f);
  if (existsSync(p)) watch(p, { persistent: true }, () => rebuild());
}

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  let url = req.url === '/' ? '/resume.html' : req.url.split('?')[0];
  const path = resolve(dist, '.' + url);
  if (!path.startsWith(dist) || !existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
  res.end(await readFile(path));
});

const port = Number(process.env.PORT) || 4173;
server.listen(port, () => console.log(`\nResume preview: http://localhost:${port}/`));
