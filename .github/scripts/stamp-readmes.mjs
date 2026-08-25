#!/usr/bin/env node

// Sibling repos link to badges hosted here. Their ?v= values are written by
// hand and go stale the moment a badge is regenerated, so re-stamp them from
// the badge files currently on disk.
//
// Run from this repo after the badge generator, with the sibling repos checked
// out next to it:
//
//   node .github/scripts/generate-badges.mjs
//   node .github/scripts/stamp-readmes.mjs
//
// Pass explicit README paths to override the default list.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const OUT = '.github/badges';

// Sibling checkouts, relative to this repo's root.
const DEFAULT_READMES = [
  '../molex-media-electron/README.md',
  '../plex-poster-set-helper-2/README.md',
  '../youtube-downloader/README.md',
  '../zero-edge/README.md',
  '../zero-query/README.md',
  '../zero-server/README.md',
  '../zero-transfer/README.md',
];

// Badge URLs pointing at this repo, in either raw URL form, with an optional
// existing ?v= to replace.
const BADGE_RE = /https:\/\/raw\.githubusercontent\.com\/molexxxx\/molexxxx\/(?:refs\/heads\/)?main\/\.github\/badges\/([A-Za-z0-9._-]+\.svg)(?:\?v=[0-9a-f]+)?/g;

const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_READMES;

let totalStamped = 0;
let totalMissing = 0;

for (const rel of targets)
{
  const file = path.resolve(rel);
  if (!existsSync(file))
  {
    console.warn(`skip ${rel} (not found)`);
    continue;
  }

  const before = readFileSync(file, 'utf8');
  let stamped = 0;
  const missing = [];

  const after = before.replace(BADGE_RE, (whole, name) =>
  {
    const svg = path.join(OUT, name);
    if (!existsSync(svg))
    {
      missing.push(name);
      return whole;
    }
    const hash = createHash('sha1').update(readFileSync(svg, 'utf8')).digest('hex').slice(0, 8);
    stamped++;
    return `${whole.split('?')[0]}?v=${hash}`;
  });

  if (after !== before) writeFileSync(file, after);
  totalStamped += stamped;
  totalMissing += missing.length;
  const note = missing.length ? `  MISSING: ${[...new Set(missing)].join(', ')}` : '';
  console.log(`${String(stamped).padStart(3)} stamped  ${rel}${note}`);
}

console.log(`\n${totalStamped} badge URLs stamped across ${targets.length} README(s)`);
if (totalMissing)
{
  console.error(`${totalMissing} reference(s) point at badge files that do not exist here`);
  process.exitCode = 1;
}
