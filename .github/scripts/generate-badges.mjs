#!/usr/bin/env node

import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
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
  // Header pill badges
  { id: 'header-resume', kind: 'header-link', label: 'Resume', value: 'visit',                  icon: 'resume', accentA: '#f59e0b', accentB: '#ef4444' },
  { id: 'header-repos',  kind: 'header-link', label: 'Repos',  source: 'user-repos',            icon: 'github', accentA: '#60a5fa', accentB: '#2563eb' },
  { id: 'header-gists',  kind: 'header-link', label: 'Gists',  source: 'user-gists',            icon: 'gist',   accentA: '#a78bfa', accentB: '#7c3aed' },
  { id: 'header-npm',    kind: 'header-link', label: 'npm packages',    source: 'npm-packages', npmUser: 'molex222', icon: 'npm-pkg', accentA: '#f87171', accentB: '#dc2626' },

  // websites
  { id: 'zero-query-site',    kind: 'static-pair', label: 'website', message: 'visit', icon: 'globe' },
  { id: 'zero-server-site',   kind: 'static-pair', label: 'website', message: 'visit', icon: 'globe' },
  { id: 'zero-transfer-site', kind: 'static-pair', label: 'website', message: 'visit', icon: 'globe' },
  { id: 'molex-media-site',   kind: 'static-pair', label: 'website', message: 'visit', icon: 'globe' },

  // docs
  { id: 'zero-query-docs',    kind: 'static-pair', label: 'docs', message: 'API', icon: 'book' },
  { id: 'zero-server-docs',   kind: 'static-pair', label: 'docs', message: 'z-server.dev', icon: 'book', theme: ZSERVER_THEME('#7c3aed', '#ffffff') },
  { id: 'zero-transfer-docs', kind: 'static-pair', label: 'docs', message: 'typedoc', icon: 'book', theme: ZTRANSFER_THEME('#00b4d8', '#0d1117') },

  // npm version
  { id: 'zero-query-npm',    kind: 'npm-version', label: 'npm', pkg: 'zero-query',         icon: 'npm', theme: ZQUERY_THEME('#007acc', '#ffffff') },
  { id: 'zero-server-npm',   kind: 'npm-version', label: 'npm', pkg: '@zero-server/sdk',   icon: 'npm', theme: ZSERVER_THEME('#7c3aed', '#ffffff') },
  { id: 'zero-transfer-npm', kind: 'npm-version', label: 'npm', pkg: '@zero-transfer/sdk', icon: 'npm', theme: ZTRANSFER_THEME('#00b4d8', '#0d1117') },

  // npm monthly downloads
  { id: 'zero-query-dm',    kind: 'npm-dm', label: 'downloads', pkg: 'zero-query',         icon: 'npm', theme: ZQUERY_THEME('#0288d1', '#ffffff') },
  { id: 'zero-server-dm',   kind: 'npm-dm', label: 'downloads', pkg: '@zero-server/sdk',   icon: 'npm', theme: ZSERVER_THEME('#6366f1', '#ffffff') },
  { id: 'zero-transfer-dm', kind: 'npm-dm', label: 'downloads', pkg: '@zero-transfer/sdk', icon: 'npm', theme: ZTRANSFER_THEME('#0096c7', '#ffffff') },

  // static call-to-action pairs
  { id: 'molex-media-download', kind: 'static-pair', label: 'download', message: 'latest',  icon: 'github' },
  { id: 'bladewake-download',   kind: 'static-pair', label: 'download', message: 'latest',  icon: 'github', theme: { name: 'game', labelBg: '#0a0510', labelFg: '#22d4f0', messageColor: '#22d4f0', textColor: '#0a0510' } },
  { id: 'bladewake-feedback',   kind: 'static-pair', label: 'feedback', message: 'welcome', icon: 'github', theme: { name: 'game', labelBg: '#0a0510', labelFg: '#22d4f0', messageColor: '#22d4f0', textColor: '#0a0510' } },

  // zero-server static facts (tests/coverage/node/sdk-name update manually as project changes)
  { id: 'zero-server-sdk-name', kind: 'static-pair', label: 'npm',      message: '@zero-server/sdk', icon: 'npm',    theme: ZSERVER_THEME('#1a1b3a', '#a78bfa') },
  { id: 'zero-server-tests',    kind: 'static-pair', label: 'tests',    message: '8016 passing',    icon: 'github', theme: ZSERVER_THEME('#3b82f6', '#ffffff') },
  { id: 'zero-server-coverage', kind: 'static-pair', label: 'coverage', message: '95.86%',          icon: 'github', theme: ZSERVER_THEME('#6366f1', '#ffffff') },
  { id: 'zero-server-node',     kind: 'static-pair', label: 'node',     message: '>=18',            icon: 'github', theme: ZSERVER_THEME('#a78bfa', '#1a1b3a') },

  // zero-query static facts
  { id: 'zero-query-github',    kind: 'static-pair', label: 'GitHub',       message: 'zero-query', icon: 'github', theme: ZQUERY_THEME('#0a1929', '#4fc3f7') },
  { id: 'zero-query-deps',      kind: 'static-pair', label: 'dependencies', message: '0',          icon: 'npm',    theme: ZQUERY_THEME('#4fc3f7', '#0a1929') },
  { id: 'zero-query-vscode',    kind: 'static-pair', label: 'VS Code',      message: 'extension',  icon: 'github', theme: ZQUERY_THEME('#007acc', '#ffffff') },

  // zero-transfer static facts
  { id: 'zero-transfer-sdk-name', kind: 'static-pair', label: 'npm',      message: '@zero-transfer/sdk', icon: 'npm',    theme: ZTRANSFER_THEME('#0d1117', '#00b4d8') },
  { id: 'zero-transfer-tests',    kind: 'static-pair', label: 'tests',    message: '808 passing',        icon: 'github', theme: ZTRANSFER_THEME('#00b4d8', '#0d1117') },
  { id: 'zero-transfer-coverage', kind: 'static-pair', label: 'coverage', message: '96.3%',              icon: 'github', theme: ZTRANSFER_THEME('#0096c7', '#ffffff') },
  { id: 'zero-transfer-node',     kind: 'static-pair', label: 'node',     message: '>=20',               icon: 'github', theme: ZTRANSFER_THEME('#48cae4', '#0d1117') },

  // GitHub-API badges
  { id: 'zero-query-last-commit',    repo: 'zero-query',           kind: 'last-commit', label: 'last commit', icon: 'git',    theme: ZQUERY_THEME('#4fc3f7', '#0a1929') },
  { id: 'zero-server-last-commit',   repo: 'zero-server',          kind: 'last-commit', label: 'last commit', icon: 'git',    theme: ZSERVER_THEME('#a78bfa', '#1a1b3a') },
  { id: 'zero-transfer-last-commit', repo: 'zero-transfer',        kind: 'last-commit', label: 'last commit', icon: 'git',    theme: ZTRANSFER_THEME('#48cae4', '#0d1117') },
  { id: 'zero-transfer-ci',          repo: 'zero-transfer',        kind: 'workflow',    label: 'CI',          workflow: 'ci.yml', branch: 'main', icon: 'github', theme: ZTRANSFER_THEME('#00b4d8', '#0d1117') },
  { id: 'zero-transfer-license',     repo: 'zero-transfer',        kind: 'license',     label: 'license',     icon: 'github', theme: ZTRANSFER_THEME('#0096c7', '#ffffff') },
  { id: 'zero-query-ci',             repo: 'zero-query',           kind: 'workflow',    label: 'CI',          workflow: 'ci.yml',    branch: 'main', icon: 'github', theme: ZQUERY_THEME('#007acc', '#ffffff') },
  { id: 'zero-query-license',        repo: 'zero-query',           kind: 'license',     label: 'license',     icon: 'github', theme: ZQUERY_THEME('#0288d1', '#ffffff') },
  { id: 'zero-server-ci',            repo: 'zero-server',          kind: 'workflow',    label: 'CI',          workflow: 'ci.yml',    branch: 'main', icon: 'github', theme: ZSERVER_THEME('#7c3aed', '#ffffff') },
  { id: 'zero-server-license',       repo: 'zero-server',          kind: 'license',     label: 'license',     icon: 'github', theme: ZSERVER_THEME('#6366f1', '#ffffff') },
  { id: 'molex-media-release',       repo: 'molex-media-electron', kind: 'release',     label: 'release',     icon: 'github', theme: MOLEX_THEME('#7c3aed', '#ffffff') },
  { id: 'molex-media-downloads',     repo: 'molex-media-electron', kind: 'downloads',   label: 'downloads',   icon: 'github', theme: MOLEX_THEME('#4f46e5', '#ffffff') },
  { id: 'molex-media-last-commit',   repo: 'molex-media-electron', kind: 'last-commit', label: 'last commit', icon: 'git',    theme: MOLEX_THEME('#a78bfa', '#1a0b2e') },
  { id: 'molex-media-license',       repo: 'molex-media-electron', kind: 'license',     label: 'license',     icon: 'github', theme: MOLEX_THEME('#8b5cf6', '#ffffff') },
  { id: 'molex-media-ci',            repo: 'molex-media-electron', kind: 'workflow',    label: 'CI',    workflow: 'ci.yml',    branch: 'main', icon: 'github', theme: MOLEX_THEME('#7c3aed', '#ffffff') },
  { id: 'molex-media-build',         repo: 'molex-media-electron', kind: 'workflow',    label: 'build', workflow: 'build.yml', branch: 'main', icon: 'github', theme: MOLEX_THEME('#7c3aed', '#ffffff') },
  { id: 'bladewake-build',           repo: 'bladewake-demo',       kind: 'release',     label: 'build', prerelease: true, icon: 'github', theme: { name: 'game', labelBg: '#0a0510', labelFg: '#22d4f0', messageColor: '#22d4f0', textColor: '#0a0510' } },
  { id: 'bladewake-downloads',       repo: 'bladewake-demo',       kind: 'downloads',   label: 'downloads',   icon: 'github', theme: { name: 'game', labelBg: '#0a0510', labelFg: '#22d4f0', messageColor: '#d020e8', textColor: '#ffffff' } },
  { id: 'bladewake-last-commit',     repo: 'bladewake-demo',       kind: 'last-commit', label: 'last commit', icon: 'git',    theme: { name: 'game', labelBg: '#0a0510', labelFg: '#22d4f0', messageColor: '#8b11a8', textColor: '#ffffff' } },

  // MagnifyShit (C++ Windows magnifier)
  { id: 'magnifyshit-ci',          repo: 'MagnifyShit-cpp', kind: 'workflow',    label: 'build',       workflow: 'build.yml', branch: 'main', icon: 'github', theme: MAGNIFY_THEME('#6b3410', '#f5deb3') },
  { id: 'magnifyshit-release',     repo: 'MagnifyShit-cpp', kind: 'release',     label: 'release',                                              icon: 'github', theme: MAGNIFY_THEME('#8b4513', '#f5deb3') },
  { id: 'magnifyshit-downloads',   repo: 'MagnifyShit-cpp', kind: 'downloads',   label: 'downloads',                                            icon: 'github', theme: MAGNIFY_THEME('#a0522d', '#fff8dc') },
  { id: 'magnifyshit-last-commit', repo: 'MagnifyShit-cpp', kind: 'last-commit', label: 'last commit',                                          icon: 'git',    theme: MAGNIFY_THEME('#5a3a22', '#d4a574') },
  { id: 'magnifyshit-license',     repo: 'MagnifyShit-cpp', kind: 'license',     label: 'license',                                              icon: 'github', theme: MAGNIFY_THEME('#7b4a1f', '#f5deb3') },
];

// Molex Media app palette: deep purple label half with violet accent text.
function MOLEX_THEME(messageColor, textColor) {
  return { name: 'molex', labelBg: '#1a0b2e', labelFg: '#c4b5fd', messageColor, textColor };
}

// zero-server palette: deep indigo label half with bright violet accent (matches logo lightning bolt).
function ZSERVER_THEME(messageColor, textColor) {
  return { name: 'zserver', labelBg: '#1a1b3a', labelFg: '#a78bfa', messageColor, textColor };
}

// zero-query palette: dark navy label half with bright blue accent text.
function ZQUERY_THEME(messageColor, textColor) {
  return { name: 'zquery', labelBg: '#0a1929', labelFg: '#4fc3f7', messageColor, textColor };
}

// zero-transfer palette: deep slate label with cyan accent (matches logo orb).
function ZTRANSFER_THEME(messageColor, textColor) {
  return { name: 'ztransfer', labelBg: '#0d1117', labelFg: '#00b4d8', messageColor, textColor };
}

// MagnifyShit palette: deep poop-brown label with warm tan accent (on-brand for the name).
function MAGNIFY_THEME(messageColor, textColor) {
  return { name: 'magnify', labelBg: '#3a2418', labelFg: '#d4a574', messageColor, textColor };
}

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

async function fetchJson(url, opts = {}) {
  const headers = { 'User-Agent': 'tonywied17-badge-gen', ...(opts.headers || {}) };
  const r = await fetch(url, { ...opts, headers });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status} ${r.statusText}`);
  return r.json();
}

function fmtRelative(iso) {
  const then = new Date(iso);
  const now  = new Date();
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.floor((startOfDay(now) - startOfDay(then)) / 86400000);
  if (dayDiff <= 0)    return 'today';
  if (dayDiff === 1)   return 'yesterday';
  if (dayDiff < 7)     return `${dayDiff} days ago`;
  if (dayDiff < 14)    return 'last week';
  if (dayDiff < 30)    return `${Math.floor(dayDiff/7)} weeks ago`;
  if (dayDiff < 60)    return 'last month';
  if (dayDiff < 365)   return `${Math.floor(dayDiff/30)} months ago`;
  if (dayDiff < 730)   return 'last year';
  return `${Math.floor(dayDiff/365)} years ago`;
}

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

async function getValue(b) {
  if (b.kind === 'header-link') {
    if (!b.source) return b.value ?? '';
    if (b.source === 'user-repos') {
      const u = await gh(`/users/${OWNER}`);
      return String(u.public_repos);
    }
    if (b.source === 'user-gists') {
      const list = await gh(`/users/${OWNER}/gists?per_page=100`);
      return String(list.length);
    }
    if (b.source === 'npm-packages') {
      // npmjs.com/~user JSON endpoint (x-spiferack: 1) is the authoritative
      // count shown on the profile - it includes packages reachable through
      // org membership that the maintainer-search API misses. Cloudflare
      // blocks Node's fetch on TLS fingerprint, so use curl which both Windows
      // and Linux Actions runners ship with.
      try {
        const out = execFileSync('curl', [
          '-sSL', '--max-time', '15',
          '-H', 'x-spiferack: 1',
          '-H', 'accept: application/json',
          '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          `https://www.npmjs.com/~${b.npmUser}`,
        ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const j = JSON.parse(out);
        if (j?.packages?.total != null) return String(j.packages.total);
      } catch { /* fall through to registry search */ }
      const r = await fetchJson(`https://registry.npmjs.org/-/v1/search?text=maintainer:${b.npmUser}&size=250`);
      return String(r.total ?? (r.objects?.length ?? 0));
    }
    return b.value ?? '';
  }
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
  if (b.kind === 'license') {
    const r = await gh(`/repos/${OWNER}/${b.repo}/license`);
    return r.license?.spdx_id ?? 'unknown';
  }
  if (b.kind === 'workflow') {
    const branch = b.branch ?? 'main';
    const runs = await gh(`/repos/${OWNER}/${b.repo}/actions/workflows/${b.workflow}/runs?branch=${branch}&per_page=1`);
    const run = runs.workflow_runs?.[0];
    if (!run) return 'no runs';
    if (run.status !== 'completed') return run.status.replace('_', ' ');
    return run.conclusion ?? 'unknown';
  }
  throw new Error(`unknown kind: ${b.kind}`);
}

// Verdana 11px width approximation
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

// 22px header-pill icons (positioned by the header renderer).
const HEADER_ICONS = {
  resume: c => `<g fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/></g>`,
  github: c => `<path fill="${c}" d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.02c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.1-.75.08-.74.08-.74 1.21.09 1.85 1.24 1.85 1.24 1.08 1.85 2.83 1.32 3.52 1.01.11-.78.42-1.32.76-1.62-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z"/>`,
  gist:   c => `<g fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></g>`,
  'npm-pkg': c => `<path fill="${c}" d="M2 7v10h6v-7h3v7h11V7H2zm5 8H5V9h2v6zm8 0h-2V9h-2v6h-2V9h6v6z"/>`,
};

/**
 * Render an animated pill-style header badge SVG with the stat value baked in.
 */
function svgHeader({ label, value, icon, accentA, accentB, dark, id }) {
  const W = 180, H = 44;
  const RX = 12;
  const ink = dark ? '#e6e9f1' : '#0b1220';
  const muted = dark ? '#94a3b8' : '#5b6472';
  const surfaceA = dark ? '#11151f' : '#ffffff';
  const surfaceB = dark ? '#0a0d14' : '#f7f8fb';
  const border = dark ? '#1f2533' : '#e4e7ee';
  const bx = 1, by = 1, bw = W - 2, bh = H - 2, br = RX - 0.5;
  const borderD = `M ${bx + br} ${by} H ${bx + bw - br} A ${br} ${br} 0 0 1 ${bx + bw} ${by + br} V ${by + bh - br} A ${br} ${br} 0 0 1 ${bx + bw - br} ${by + bh} H ${bx + br} A ${br} ${br} 0 0 1 ${bx} ${by + bh - br} V ${by + br} A ${br} ${br} 0 0 1 ${bx + br} ${by} Z`;
  const iconSvg = HEADER_ICONS[icon] ? HEADER_ICONS[icon](accentA) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${surfaceA}"/>
      <stop offset="100%" stop-color="${surfaceB}"/>
    </linearGradient>
    <linearGradient id="ac-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accentA}"/>
      <stop offset="100%" stop-color="${accentB}"/>
    </linearGradient>
    <linearGradient id="tint-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accentA}" stop-opacity="${dark ? 0.18 : 0.10}"/>
      <stop offset="100%" stop-color="${accentA}" stop-opacity="0"/>
    </linearGradient>
    <path id="bd-${id}" d="${borderD}" fill="none"/>
    <clipPath id="clip-${id}"><rect x="0" y="0" width="${W}" height="${H}" rx="${RX}" ry="${RX}"/></clipPath>
  </defs>

  <rect x="0" y="0" width="${W}" height="${H}" rx="${RX}" ry="${RX}" fill="url(#bg-${id})"/>
  <rect x="0" y="0" width="${W}" height="${H}" rx="${RX}" ry="${RX}" fill="url(#tint-${id})"/>

  <use href="#bd-${id}" stroke="${border}" stroke-width="1"/>
  <use href="#bd-${id}" stroke="url(#ac-${id})" stroke-width="1.2" stroke-opacity="0.55"/>
  <use href="#bd-${id}" stroke="url(#ac-${id})" stroke-width="2" stroke-dasharray="55 380" stroke-linecap="round">
    <animate attributeName="stroke-dashoffset" from="0" to="-435" dur="5.5s" repeatCount="indefinite"/>
  </use>

  <g clip-path="url(#clip-${id})">
    <circle r="1.9" fill="${accentA}"><animateMotion dur="5s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
    <circle r="1.5" fill="${accentB}"><animateMotion dur="5s" begin="-1.25s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
    <circle r="1.3" fill="${accentA}" opacity="0.75"><animateMotion dur="5s" begin="-2.5s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
    <circle r="1" fill="${accentB}" opacity="0.7"><animateMotion dur="5s" begin="-3.75s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
  </g>

  <g transform="translate(14 11)">
    <rect x="-2" y="-2" width="28" height="26" rx="7" fill="${accentA}" fill-opacity="${dark ? 0.14 : 0.10}" stroke="${accentA}" stroke-opacity="0.35"/>
    <g transform="translate(0 0) scale(${24/24})" >
      <svg viewBox="0 0 24 24" width="24" height="24">${iconSvg}</svg>
    </g>
  </g>

  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">
    <text x="54" y="24" font-size="18" font-weight="800" fill="${ink}" letter-spacing="-0.3">${escapeXml(value)}</text>
    <text x="54" y="36" font-size="9.5" font-weight="700" fill="${muted}" letter-spacing="1.6">${escapeXml(label.toUpperCase())}</text>
  </g>
</svg>
`;
}


const ICON_EXTRA = 18; // 14px icon + 4px gap before label text

function svg({ label, message, labelColor, messageColor, textColor, labelTextColor, icon, iconColor }) {
  const PAD = 10;
  const lw  = textWidth(label)   + PAD + (icon ? ICON_EXTRA : 0);
  const mw  = textWidth(message) + PAD;
  const w   = lw + mw;
  const lx  = icon ? (PAD / 2 + ICON_EXTRA + textWidth(label) / 2) : lw / 2;
  const mx  = lw + mw / 2;
  const labelFill = labelTextColor ?? textColor;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(message)}">
  <rect width="${lw}" height="20" fill="${labelColor}"/>
  <rect x="${lw}" width="${mw}" height="20" fill="${messageColor}"/>${icon ? '\n  ' + ICONS[icon](iconColor) : ''}
  <g font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
    <text x="${lx}" y="14" fill="${labelFill}">${escapeXml(label)}</text>
    <text x="${mx}" y="14" fill="${textColor}">${escapeXml(message)}</text>
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
    let dark, light, themed;
    if (b.kind === 'header-link') {
      dark  = svgHeader({ label: b.label, value: message, icon: b.icon, accentA: b.accentA, accentB: b.accentB, dark: true,  id: b.id + '-d' });
      light = svgHeader({ label: b.label, value: message, icon: b.icon, accentA: b.accentA, accentB: b.accentB, dark: false, id: b.id + '-l' });
    } else if (b.kind === 'static-single') {
      dark  = svgSingle({ message, color: '#21262d', textColor: '#ffffff', icon: b.icon, iconColor: '#ffffff' });
      light = svgSingle({ message, color: '#d0d7de', textColor: '#1f2328', icon: b.icon, iconColor: '#1f2328' });
      if (b.theme) {
        themed = svgSingle({
          message,
          color: b.theme.messageColor,
          textColor: b.theme.textColor,
          icon: b.icon,
          iconColor: b.theme.textColor,
        });
      }
    } else {
      dark  = svg({ label: b.label, message, labelColor: '#21262d', messageColor: '#0d1117', textColor: '#ffffff', icon: b.icon, iconColor: '#ffffff' });
      light = svg({ label: b.label, message, labelColor: '#d0d7de', messageColor: '#ffffff', textColor: '#1f2328', icon: b.icon, iconColor: '#1f2328' });
      if (b.theme) {
        themed = svg({
          label: b.label,
          message,
          labelColor: b.theme.labelBg,
          messageColor: b.theme.messageColor,
          textColor: b.theme.textColor,
          labelTextColor: b.theme.labelFg,
          icon: b.icon,
          iconColor: b.theme.labelFg,
        });
      }
    }
    writeFileSync(path.join(OUT, `${b.id}-dark.svg`),  dark);
    writeFileSync(path.join(OUT, `${b.id}-light.svg`), light);
    if (themed) writeFileSync(path.join(OUT, `${b.id}-${b.theme.name}.svg`), themed);
    const hashInput = dark + light + (themed ?? '');
    manifest[b.id] = createHash('sha1').update(hashInput).digest('hex').slice(0, 8);
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

const EXTERNAL_REPOS = [
  { repo: 'molex-media-electron', branch: 'main', readme: 'README.md' },
  { repo: 'bladewake-demo',       branch: 'main', readme: 'README.md' },
  { repo: 'zero-server',          branch: 'main', readme: 'README.md' },
  { repo: 'zero-query',           branch: 'main', readme: 'README.md' },
  { repo: 'zero-transfer',        branch: 'main', readme: 'README.md' },
  { repo: 'MagnifyShit-cpp',      branch: 'main', readme: 'README.md' },
];

if (process.env.SYNC_EXTERNAL === '1') {
  const work = path.join(tmpdir(), 'badge-sync');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  for (const ext of EXTERNAL_REPOS) {
    const dir = path.join(work, ext.repo);
    const url = `https://x-access-token:${TOKEN}@github.com/${OWNER}/${ext.repo}.git`;
    try {
      execFileSync('git', ['clone', '--depth=1', '--branch', ext.branch, url, dir], { stdio: 'inherit' });
      const readmePath = path.join(dir, ext.readme);
      if (!existsSync(readmePath)) {
        console.error(`skip ${ext.repo}: ${ext.readme} not found`);
        continue;
      }
      let content = readFileSync(readmePath, 'utf8');
      const before = content;
      for (const [id, hash] of Object.entries(manifest)) {
        const re = new RegExp(`(${OUT.replace(/[/.]/g, '\\$&')}/${id}-[a-z]+\\.svg)(\\?v=[a-z0-9]+)?`, 'g');
        content = content.replace(re, `$1?v=${hash}`);
      }
      if (content === before) {
        console.log(`unchanged ${ext.repo}`);
        continue;
      }
      writeFileSync(readmePath, content);
      const run = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'inherit' });
      run('config', 'user.name',  'github-actions[bot]');
      run('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
      run('add', ext.readme);
      run('commit', '-m', 'chore(badges): refresh cache-bust hashes [skip ci]');
      run('push', 'origin', ext.branch);
      console.log(`pushed ${ext.repo}`);
    } catch (e) {
      console.error(`err ${ext.repo}: ${e.message}`);
    }
  }

  rmSync(work, { recursive: true, force: true });
}
