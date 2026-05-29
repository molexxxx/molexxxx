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
  // websites (single-block)
  { id: 'zero-query-site',    kind: 'static-single', message: 'z-query.com',       icon: 'globe' },
  { id: 'zero-server-site',   kind: 'static-single', message: 'z-server.dev',      icon: 'globe' },
  { id: 'zero-transfer-site', kind: 'static-single', message: 'zero-transfer',     icon: 'globe' },
  { id: 'molex-media-site',   kind: 'static-single', message: 'media.molex.cloud', icon: 'globe' },

  // docs
  { id: 'zero-query-docs',    kind: 'static-pair', label: 'docs', message: 'API', icon: 'book' },
  { id: 'zero-server-docs',   kind: 'static-pair', label: 'docs', message: 'API', icon: 'book' },
  { id: 'zero-transfer-docs', kind: 'static-pair', label: 'docs', message: 'API', icon: 'book' },

  // npm version
  { id: 'zero-query-npm',    kind: 'npm-version', label: 'npm', pkg: 'zero-query',         icon: 'npm' },
  { id: 'zero-server-npm',   kind: 'npm-version', label: 'npm', pkg: '@zero-server/sdk',   icon: 'npm' },
  { id: 'zero-transfer-npm', kind: 'npm-version', label: 'npm', pkg: '@zero-transfer/sdk', icon: 'npm' },

  // npm monthly downloads
  { id: 'zero-query-dm',    kind: 'npm-dm', label: 'downloads', pkg: 'zero-query',         icon: 'npm' },
  { id: 'zero-server-dm',   kind: 'npm-dm', label: 'downloads', pkg: '@zero-server/sdk',   icon: 'npm' },
  { id: 'zero-transfer-dm', kind: 'npm-dm', label: 'downloads', pkg: '@zero-transfer/sdk', icon: 'npm' },

  // static call-to-action pairs
  { id: 'molex-media-download', kind: 'static-pair', label: 'download', message: 'latest',  icon: 'github' },
  { id: 'bladewake-download',   kind: 'static-pair', label: 'download', message: 'latest',  icon: 'github' },
  { id: 'bladewake-feedback',   kind: 'static-pair', label: 'feedback', message: 'welcome', icon: 'github' },

  // GitHub-API badges
  { id: 'zero-query-last-commit',    repo: 'zero-query',           kind: 'last-commit', label: 'last commit', icon: 'git' },
  { id: 'zero-server-last-commit',   repo: 'zero-server',          kind: 'last-commit', label: 'last commit', icon: 'git' },
  { id: 'zero-transfer-last-commit', repo: 'zero-transfer',        kind: 'last-commit', label: 'last commit', icon: 'git' },
  { id: 'molex-media-release',       repo: 'molex-media-electron', kind: 'release',     label: 'release',     icon: 'github' },
  { id: 'molex-media-downloads',     repo: 'molex-media-electron', kind: 'downloads',   label: 'downloads',   icon: 'github' },
  { id: 'molex-media-last-commit',   repo: 'molex-media-electron', kind: 'last-commit', label: 'last commit', icon: 'git' },
  { id: 'bladewake-build',           repo: 'bladewake-demo',       kind: 'release',     label: 'build', prerelease: true, icon: 'github' },
  { id: 'bladewake-downloads',       repo: 'bladewake-demo',       kind: 'downloads',   label: 'downloads',   icon: 'github' },
  { id: 'bladewake-last-commit',     repo: 'bladewake-demo',       kind: 'last-commit', label: 'last commit', icon: 'git' },
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

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'tonywied17-badge-gen' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status} ${r.statusText}`);
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
  if (b.kind === 'static-single' || b.kind === 'static-pair') {
    return b.message;
  }
  if (b.kind === 'npm-version') {
    const r = await fetchJson(`https://registry.npmjs.org/${b.pkg}/latest`);
    return `v${r.version}`;
  }
  if (b.kind === 'npm-dm') {
    const r = await fetchJson(`https://api.npmjs.org/downloads/point/last-month/${b.pkg}`);
    return `${fmtNum(r.downloads)}/month`;
  }
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

// 14x14 inline SVG icons. Each takes a CSS color and returns a self-contained
// <svg> element positioned at x=5, y=3 inside the parent badge.
const ICONS = {
  globe:  c => `<svg x="5" y="3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9z"/></svg>`,
  book:   c => `<svg x="5" y="3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  npm:    c => `<svg x="5" y="3" width="14" height="14" viewBox="0 0 24 24" fill="${c}"><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0H1.763zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113L5.13 5.323z"/></svg>`,
  github: c => `<svg x="5" y="3" width="14" height="14" viewBox="0 0 24 24" fill="${c}"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`,
  git:    c => `<svg x="5" y="3" width="14" height="14" viewBox="0 0 24 24" fill="${c}"><path d="M23.546 10.93L13.067.452c-.604-.603-1.582-.603-2.188 0L8.708 2.627l2.76 2.76c.645-.215 1.379-.07 1.889.441.516.515.658 1.258.438 1.9l2.658 2.66c.645-.223 1.387-.078 1.9.435.721.72.721 1.884 0 2.604-.719.719-1.881.719-2.6 0-.539-.541-.674-1.337-.404-1.996L12.86 8.955v6.525c.176.086.342.203.488.348.713.721.713 1.883 0 2.6-.719.721-1.889.721-2.609 0-.719-.719-.719-1.879 0-2.598.182-.18.387-.316.605-.406V8.835c-.217-.091-.424-.222-.6-.401-.545-.545-.676-1.342-.396-2.009L7.636 3.7.45 10.881c-.6.605-.6 1.584 0 2.189l10.48 10.477c.604.604 1.582.604 2.186 0l10.43-10.43c.605-.603.605-1.582 0-2.187"/></svg>`,
};

const ICON_EXTRA = 18; // 14px icon + 4px gap before label text

function svg({ label, message, labelColor, messageColor, textColor, icon, iconColor }) {
  const PAD = 10;
  const lw  = textWidth(label)   + PAD + (icon ? ICON_EXTRA : 0);
  const mw  = textWidth(message) + PAD;
  const w   = lw + mw;
  const lx  = icon ? (PAD / 2 + ICON_EXTRA + textWidth(label) / 2) : lw / 2;
  const mx  = lw + mw / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(message)}">
  <rect width="${lw}" height="20" fill="${labelColor}"/>
  <rect x="${lw}" width="${mw}" height="20" fill="${messageColor}"/>${icon ? '\n  ' + ICONS[icon](iconColor) : ''}
  <g fill="${textColor}" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lx}" y="14">${escapeXml(label)}</text>
    <text x="${mx}" y="14">${escapeXml(message)}</text>
  </g>
</svg>
`;
}

function svgSingle({ message, color, textColor, icon, iconColor }) {
  const PAD = 10;
  const mw  = textWidth(message) + PAD + (icon ? ICON_EXTRA : 0);
  const tx  = icon ? (PAD / 2 + ICON_EXTRA + textWidth(message) / 2) : mw / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="20" role="img" aria-label="${escapeXml(message)}">
  <rect width="${mw}" height="20" fill="${color}"/>${icon ? '\n  ' + ICONS[icon](iconColor) : ''}
  <g fill="${textColor}" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${tx}" y="14">${escapeXml(message)}</text>
  </g>
</svg>
`;
}

mkdirSync(OUT, { recursive: true });

const manifest = {};
for (const b of BADGES) {
  try {
    const message = await getValue(b);
    let dark, light;
    if (b.kind === 'static-single') {
      dark  = svgSingle({ message, color: '#21262d', textColor: '#ffffff', icon: b.icon, iconColor: '#ffffff' });
      light = svgSingle({ message, color: '#d0d7de', textColor: '#1f2328', icon: b.icon, iconColor: '#1f2328' });
    } else {
      dark  = svg({ label: b.label, message, labelColor: '#21262d', messageColor: '#0d1117', textColor: '#ffffff', icon: b.icon, iconColor: '#ffffff' });
      light = svg({ label: b.label, message, labelColor: '#d0d7de', messageColor: '#ffffff', textColor: '#1f2328', icon: b.icon, iconColor: '#1f2328' });
    }
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
