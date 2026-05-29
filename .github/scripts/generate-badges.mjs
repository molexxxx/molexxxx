#!/usr/bin/env node

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN) {
  console.error('GH_TOKEN env var is required');
  process.exit(1);
}

const OWNER = 'tonywied17';
const REPO  = 'tonywied17';
const OUT   = '.github/badges';
const RAW   = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${OUT}`;

const BADGES = [
  { id: 'zero-query-last-commit',    repo: 'zero-query',           kind: 'last-commit', label: 'last commit' },
  { id: 'zero-server-last-commit',   repo: 'zero-server',          kind: 'last-commit', label: 'last commit' },
  { id: 'zero-transfer-last-commit', repo: 'zero-transfer',        kind: 'last-commit', label: 'last commit' },
  { id: 'molex-media-release',       repo: 'molex-media-electron', kind: 'release',     label: 'release' },
  { id: 'molex-media-downloads',     repo: 'molex-media-electron', kind: 'downloads',   label: 'downloads' },
  { id: 'molex-media-last-commit',   repo: 'molex-media-electron', kind: 'last-commit', label: 'last commit' },
  { id: 'bladewake-build',           repo: 'bladewake-demo',       kind: 'release',     label: 'build', prerelease: true },
  { id: 'bladewake-downloads',       repo: 'bladewake-demo',       kind: 'downloads',   label: 'downloads' },
  { id: 'bladewake-last-commit',     repo: 'bladewake-demo',       kind: 'last-commit', label: 'last commit' },
];

async function gh(p) {
  const r = await fetch(`https://api.github.com${p}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent':  'tonywied17-badge-gen',
      Accept:        'application/vnd.github+json',
    },
  });
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status} ${r.statusText}`);
  return r.json();
}

function fmtRelative(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)       return 'just now';
  if (diff < 3600)     return `${Math.floor(diff/60)} minutes ago`;
  if (diff < 86400)    return `${Math.floor(diff/3600)} hours ago`;
  if (diff < 604800)   return `${Math.floor(diff/86400)} days ago`;
  if (diff < 2592000)  return `${Math.floor(diff/604800)} weeks ago`;
  if (diff < 31536000) return `${Math.floor(diff/2592000)} months ago`;
  return                       `${Math.floor(diff/31536000)} years ago`;
}

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

async function getValue(b) {
  if (b.kind === 'last-commit') {
    const commits = await gh(`/repos/${OWNER}/${b.repo}/commits?per_page=1`);
    return fmtRelative(commits[0].commit.committer.date);
  }
  if (b.kind === 'release') {
    if (b.prerelease) {
      const list = await gh(`/repos/${OWNER}/${b.repo}/releases?per_page=1`);
      return list[0]?.tag_name ?? 'none';
    }
    try {
      const r = await gh(`/repos/${OWNER}/${b.repo}/releases/latest`);
      return r.tag_name;
    } catch {
      return 'none';
    }
  }
  if (b.kind === 'downloads') {
    let total = 0, page = 1;
    while (true) {
      const list = await gh(`/repos/${OWNER}/${b.repo}/releases?per_page=100&page=${page}`);
      if (!list.length) break;
      for (const r of list) for (const a of r.assets) total += a.download_count;
      if (list.length < 100) break;
      page++;
    }
    return fmtNum(total);
  }
  throw new Error(`unknown kind: ${b.kind}`);
}

// Verdana 11px width approximation. Good enough for flat-square layout.
function textWidth(s) {
  let w = 0;
  for (const c of s) {
    if (/[ijl.,:;'!|]/.test(c))      w += 3;
    else if (c === ' ')              w += 4;
    else if (/[A-Z0-9#@%&]/.test(c)) w += 8;
    else                             w += 7;
  }
  return w;
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

function svg({ label, message, labelColor, messageColor, textColor }) {
  const PAD = 10;
  const lw  = textWidth(label)   + PAD;
  const mw  = textWidth(message) + PAD;
  const w   = lw + mw;
  const lx  = lw / 2;
  const mx  = lw + mw / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(message)}">
  <rect width="${lw}" height="20" fill="${labelColor}"/>
  <rect x="${lw}" width="${mw}" height="20" fill="${messageColor}"/>
  <g fill="${textColor}" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lx}" y="14">${escapeXml(label)}</text>
    <text x="${mx}" y="14">${escapeXml(message)}</text>
  </g>
</svg>
`;
}

mkdirSync(OUT, { recursive: true });

const manifest = {};
for (const b of BADGES) {
  try {
    const message = await getValue(b);
    const dark  = svg({ label: b.label, message, labelColor: '#21262d', messageColor: '#0d1117', textColor: '#ffffff' });
    const light = svg({ label: b.label, message, labelColor: '#d0d7de', messageColor: '#ffffff', textColor: '#1f2328' });
    writeFileSync(path.join(OUT, `${b.id}-dark.svg`),  dark);
    writeFileSync(path.join(OUT, `${b.id}-light.svg`), light);
    manifest[b.id] = createHash('sha1').update(dark + light).digest('hex').slice(0, 8);
    console.log(`ok  ${b.id.padEnd(30)} ${message}`);
  } catch (e) {
    console.error(`err ${b.id.padEnd(30)} ${e.message}`);
  }
}

const README = 'README.md';
let readme = readFileSync(README, 'utf8');
for (const [id, hash] of Object.entries(manifest)) {
  const re = new RegExp(`(${OUT.replace(/[/.]/g, '\\$&')}/${id}-(?:dark|light)\\.svg)(\\?v=[a-f0-9]+)?`, 'g');
  readme = readme.replace(re, `$1?v=${hash}`);
}
writeFileSync(README, readme);
console.log('README updated with cache-busting hashes');
