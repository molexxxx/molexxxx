import { spawnSync } from 'node:child_process';

const steps = ['fetch-github.js', 'build-html.js', 'build-pdf.js', 'build-docx.js'];
for (const s of steps)
{
  console.log(`\n› ${s}`);
  const r = spawnSync(process.execPath, [`scripts/${s}`], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log('\nAll outputs written to ./dist');
