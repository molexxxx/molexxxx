#!/usr/bin/env node
// Subtle tagline badges for the README header subtitle.
// Each tag is its own small transparent SVG so the row wraps naturally on
// mobile. Monochrome palette - no rainbow - just typography + a tiny
// leading mark, slightly emphasized on the primary "developer" badge.

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const OUT = '.github/badges';
const README = 'README.md';
const RAW = 'https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges';

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const TAGS = [
  { slug: 'developer',         label: 'developer',         primary: true },
  { slug: 'web',               label: 'web' },
  { slug: 'desktop',           label: 'desktop' },
  { slug: 'games',             label: 'games' },
  { slug: 'robotics-drones',   label: 'robotics & drones' },
  { slug: 'real-time',         label: 'real-time' },
  { slug: 'audio-dsp',         label: 'audio/DSP' },
  { slug: 'graphics',          label: 'graphics' },
];

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Approx Segoe UI / Inter widths at 13/500 and 14/700 for primary.
const CW     = { default: 7.6, ' ': 3.9, 'i': 3.6, 'l': 3.6, 'I': 3.8, 'r': 4.7, 't': 4.5, 'f': 4.7, '/': 4.4, '-': 4.6, '&': 8.6, '.': 3.6 };
const CW_PRI = { default: 8.4, ' ': 4.3, 'i': 4.0, 'l': 4.0, 'I': 4.2, 'r': 5.2, 't': 5.0, 'f': 5.0 };
const measure = (s, t) => { let w = 0; for (const c of s) w += t[c] ?? t.default; return w; };

function buildBadge(tag, dark) {
  const ink           = dark ? '#e6edf3' : '#1f2328';
  const muted         = dark ? '#8b949e' : '#656d76';
  const accent        = dark ? '#6e7681' : '#9aa3ad';
  const primaryAccent = dark ? '#58a6ff' : '#0969da';

  const H = 24;
  const PAD_X = 2;
  const MARK_GAP = 8;
  const font = tag.primary ? 14 : 13;
  const weight = tag.primary ? 700 : 500;
  const fill = tag.primary ? ink : muted;
  const markColor = tag.primary ? primaryAccent : accent;
  const table = tag.primary ? CW_PRI : CW;

  const textW = measure(tag.label, table);
  // Diamond mark: 6px square rotated 45 -> ~8.5px bbox.
  const DIAMOND_R = tag.primary ? 3.4 : 2.8;
  const MARK_BOX = Math.ceil(DIAMOND_R * 2 + 1);
  const W = Math.ceil(PAD_X + MARK_BOX + MARK_GAP + textW + PAD_X);

  const yMid = H / 2;
  const yText = yMid + font * 0.36;
  const cx = PAD_X + MARK_BOX / 2;
  const cy = yMid;
  const textX = PAD_X + MARK_BOX + MARK_GAP;
  const diamond = `M ${cx} ${cy - DIAMOND_R} L ${cx + DIAMOND_R} ${cy} L ${cx} ${cy + DIAMOND_R} L ${cx - DIAMOND_R} ${cy} Z`;
  const animate = tag.primary
    ? `<animate attributeName="opacity" values="1;0.55;1" dur="3.6s" repeatCount="indefinite"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${xml(tag.label)}">
  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">
    <path d="${diamond}" fill="${markColor}" opacity="${tag.primary ? 1 : 0.65}">${animate}</path>
    <text x="${textX}" y="${yText}" font-size="${font}" font-weight="${weight}" fill="${fill}" letter-spacing="${tag.primary ? -0.1 : 0}">${xml(tag.label)}</text>
  </g>
</svg>
`;
}

function buildSeparator(dark) {
  const c = dark ? '#6e7681' : '#9aa3ad';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="24" viewBox="0 0 10 24" role="img" aria-hidden="true">
  <circle cx="5" cy="12" r="1.4" fill="${c}" opacity="0.5"/>
</svg>
`;
}

const meta = [];
for (const tag of TAGS) {
  const dark  = buildBadge(tag, true);
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

const sepDark  = buildSeparator(true);
const sepLight = buildSeparator(false);
writeFileSync(path.join(OUT, 'tag-sep-dark.svg'), sepDark);
writeFileSync(path.join(OUT, 'tag-sep-light.svg'), sepLight);
const sepDHash = createHash('sha1').update(sepDark).digest('hex').slice(0, 8);
const sepLHash = createHash('sha1').update(sepLight).digest('hex').slice(0, 8);

const ts = Date.now().toString(36);
const sepPic = `<picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/tag-sep-dark.svg?v=${sepDHash}&t=${ts}"><img height="24" alt="" src="${RAW}/tag-sep-light.svg?v=${sepLHash}&t=${ts}" /></picture>`;
const pics = meta.map(m =>
  `<picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/tag-${m.slug}-dark.svg?v=${m.dHash}&t=${ts}"><img height="24" alt="${xml(m.label)}" src="${RAW}/tag-${m.slug}-light.svg?v=${m.lHash}&t=${ts}" /></picture>`
).join(`\n  ${sepPic}\n  `);

const replacement = `<p align="center">\n  ${pics}\n</p>`;

let md = readFileSync(README, 'utf8');
// Strip stray git conflict markers from a botched rebase.
md = md.replace(/^<{7} .*\n/gm, '').replace(/^={7}\n/gm, '').replace(/^>{7} .*\n/gm, '');
// Match prior tagline forms: plain text, single tagline image, or this multi-pic block.
const taglineLine = /<p align="center">(?:\s|<picture>[\s\S]*?(?:tagline-|tag-)[\s\S]*?<\/picture>|&nbsp;|<b>developer<\/b>[^<]*)+<\/p>\s*\n/;
// Collapse any duplicates.
const all = [...md.matchAll(new RegExp(taglineLine.source, 'g'))];
if (all.length > 1) {
  for (let i = all.length - 1; i >= 1; i--) {
    md = md.slice(0, all[i].index) + md.slice(all[i].index + all[i][0].length);
  }
}
if (taglineLine.test(md)) {
  md = md.replace(taglineLine, replacement + '\n');
  writeFileSync(README, md);
  console.log('updated README.md tagline');
} else {
  console.warn('tagline line not found in README.md - prepending');
  writeFileSync(README, replacement + '\n\n' + md);
}

console.log(`wrote ${meta.length * 2} tag badges`);
