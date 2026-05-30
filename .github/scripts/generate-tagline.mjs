#!/usr/bin/env node

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const OUT = '.github/badges';
const README = 'README.md';
const RAW = 'https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges';

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const TAGS = [
  { slug: 'developer', label: 'developer', primary: true },
  { slug: 'web', label: 'web' },
  { slug: 'desktop', label: 'desktop' },
  { slug: 'games', label: 'games' },
  { slug: 'robotics-drones', label: 'robotics & drones' },
  { slug: 'real-time', label: 'real-time' },
  { slug: 'audio-dsp', label: 'audio/DSP' },
  { slug: 'graphics', label: 'graphics' },
];

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Approx Segoe UI / Inter widths at 13/500 and 14/700 for primary.
const CW = { default: 7.6, ' ': 3.9, 'i': 3.6, 'l': 3.6, 'I': 3.8, 'r': 4.7, 't': 4.5, 'f': 4.7, '/': 4.4, '-': 4.6, '&': 8.6, '.': 3.6 };
const CW_PRI = { default: 8.4, ' ': 4.3, 'i': 4.0, 'l': 4.0, 'I': 4.2, 'r': 5.2, 't': 5.0, 'f': 5.0 };
const measure = (s, t) => { let w = 0; for (const c of s) w += t[c] ?? t.default; return w; };

function buildBadge(tag, dark)
{
  const ink = dark ? '#e6edf3' : '#1f2328';
  const muted = dark ? '#a9b3bf' : '#57606a';
  const borderMuted = dark ? 'rgba(110,118,129,0.45)' : 'rgba(154,163,173,0.55)';
  const bgMuted = dark ? 'rgba(110,118,129,0.10)' : 'rgba(154,163,173,0.10)';
  const primaryAccent = dark ? '#58a6ff' : '#0969da';
  const primaryBorder = dark ? 'rgba(88,166,255,0.65)' : 'rgba(9,105,218,0.60)';
  const primaryBg = dark ? 'rgba(88,166,255,0.14)' : 'rgba(9,105,218,0.10)';

  const H = 26;
  const PAD_X = 11;
  const font = tag.primary ? 13 : 12.5;
  const weight = tag.primary ? 700 : 600;
  const fill = tag.primary ? ink : muted;
  const bg = tag.primary ? primaryBg : bgMuted;
  const border = tag.primary ? primaryBorder : borderMuted;
  const table = tag.primary ? CW_PRI : CW;

  const textW = measure(tag.label, table);
  const W = Math.ceil(PAD_X * 2 + textW);

  const yMid = H / 2;
  const yText = yMid + font * 0.36;
  const textX = W / 2;
  const RX = H / 2;

  // Primary gets a soft pulsing glow on the outline.
  const pulse = tag.primary
    ? `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${RX - 0.5}" fill="none" stroke="${primaryAccent}" stroke-width="1" opacity="0.6"><animate attributeName="opacity" values="0.25;0.85;0.25" dur="3.4s" repeatCount="indefinite"/></rect>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${xml(tag.label)}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${RX - 0.5}" fill="${bg}" stroke="${border}" stroke-width="1"/>
  ${pulse}
  <text x="${textX}" y="${yText}" text-anchor="middle" font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="${font}" font-weight="${weight}" fill="${fill}" letter-spacing="${tag.primary ? 0.1 : 0.3}">${xml(tag.label)}</text>
</svg>
`;
}

function buildSeparator(_dark)
{
  // No separator emitted any more; kept as no-op.
  return '';
}

const meta = [];
for (const tag of TAGS)
{
  const dark = buildBadge(tag, true);
  const light = buildBadge(tag, false);
  writeFileSync(path.join(OUT, `tag-${tag.slug}-dark.svg`), dark);
  writeFileSync(path.join(OUT, `tag-${tag.slug}-light.svg`), light);
  meta.push({
    slug: tag.slug,
    label: tag.label,
    dHash: createHash('sha1').update(dark).digest('hex').slice(0, 8),
    lHash: createHash('sha1').update(light).digest('hex').slice(0, 8),
  });
}

const sepDark = buildSeparator(true);
const sepLight = buildSeparator(false);
void sepDark; void sepLight;

const ts = Date.now().toString(36);
const pics = meta.map(m =>
  `<picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/tag-${m.slug}-dark.svg?v=${m.dHash}&t=${ts}"><img height="26" alt="${xml(m.label)}" src="${RAW}/tag-${m.slug}-light.svg?v=${m.lHash}&t=${ts}" /></picture>`
).join('\n  ');

const replacement = `<p align="center">\n  ${pics}\n</p>`;

let md = readFileSync(README, 'utf8');
// Strip stray git conflict markers from a botched rebase.
md = md.replace(/^<{7} .*\n/gm, '').replace(/^={7}\n/gm, '').replace(/^>{7} .*\n/gm, '');
// Match prior tagline forms: plain text, single tagline image, or this multi-pic block.
const taglineLine = /<p align="center">(?:\s|<picture>[\s\S]*?(?:tagline-|tag-)[\s\S]*?<\/picture>|&nbsp;|<b>developer<\/b>[^<]*)+<\/p>\s*\n/;
// Collapse any duplicates.
const all = [...md.matchAll(new RegExp(taglineLine.source, 'g'))];
if (all.length > 1)
{
  for (let i = all.length - 1; i >= 1; i--)
  {
    md = md.slice(0, all[i].index) + md.slice(all[i].index + all[i][0].length);
  }
}
if (taglineLine.test(md))
{
  md = md.replace(taglineLine, replacement + '\n');
  writeFileSync(README, md);
  console.log('updated README.md tagline');
} else
{
  console.warn('tagline line not found in README.md - prepending');
  writeFileSync(README, replacement + '\n\n' + md);
}

console.log(`wrote ${meta.length * 2} tag badges`);
