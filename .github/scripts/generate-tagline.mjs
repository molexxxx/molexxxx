#!/usr/bin/env node
// Subtle tagline SVG used as the README header subtitle. Transparent
// surface, neutral palette, single accent bar - matches the stack cards.

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const OUT = '.github/badges';
const README = 'README.md';
const RAW = 'https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges';

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const PRIMARY = 'developer';
const TAGS = ['web', 'desktop', 'games', 'robotics & drones', 'real-time', 'audio/DSP', 'graphics'];

// Brand-ish accent dot color per tag (kept low-saturation, pulled from the
// header pill palette so it ties back without becoming a rainbow).
const DOT = {
  'web':              '#60a5fa',
  'desktop':          '#a78bfa',
  'games':            '#22d4f0',
  'robotics & drones':'#34d399',
  'real-time':        '#f59e0b',
  'audio/DSP':        '#f472b6',
  'graphics':         '#f87171',
};

// Approx Segoe UI / Inter widths at 14/600 for the primary and 13/500 for tags.
const CW_PRI = { default: 8.4, ' ': 4.3, 'i': 4.0, 'l': 4.0, 'I': 4.2, 'r': 5.2, 't': 5.0, 'f': 5.2 };
const CW_TAG = { default: 7.6, ' ': 3.9, 'i': 3.6, 'l': 3.6, 'I': 3.8, 'r': 4.7, 't': 4.5, 'f': 4.7, '/': 4.4, '-': 4.6, '&': 8.6 };
const measure = (s, t) => { let w = 0; for (const c of s) w += t[c] ?? t.default; return w; };

function buildSvg(dark) {
  const ink   = dark ? '#e6edf3' : '#1f2328';
  const muted = dark ? '#8b949e' : '#656d76';
  const sep   = dark ? '#30363d' : '#d0d7de';
  const accent = dark ? '#3b82f6' : '#2563eb';

  const H = 36;
  const PAD_X = 4;
  const ACCENT_W = 3;
  const ACCENT_GAP = 10;
  const PRIMARY_FONT = 14;
  const TAG_FONT = 13;
  const DOT_R = 2.8;
  const DOT_GAP = 7;
  const SEP_GAP = 14;

  // Compute cursor X for each piece so we can size the viewBox to fit.
  let x = PAD_X;
  const accentX = x;
  x += ACCENT_W + ACCENT_GAP;

  const primaryX = x;
  x += measure(PRIMARY, CW_PRI);

  // separator (vertical hairline) between primary and tags
  x += SEP_GAP;
  const sepX = x - SEP_GAP / 2;

  const tagLayouts = [];
  for (let i = 0; i < TAGS.length; i++) {
    const tag = TAGS[i];
    const dotX = x + DOT_R;
    const textX = dotX + DOT_R + DOT_GAP;
    const w = measure(tag, CW_TAG);
    tagLayouts.push({ tag, dotX, textX, dotColor: DOT[tag] });
    x = textX + w;
    if (i < TAGS.length - 1) x += SEP_GAP;
  }
  x += PAD_X;
  const W = Math.ceil(x);

  const yMid = H / 2;
  const yText = yMid + 4.6;

  const tagsSvg = tagLayouts.map(({ tag, dotX, textX, dotColor }) =>
    `<circle cx="${dotX}" cy="${yMid}" r="${DOT_R}" fill="${dotColor}" opacity="0.85"/>
     <text x="${textX}" y="${yText}" font-size="${TAG_FONT}" font-weight="500" fill="${muted}">${tag.replace(/&/g, '&amp;')}</text>`
  ).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="developer - ${TAGS.join(', ').replace(/&/g, '&amp;')}">
  <defs>
    <linearGradient id="acc" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.0"/>
      <stop offset="50%" stop-color="${accent}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.0"/>
    </linearGradient>
  </defs>
  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">
    <rect x="${accentX}" y="${(H - 18) / 2}" width="${ACCENT_W}" height="18" rx="1.5" fill="url(#acc)"/>
    <text x="${primaryX}" y="${yText}" font-size="${PRIMARY_FONT}" font-weight="700" fill="${ink}" letter-spacing="-0.1">${PRIMARY}</text>
    <line x1="${sepX}" y1="${yMid - 8}" x2="${sepX}" y2="${yMid + 8}" stroke="${sep}" stroke-width="1"/>
    ${tagsSvg}
  </g>
</svg>
`;
}

const dark  = buildSvg(true);
const light = buildSvg(false);

writeFileSync(path.join(OUT, 'tagline-dark.svg'), dark);
writeFileSync(path.join(OUT, 'tagline-light.svg'), light);

const dHash = createHash('sha1').update(dark).digest('hex').slice(0, 8);
const lHash = createHash('sha1').update(light).digest('hex').slice(0, 8);
const ts = Date.now().toString(36);

const replacement = `<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/tagline-dark.svg?v=${dHash}&t=${ts}"><img height="36" alt="developer - web, desktop, games, robotics & drones, real-time, audio/DSP, graphics" src="${RAW}/tagline-light.svg?v=${lHash}&t=${ts}" /></picture></p>`;

let md = readFileSync(README, 'utf8');
// Strip any leftover git conflict markers around tagline lines so a botched
// rebase doesn't survive a regeneration.
md = md.replace(/^<{7} .*\n/gm, '').replace(/^={7}\n/gm, '').replace(/^>{7} .*\n/gm, '');
// Match either the original plain-text line or any previously generated tagline <picture>.
const taglineLine = /<p align="center">(?:<picture>[\s\S]*?tagline-[\s\S]*?<\/picture>|<b>developer<\/b>[^<]*)<\/p>\s*\n/;
// Collapse duplicate tagline <picture> blocks down to one.
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

console.log('wrote tagline-{dark,light}.svg');
