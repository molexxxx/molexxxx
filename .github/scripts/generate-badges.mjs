#!/usr/bin/env node

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import * as simpleIcons from 'simple-icons';
import { FONT, tokens, escapeXml, fmtNum, plural } from './theme.mjs';

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN)
{
  console.error('GH_TOKEN env var is required');
  process.exit(1);
}

const OWNER = 'molexxxx';
const REPO = 'molexxxx';
const OUT = '.github/badges';
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${OUT}`;

const USER_AGENT = 'molexxxx-badge-gen (https://github.com/molexxxx/molexxxx)';
const FETCH_TIMEOUT_MS = 20000;

const BADGES = [
  // Header cards: live package counts per registry account
  { id: 'header-npm', kind: 'registry-count', label: 'NPM PACKAGES', altName: 'npm', source: 'npm-packages', user: 'molex222', icon: 'npm-pkg' },
  { id: 'header-crates', kind: 'registry-count', label: 'RUST CRATES', altName: 'Rust crates on crates.io', source: 'crates-packages', user: 'tonywied17', icon: 'crates' },
  { id: 'header-nuget', kind: 'registry-count', label: 'NUGET PACKAGES', altName: 'NuGet', source: 'nuget-packages', user: 'tonywied17', icon: 'nuget' },
  { id: 'header-pypi', kind: 'registry-count', label: 'PYPI PACKAGES', altName: 'PyPI', source: 'pypi-packages', user: 'tonywied17', icon: 'pypi' },

  // docs
  { id: 'zero-query-docs', kind: 'static-pair', label: 'docs', message: 'API.md', icon: 'book' },
  { id: 'zero-server-docs', kind: 'static-pair', label: 'docs', message: 'API.md', icon: 'book', theme: ZSERVER_THEME('#7c3aed', '#ffffff') },
  { id: 'zero-transfer-docs', kind: 'static-pair', label: 'docs', message: 'README.md', icon: 'book', theme: ZTRANSFER_THEME('#00b4d8', '#0d1117') },

  // npm version
  { id: 'zero-query-npm', kind: 'npm-version', label: 'npm', pkg: 'zero-query', icon: 'npm', theme: ZQUERY_THEME('#007acc', '#ffffff') },
  { id: 'zero-server-npm', kind: 'npm-version', label: 'npm', pkg: '@zero-server/sdk', icon: 'npm', theme: ZSERVER_THEME('#7c3aed', '#ffffff') },
  { id: 'zero-transfer-npm', kind: 'npm-version', label: 'npm', pkg: '@zero-transfer/sdk', icon: 'npm', theme: ZTRANSFER_THEME('#00b4d8', '#0d1117') },

  // npm lifetime downloads
  { id: 'zero-query-downloads', kind: 'npm-total', label: 'downloads', pkg: 'zero-query', icon: 'npm', theme: ZQUERY_THEME('#0288d1', '#ffffff') },
  { id: 'zero-server-downloads', kind: 'npm-total', label: 'downloads', pkg: '@zero-server/sdk', icon: 'npm', theme: ZSERVER_THEME('#6366f1', '#ffffff') },
  { id: 'zero-transfer-downloads', kind: 'npm-total', label: 'downloads', pkg: '@zero-transfer/sdk', icon: 'npm', theme: ZTRANSFER_THEME('#0096c7', '#ffffff') },

  // static call-to-action pairs
  { id: 'molex-media-download', kind: 'static-pair', label: 'download', message: 'latest', icon: 'github' },
  { id: 'bladewake-download', kind: 'static-pair', label: 'download', message: 'latest', icon: 'github', theme: { name: 'game', labelBg: '#0a0510', labelFg: '#22d4f0', messageColor: '#22d4f0', textColor: '#0a0510' } },
  { id: 'bladewake-feedback', kind: 'static-pair', label: 'feedback', message: 'welcome', icon: 'github', theme: { name: 'game', labelBg: '#0a0510', labelFg: '#22d4f0', messageColor: '#22d4f0', textColor: '#0a0510' } },

  // zero-server static facts (tests/coverage/node/sdk-name update manually as project changes)
  { id: 'zero-server-sdk-name', kind: 'static-pair', label: 'npm', message: '@zero-server/sdk', icon: 'npm', theme: ZSERVER_THEME('#1a1b3a', '#a78bfa') },
  { id: 'zero-server-tests', kind: 'static-pair', label: 'tests', message: '8016 passing', icon: 'github', theme: ZSERVER_THEME('#3b82f6', '#ffffff') },
  { id: 'zero-server-coverage', kind: 'static-pair', label: 'coverage', message: '95.86%', icon: 'github', theme: ZSERVER_THEME('#6366f1', '#ffffff') },
  { id: 'zero-server-node', kind: 'static-pair', label: 'node', message: '>=18', icon: 'github', theme: ZSERVER_THEME('#a78bfa', '#1a1b3a') },

  // zero-query static facts (package/tests/coverage update manually as project changes)
  { id: 'zero-query-package-name', kind: 'static-pair', label: 'npm', message: 'zero-query', icon: 'npm', theme: ZQUERY_THEME('#0a1929', '#4fc3f7') },
  { id: 'zero-query-vscode', kind: 'static-pair', label: 'VS Code', message: 'extension', icon: 'github', theme: ZQUERY_THEME('#007acc', '#ffffff') },
  { id: 'zero-query-tests', kind: 'static-pair', label: 'tests', message: '2561 passing', icon: 'github', theme: ZQUERY_THEME('#29b6f6', '#ffffff') },
  { id: 'zero-query-coverage', kind: 'static-pair', label: 'coverage', message: '91.19%', icon: 'github', theme: ZQUERY_THEME('#0288d1', '#ffffff') },

  // zero-transfer static facts
  { id: 'zero-transfer-sdk-name', kind: 'static-pair', label: 'npm', message: '@zero-transfer/sdk', icon: 'npm', theme: ZTRANSFER_THEME('#0d1117', '#00b4d8') },
  { id: 'zero-transfer-tests', kind: 'static-pair', label: 'tests', message: '808 passing', icon: 'github', theme: ZTRANSFER_THEME('#00b4d8', '#0d1117') },
  { id: 'zero-transfer-coverage', kind: 'static-pair', label: 'coverage', message: '96.3%', icon: 'github', theme: ZTRANSFER_THEME('#0096c7', '#ffffff') },
  { id: 'zero-transfer-node', kind: 'static-pair', label: 'node', message: '>=20', icon: 'github', theme: ZTRANSFER_THEME('#48cae4', '#0d1117') },

  // GitHub-API badges
  { id: 'zero-query-last-commit', repo: 'zero-query', kind: 'last-commit', label: 'last commit', icon: 'git', theme: ZQUERY_THEME('#4fc3f7', '#0a1929') },
  { id: 'zero-server-last-commit', repo: 'zero-server', kind: 'last-commit', label: 'last commit', icon: 'git', theme: ZSERVER_THEME('#a78bfa', '#1a1b3a') },
  { id: 'zero-transfer-last-commit', repo: 'zero-transfer', kind: 'last-commit', label: 'last commit', icon: 'git', theme: ZTRANSFER_THEME('#48cae4', '#0d1117') },
  { id: 'zero-transfer-ci', repo: 'zero-transfer', kind: 'workflow', label: 'CI', workflow: 'ci.yml', branch: 'main', icon: 'github', theme: ZTRANSFER_THEME('#00b4d8', '#0d1117') },
  { id: 'zero-transfer-license', repo: 'zero-transfer', kind: 'license', label: 'license', icon: 'github', theme: ZTRANSFER_THEME('#0096c7', '#ffffff') },
  { id: 'zero-query-ci', repo: 'zero-query', kind: 'workflow', label: 'CI', workflow: 'ci.yml', branch: 'main', icon: 'github', theme: ZQUERY_THEME('#007acc', '#ffffff') },
  { id: 'zero-query-license', repo: 'zero-query', kind: 'license', label: 'license', icon: 'github', theme: ZQUERY_THEME('#0288d1', '#ffffff') },
  { id: 'zero-server-ci', repo: 'zero-server', kind: 'workflow', label: 'CI', workflow: 'ci.yml', branch: 'main', icon: 'github', theme: ZSERVER_THEME('#7c3aed', '#ffffff') },
  { id: 'zero-server-license', repo: 'zero-server', kind: 'license', label: 'license', icon: 'github', theme: ZSERVER_THEME('#6366f1', '#ffffff') },
  { id: 'molex-media-release', repo: 'molex-media-electron', kind: 'release', label: 'release', icon: 'github', theme: MOLEX_THEME('#7c3aed', '#ffffff') },
  { id: 'molex-media-downloads', repo: 'molex-media-electron', kind: 'downloads', label: 'downloads', icon: 'github', theme: MOLEX_THEME('#4f46e5', '#ffffff') },
  { id: 'molex-media-last-commit', repo: 'molex-media-electron', kind: 'last-commit', label: 'last commit', icon: 'git', theme: MOLEX_THEME('#a78bfa', '#1a0b2e') },
  { id: 'molex-media-license', repo: 'molex-media-electron', kind: 'license', label: 'license', icon: 'github', theme: MOLEX_THEME('#8b5cf6', '#ffffff') },
  { id: 'molex-media-ci', repo: 'molex-media-electron', kind: 'workflow', label: 'CI', workflow: 'ci.yml', branch: 'main', icon: 'github', theme: MOLEX_THEME('#7c3aed', '#ffffff') },
  { id: 'molex-media-build', repo: 'molex-media-electron', kind: 'workflow', label: 'build', workflow: 'build.yml', branch: 'main', icon: 'github', theme: MOLEX_THEME('#7c3aed', '#ffffff') },

  // YouTube Downloader (red app theme)
  { id: 'youtube-downloader-repo', kind: 'static-pair', label: 'repo', message: 'visit', icon: 'github', theme: YTDL_THEME('#ef4444', '#ffffff') },
  { id: 'youtube-downloader-download', kind: 'static-pair', label: 'download', message: 'latest', icon: 'github', theme: YTDL_THEME('#dc2626', '#ffffff') },
  { id: 'youtube-downloader-ci', repo: 'youtube-downloader', kind: 'workflow', label: 'CI', workflow: 'ci.yml', branch: 'main', icon: 'github', theme: YTDL_THEME('#ef4444', '#ffffff') },
  { id: 'youtube-downloader-build', repo: 'youtube-downloader', kind: 'workflow', label: 'build', workflow: 'release.yml', branch: false, icon: 'github', theme: YTDL_THEME('#ef4444', '#ffffff') },
  { id: 'youtube-downloader-release', repo: 'youtube-downloader', kind: 'release', label: 'release', icon: 'github', theme: YTDL_THEME('#dc2626', '#ffffff') },
  { id: 'youtube-downloader-license', repo: 'youtube-downloader', kind: 'license', label: 'license', icon: 'github', theme: YTDL_THEME('#f87171', '#1a0508') },
  { id: 'youtube-downloader-downloads', repo: 'youtube-downloader', kind: 'downloads', label: 'downloads', baseline: 329, icon: 'github', theme: YTDL_THEME('#b91c1c', '#ffffff') },
  { id: 'youtube-downloader-last-commit', repo: 'youtube-downloader', kind: 'last-commit', label: 'last commit', icon: 'git', theme: YTDL_THEME('#fca5a5', '#1a0508') },
  { id: 'bladewake-build', repo: 'bladewake-demo', kind: 'release', label: 'build', prerelease: true, icon: 'github', theme: { name: 'game', labelBg: '#0a0510', labelFg: '#22d4f0', messageColor: '#22d4f0', textColor: '#0a0510' } },
  { id: 'bladewake-downloads', repo: 'bladewake-demo', kind: 'downloads', label: 'downloads', icon: 'github', theme: { name: 'game', labelBg: '#0a0510', labelFg: '#22d4f0', messageColor: '#d020e8', textColor: '#ffffff' } },
  { id: 'bladewake-last-commit', repo: 'bladewake-demo', kind: 'last-commit', label: 'last commit', icon: 'git', theme: { name: 'game', labelBg: '#0a0510', labelFg: '#22d4f0', messageColor: '#8b11a8', textColor: '#ffffff' } },

  // MagnifyShit
  { id: 'magnifyshit-docs', kind: 'static-pair', label: 'docs', message: 'README.md', icon: 'book', theme: MAGNIFY_THEME('#8b4513', '#f5deb3') },
  { id: 'magnifyshit-download', kind: 'static-pair', label: 'download', message: 'latest', icon: 'github', theme: MAGNIFY_THEME('#6b3410', '#f5deb3') },
  { id: 'magnifyshit-release', repo: 'MagnifyShit-cpp', kind: 'release', label: 'release', icon: 'github', theme: MAGNIFY_THEME('#8b4513', '#f5deb3') },
  { id: 'magnifyshit-downloads', repo: 'MagnifyShit-cpp', kind: 'downloads', label: 'downloads', icon: 'github', theme: MAGNIFY_THEME('#a0522d', '#fff8dc') },
  { id: 'magnifyshit-license', repo: 'MagnifyShit-cpp', kind: 'license', label: 'license' },
  { id: 'magnifyshit-last-commit', repo: 'MagnifyShit-cpp', kind: 'last-commit', label: 'last commit', icon: 'git', theme: MAGNIFY_THEME('#5a3a22', '#d4a574') },

  // Plex Poster Set Helper 2 (Plex amber/orange theme)
  { id: 'plex-poster-helper-2-repo', kind: 'static-pair', label: 'repo', message: 'visit', icon: 'github', theme: PLEX_THEME('#e5a00d', '#1a1205') },
  { id: 'plex-poster-helper-2-docker', kind: 'static-pair', label: 'docker', message: 'guide', icon: 'book', theme: PLEX_THEME('#cc7b19', '#ffffff') },
  { id: 'plex-poster-helper-2-ci', repo: 'plex-poster-set-helper-2', kind: 'workflow', label: 'CI', workflow: 'ci.yml', branch: 'main', icon: 'github', theme: PLEX_THEME('#e5a00d', '#1a1205') },
  { id: 'plex-poster-helper-2-build', repo: 'plex-poster-set-helper-2', kind: 'workflow', label: 'build', workflow: 'build.yml', branch: false, icon: 'github', theme: PLEX_THEME('#c4880a', '#1a1205') },
  { id: 'plex-poster-helper-2-license', repo: 'plex-poster-set-helper-2', kind: 'license', label: 'license', icon: 'github', theme: PLEX_THEME('#f0b429', '#1a1205') },
  { id: 'plex-poster-helper-2-last-commit', repo: 'plex-poster-set-helper-2', kind: 'last-commit', label: 'last commit', icon: 'git', theme: PLEX_THEME('#c4880a', '#ffffff') },
  { id: 'plex-poster-helper-2-release', repo: 'plex-poster-set-helper-2', kind: 'release', label: 'release', icon: 'github', theme: PLEX_THEME('#e5a00d', '#1a1205') },
  { id: 'plex-poster-helper-2-downloads', repo: 'plex-poster-set-helper-2', kind: 'downloads', label: 'downloads', icon: 'github', theme: PLEX_THEME('#f0b429', '#1a1205') },
  { id: 'plex-poster-helper-2-download', kind: 'static-pair', label: 'download', message: 'latest', icon: 'github', theme: PLEX_THEME('#cc7b19', '#ffffff') },

  // pamoja registry versions + CI/license. Versions come from the umbrella packages the profile links to.
  { id: 'pamoja-crates', kind: 'crates', label: 'crates.io', pkg: 'pamoja', theme: PAMOJA_THEME('#1fd3b0', '#0b1124') },
  { id: 'pamoja-npm', kind: 'npm-version', label: 'npm', pkg: 'pamoja', icon: 'npm', theme: PAMOJA_THEME('#1fd3b0', '#0b1124') },
  { id: 'pamoja-pypi', kind: 'pypi', label: 'PyPI', pkg: 'pamoja', theme: PAMOJA_THEME('#1fd3b0', '#0b1124') },
  { id: 'pamoja-nuget', kind: 'nuget', label: 'NuGet', pkg: 'Pamoja', theme: PAMOJA_THEME('#1fd3b0', '#0b1124') },
  { id: 'pamoja-ci', repo: 'pamoja', kind: 'workflow', workflow: 'ci.yml', branch: 'main', label: 'CI', icon: 'github', theme: PAMOJA_THEME('#1fd3b0', '#0b1124') },
  { id: 'pamoja-license', repo: 'pamoja', kind: 'license', label: 'license', icon: 'github', theme: PAMOJA_THEME('#1fd3b0', '#0b1124') },
];

const GH = `https://github.com/${OWNER}`;
const ICON_RAW = `https://raw.githubusercontent.com/${OWNER}`;

/**
 * Project cards, grouped into README sections. Each card shows the project's
 * icon, name, primary language, description, and four live stats read from the
 * badge values fetched above.
 */
const PROJECT_SECTIONS = [
  { id: 'libraries', cards: [
    {
      id: 'card-pamoja', name: 'Pamoja', repo: 'pamoja', tag: 'IN DEVELOPMENT',
      icon: `${ICON_RAW}/pamoja/refs/heads/main/assets/pamoja-icon.svg`,
      description: 'Modular Rust SDK for offline-first IoT, robotics, and edge hardware, with bindings for Node.js, Python, and .NET.',
      stats: [
        { use: 'pamoja-crates', label: 'CRATES.IO' },
        { use: 'pamoja-npm', label: 'NPM' },
        { use: 'pamoja-pypi', label: 'PYPI' },
        { use: 'pamoja-nuget', label: 'NUGET' },
      ],
    },
    {
      id: 'card-zero-query', name: 'zQuery', repo: 'zero-query',
      icon: `${ICON_RAW}/zero-query/main/.github/images/logo-animated.svg`,
      description: 'Frontend library with no runtime dependencies: components, SPA router, store, SSR, and WebRTC.',
      stats: [
        { use: 'zero-query-npm', label: 'NPM' },
        { use: 'zero-query-downloads', label: 'DOWNLOADS' },
        { use: 'zero-query-ci', label: 'CI' },
        { use: 'zero-query-license', label: 'LICENSE' },
      ],
    },
    {
      id: 'card-zero-server', name: 'zero-server', repo: 'zero-server',
      icon: `${ICON_RAW}/zero-server/main/website-docs/public/icons/logo-animated.svg`,
      description: 'Node.js backend framework with no runtime dependencies: routing, ORM, auth, WebSocket, SSE, WebRTC, gRPC, and observability.',
      stats: [
        { use: 'zero-server-npm', label: 'NPM' },
        { use: 'zero-server-downloads', label: 'DOWNLOADS' },
        { use: 'zero-server-ci', label: 'CI' },
        { use: 'zero-server-license', label: 'LICENSE' },
      ],
    },
    {
      id: 'card-zero-transfer', name: 'zero-transfer', repo: 'zero-transfer',
      icon: `${ICON_RAW}/zero-transfer/main/assets/zero-transfer-icon.svg`,
      description: 'TypeScript file-transfer SDK for SFTP, FTPS, S3, Azure, GCS, Google Drive, Dropbox, and WebDAV.',
      stats: [
        { use: 'zero-transfer-npm', label: 'NPM' },
        { use: 'zero-transfer-downloads', label: 'DOWNLOADS' },
        { use: 'zero-transfer-ci', label: 'CI' },
        { use: 'zero-transfer-license', label: 'LICENSE' },
      ],
    },
  ] },
  { id: 'applications', cards: [
    {
      id: 'card-youtube-downloader', name: 'YouTube Downloader', repo: 'youtube-downloader',
      icon: `${ICON_RAW}/youtube-downloader/main/.github/assets/icon.svg`,
      description: 'Desktop YouTube downloader built on yt-dlp and FFmpeg.',
      stats: [
        { use: 'youtube-downloader-release', label: 'RELEASE' },
        { use: 'youtube-downloader-downloads', label: 'DOWNLOADS' },
        { use: 'youtube-downloader-ci', label: 'CI' },
        { use: 'youtube-downloader-last-commit', label: 'UPDATED' },
      ],
    },
    {
      id: 'card-molex-media', name: 'molex Media', repo: 'molex-media-electron',
      icon: `${ICON_RAW}/molex-media-electron/main/.github/assets/icon.svg`,
      description: 'Cross-platform media toolkit built on FFmpeg: batch normalization, conversion, and compression; a timeline editor; and a media player with real-time visualizations.',
      stats: [
        { use: 'molex-media-release', label: 'RELEASE' },
        { use: 'molex-media-downloads', label: 'DOWNLOADS' },
        { use: 'molex-media-ci', label: 'CI' },
        { use: 'molex-media-last-commit', label: 'UPDATED' },
      ],
    },
    {
      id: 'card-plex-poster-helper-2', name: 'Plex Poster Set Helper 2', repo: 'plex-poster-set-helper-2',
      icon: `${ICON_RAW}/plex-poster-set-helper-2/refs/heads/main/.github/assets/logo.svg`,
      description: 'Uploads poster sets from ThePosterDB and MediUX to a Plex server.',
      stats: [
        { use: 'plex-poster-helper-2-release', label: 'RELEASE' },
        { use: 'plex-poster-helper-2-downloads', label: 'DOWNLOADS' },
        { use: 'plex-poster-helper-2-ci', label: 'CI' },
        { use: 'plex-poster-helper-2-last-commit', label: 'UPDATED' },
      ],
    },
    {
      id: 'card-magnifyshit', name: 'MagnifyShit', repo: 'MagnifyShit-cpp',
      icon: `${ICON_RAW}/MagnifyShit-cpp/main/.github/assets/icon.svg`,
      description: 'Windows screen magnifier in C++ using D3D11, DXGI desktop duplication, and ImGui.',
      stats: [
        { use: 'magnifyshit-release', label: 'RELEASE' },
        { use: 'magnifyshit-downloads', label: 'DOWNLOADS' },
        { use: 'magnifyshit-license', label: 'LICENSE' },
        { use: 'magnifyshit-last-commit', label: 'UPDATED' },
      ],
    },
  ] },
];

// Molex Media app palette
function MOLEX_THEME(messageColor, textColor)
{
  return { name: 'molex', labelBg: '#1a0b2e', labelFg: '#c4b5fd', messageColor, textColor };
}

// YouTube Downloader app palette (red)
function YTDL_THEME(messageColor, textColor)
{
  return { name: 'ytdl', labelBg: '#1a0508', labelFg: '#f87171', messageColor, textColor };
}

// zero-server palette
function ZSERVER_THEME(messageColor, textColor)
{
  return { name: 'zserver', labelBg: '#1a1b3a', labelFg: '#a78bfa', messageColor, textColor };
}

// zero-query palette
function ZQUERY_THEME(messageColor, textColor)
{
  return { name: 'zquery', labelBg: '#0a1929', labelFg: '#4fc3f7', messageColor, textColor };
}

// zero-transfer palette
function ZTRANSFER_THEME(messageColor, textColor)
{
  return { name: 'ztransfer', labelBg: '#0d1117', labelFg: '#00b4d8', messageColor, textColor };
}

// MagnifyShit palette
function MAGNIFY_THEME(messageColor, textColor)
{
  return { name: 'magnify', labelBg: '#3a2418', labelFg: '#d4a574', messageColor, textColor };
}

// Plex Poster Set Helper 2 palette (Plex amber/orange)
function PLEX_THEME(messageColor, textColor)
{
  return { name: 'plex', labelBg: '#1a1205', labelFg: '#e5a00d', messageColor, textColor };
}

// pamoja palette (the dashboard's deep navy glass + teal accent)
function PAMOJA_THEME(messageColor, textColor)
{
  return { name: 'pamoja', labelBg: '#0b1124', labelFg: '#1fd3b0', messageColor, textColor };
}

async function gh(p)
{
  const r = await fetch(`https://api.github.com${p}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status} ${r.statusText}`);
  return r.json();
}

async function fetchJson(url, opts = {})
{
  const headers = { 'User-Agent': USER_AGENT, ...(opts.headers || {}) };
  const r = await fetch(url, { ...opts, headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status} ${r.statusText}`);
  return r.json();
}

/**
 * Counts packages on npm for a maintainer, preferring the profile page's own total.
 * @param {string} user
 * @returns {Promise<number>}
 */
async function npmPackageCount(user)
{
  try
  {
    const out = execFileSync('curl', [
      '-sSL', '--max-time', '15',
      '-H', 'x-spiferack: 1',
      '-H', 'accept: application/json',
      '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      `https://www.npmjs.com/~${user}`,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const j = JSON.parse(out);
    if (j?.packages?.total != null) return j.packages.total;
  } catch { /* fall through to registry search */ }
  const r = await fetchJson(`https://registry.npmjs.org/-/v1/search?text=maintainer:${user}&size=250`);
  return r.total ?? (r.objects?.length ?? 0);
}

/**
 * Counts crates owned by a crates.io user.
 * @param {string} user
 * @returns {Promise<number>}
 */
async function cratesPackageCount(user)
{
  const u = await fetchJson(`https://crates.io/api/v1/users/${encodeURIComponent(user)}`);
  const r = await fetchJson(`https://crates.io/api/v1/crates?user_id=${u.user.id}&per_page=1`);
  return r.meta.total;
}

/**
 * Counts listed NuGet packages whose owners include the user, via the search service from the V3 index.
 * @param {string} user
 * @returns {Promise<number>}
 */
async function nugetPackageCount(user)
{
  const index = await fetchJson('https://api.nuget.org/v3/index.json');
  const search = index.resources.find(r => r['@type'].startsWith('SearchQueryService'))?.['@id'];
  if (!search) throw new Error('NuGet service index has no SearchQueryService');
  const r = await fetchJson(`${search}?q=owner:${encodeURIComponent(user)}&prerelease=true&semVerLevel=2.0.0&take=1000`);
  const want = user.toLowerCase();
  return r.data.filter(p => (p.owners ?? []).some(o => o.toLowerCase() === want)).length;
}

/**
 * Counts PyPI projects where the user is an owner or maintainer, via PyPI's XML-RPC user_packages.
 * @param {string} user
 * @returns {Promise<number>}
 */
async function pypiPackageCount(user)
{
  const body = `<?xml version="1.0"?><methodCall><methodName>user_packages</methodName><params><param><value><string>${escapeXml(user)}</string></value></param></params></methodCall>`;
  const r = await fetch('https://pypi.org/pypi', {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml', 'User-Agent': USER_AGENT },
    body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`PyPI XML-RPC: HTTP ${r.status} ${r.statusText}`);
  const xml = await r.text();
  if (xml.includes('<fault>')) throw new Error('PyPI XML-RPC returned a fault');
  const names = [...xml.matchAll(/<string>(?:Owner|Maintainer)<\/string><\/value>\s*<value><string>([^<]+)<\/string>/g)].map(m => m[1]);
  return new Set(names).size;
}

const REGISTRY_COUNTERS = {
  'npm-packages': npmPackageCount,
  'crates-packages': cratesPackageCount,
  'nuget-packages': nugetPackageCount,
  'pypi-packages': pypiPackageCount,
};

/**
 * Compact count format kept for the project-themed badges sibling repos embed.
 * @param {number} n
 * @returns {string}
 */
function fmtThemed(n)
{
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/.0$/, '') + 'k';
  return String(n);
}

function fmtRelative(iso)
{
  const then = new Date(iso);
  const now = new Date();
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.floor((startOfDay(now) - startOfDay(then)) / 86400000);
  if (dayDiff <= 0) return 'today';
  if (dayDiff === 1) return 'yesterday';
  if (dayDiff < 7) return `${dayDiff} days ago`;
  if (dayDiff < 14) return 'last week';
  if (dayDiff < 30) return `${Math.floor(dayDiff / 7)} weeks ago`;
  if (dayDiff < 60) return 'last month';
  if (dayDiff < 365) return `${Math.floor(dayDiff / 30)} months ago`;
  if (dayDiff < 730) return 'last year';
  return `${Math.floor(dayDiff / 365)} years ago`;
}

async function getValue(b)
{
  if (b.kind === 'registry-count')
  {
    const count = await REGISTRY_COUNTERS[b.source](b.user);
    if (!Number.isInteger(count) || count < 1)
    {
      throw new Error(`${b.label} returned ${count} packages for ${b.user}; keeping the last published count`);
    }
    return count;
  }
  if (b.kind === 'static-single' || b.kind === 'static-pair')
  {
    return b.message;
  }
  if (b.kind === 'npm-version')
  {
    const r = await fetchJson(`https://registry.npmjs.org/${b.pkg}/latest`);
    return `v${r.version}`;
  }
  if (b.kind === 'npm-total')
  {
    // npm's range endpoint caps at 18 months per call, so walk forward from the
    // first publish in chunks and sum. Keeps these comparable to the GitHub
    // release counts the desktop apps advertise.
    const meta = await fetchJson(`https://registry.npmjs.org/${b.pkg}`);
    const today = new Date().toISOString().slice(0, 10);
    const iso = d => d.toISOString().slice(0, 10);
    let start = meta.time.created.slice(0, 10);
    let total = 0;
    while (start <= today)
    {
      const to = new Date(start);
      to.setMonth(to.getMonth() + 17);
      const end = iso(to) < today ? iso(to) : today;
      const r = await fetchJson(`https://api.npmjs.org/downloads/range/${start}:${end}/${b.pkg}`);
      for (const d of r.downloads ?? []) total += d.downloads;
      const next = new Date(end);
      next.setDate(next.getDate() + 1);
      start = iso(next);
    }
    return total;
  }
  if (b.kind === 'crates')
  {
    const r = await fetchJson(`https://crates.io/api/v1/crates/${b.pkg}`);
    return `v${r.crate.max_stable_version || r.crate.max_version}`;
  }
  if (b.kind === 'pypi')
  {
    const r = await fetchJson(`https://pypi.org/pypi/${b.pkg}/json`);
    return `v${r.info.version}`;
  }
  if (b.kind === 'nuget')
  {
    const r = await fetchJson(`https://api.nuget.org/v3-flatcontainer/${b.pkg.toLowerCase()}/index.json`);
    return `v${r.versions[r.versions.length - 1]}`;
  }
  if (b.kind === 'last-commit')
  {
    const commits = await gh(`/repos/${OWNER}/${b.repo}/commits?per_page=1`);
    return fmtRelative(commits[0].commit.committer.date);
  }
  if (b.kind === 'release')
  {
    if (b.prerelease)
    {
      const list = await gh(`/repos/${OWNER}/${b.repo}/releases?per_page=1`);
      return list[0]?.tag_name ?? 'none';
    }
    try
    {
      const r = await gh(`/repos/${OWNER}/${b.repo}/releases/latest`);
      return r.tag_name;
    } catch
    {
      return 'none';
    }
  }
  if (b.kind === 'downloads')
  {
    // `baseline` seeds the count with downloads from releases that no longer
    // exist on GitHub (e.g. a deleted tag whose download_count is gone for
    // good). It keeps the lifetime total honest across re-tagging.
    let total = b.baseline ?? 0;
    let page = 1;
    while (true)
    {
      const list = await gh(`/repos/${OWNER}/${b.repo}/releases?per_page=100&page=${page}`);
      if (!list.length) break;
      for (const r of list) for (const a of r.assets) total += a.download_count;
      if (list.length < 100) break;
      page++;
    }
    return total;
  }
  if (b.kind === 'license')
  {
    const r = await gh(`/repos/${OWNER}/${b.repo}/license`);
    return r.license?.spdx_id ?? 'unknown';
  }
  if (b.kind === 'workflow')
  {
    const branch = b.branch ?? 'main';
    const branchParam = branch ? `&branch=${encodeURIComponent(branch)}` : '';
    const runs = await gh(`/repos/${OWNER}/${b.repo}/actions/workflows/${b.workflow}/runs?per_page=1${branchParam}`);
    const run = runs.workflow_runs?.[0];
    if (!run) return 'no runs';
    if (run.status !== 'completed') return run.status.replace('_', ' ');
    return run.conclusion ?? 'unknown';
  }
  throw new Error(`unknown kind: ${b.kind}`);
}

// Per-character advance widths calibrated for Segoe UI at 11px (the font the
// pills actually render in). Using real glyph metrics instead of coarse
// buckets keeps every badge sized tightly and evenly, with no trailing dead
// space that varies from string to string.
const SEGOE_11_WIDTHS = {
  ' ': 3.1, '!': 3.7, '"': 4.7, '#': 7.0, '$': 6.2, '%': 9.6, '&': 7.6, "'": 2.6,
  '(': 3.7, ')': 3.7, '*': 5.5, '+': 6.5, ',': 3.1, '-': 3.7, '.': 3.1, '/': 4.2,
  '0': 6.2, '1': 6.2, '2': 6.2, '3': 6.2, '4': 6.2, '5': 6.2, '6': 6.2, '7': 6.2,
  '8': 6.2, '9': 6.2, ':': 3.1, ';': 3.1, '<': 6.5, '=': 6.5, '>': 6.5, '?': 5.2,
  '@': 10.5,
  A: 7.0, B: 6.9, C: 7.2, D: 7.8, E: 6.3, F: 6.0, G: 7.9, H: 7.9, I: 2.9, J: 3.2,
  K: 6.7, L: 5.7, M: 9.3, N: 7.9, O: 8.2, P: 6.7, Q: 8.2, R: 7.1, S: 6.4, T: 6.2,
  U: 7.7, V: 6.8, W: 10.2, X: 6.6, Y: 6.2, Z: 6.7,
  '[': 3.7, '\\': 4.2, ']': 3.7, '^': 6.5, _: 5.5, '`': 5.5,
  a: 5.7, b: 6.2, c: 5.2, d: 6.2, e: 5.9, f: 3.6, g: 6.2, h: 6.2, i: 2.6, j: 2.6,
  k: 5.6, l: 2.6, m: 9.5, n: 6.2, o: 6.2, p: 6.2, q: 6.2, r: 4.1, s: 5.0, t: 3.8,
  u: 6.2, v: 5.6, w: 8.2, x: 5.6, y: 5.6, z: 5.0,
};

function textWidth(s)
{
  let w = 0;
  for (const c of s) w += SEGOE_11_WIDTHS[c] ?? 6.2;
  return Math.ceil(w);
}

/** Text width at an arbitrary font size, scaled from the 11px table. */
function textWidthAt(s, size)
{
  let w = 0;
  for (const c of s) w += SEGOE_11_WIDTHS[c] ?? 6.2;
  return w * (size / 11);
}

// 14x14 inline SVG icons.
// <svg> element positioned at x=5, y=3 inside the parent badge.
const ICONS = {
  globe: c => `<svg x="5" y="3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9z"/></svg>`,
  book: c => `<svg x="5" y="3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  download: c => `<svg x="5" y="3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M4 19h16"/></svg>`,
  npm: c => `<svg x="5" y="3" width="14" height="14" viewBox="0 0 24 24" fill="${c}"><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0H1.763zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113L5.13 5.323z"/></svg>`,
  github: c => `<svg x="5" y="3" width="14" height="14" viewBox="0 0 24 24" fill="${c}"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`,
  git: c => `<svg x="5" y="3" width="14" height="14" viewBox="0 0 24 24" fill="${c}"><path d="M23.546 10.93L13.067.452c-.604-.603-1.582-.603-2.188 0L8.708 2.627l2.76 2.76c.645-.215 1.379-.07 1.889.441.516.515.658 1.258.438 1.9l2.658 2.66c.645-.223 1.387-.078 1.9.435.721.72.721 1.884 0 2.604-.719.719-1.881.719-2.6 0-.539-.541-.674-1.337-.404-1.996L12.86 8.955v6.525c.176.086.342.203.488.348.713.721.713 1.883 0 2.6-.719.721-1.889.721-2.609 0-.719-.719-.719-1.879 0-2.598.182-.18.387-.316.605-.406V8.835c-.217-.091-.424-.222-.6-.401-.545-.545-.676-1.342-.396-2.009L7.636 3.7.45 10.881c-.6.605-.6 1.584 0 2.189l10.48 10.477c.604.604 1.582.604 2.186 0l10.43-10.43c.605-.603.605-1.582 0-2.187"/></svg>`,
};

// 22px header-pill icons (positioned by the header renderer).
const HEADER_ICONS = {
  'npm-pkg': c => `<path fill="${c}" d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0H1.763zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113L5.13 5.323z"/>`,
  crates: c => `<path fill="${c}" d="${simpleIcons.siRust.path}"/>`,
  nuget: c => `<path fill="${c}" d="${simpleIcons.siNuget.path}"/>`,
  pypi: c => `<path fill="${c}" d="${simpleIcons.siPython.path}"/>`,
};

/**
 * Header stat card matched to the activity cards: transparent fill, single
 * accent, and an animated traveling highlight that traces the border.
 */
function svgHeader({ label, value, icon, dark, id })
{
  const W = 177, H = 53, RX = 10;
  const t = tokens(dark);
  const ink = t.ink;
  const muted = t.muted;
  const border = t.border;
  const accent = t.accent;

  const bx = 0.75, by = 0.75, bw = W - 1.5, bh = H - 1.5, br = RX - 0.25;
  const borderD = `M ${bx + br} ${by} H ${bx + bw - br} A ${br} ${br} 0 0 1 ${bx + bw} ${by + br} V ${by + bh - br} A ${br} ${br} 0 0 1 ${bx + bw - br} ${by + bh} H ${bx + br} A ${br} ${br} 0 0 1 ${bx} ${by + bh - br} V ${by + br} A ${br} ${br} 0 0 1 ${bx + br} ${by} Z`;
  const iconSvg = HEADER_ICONS[icon] ? HEADER_ICONS[icon](accent) : '';

  const dur = 6;
  const sweepW = Math.round(W * 0.6);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="geometricPrecision" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <defs>
    <path id="bd-${id}" d="${borderD}" fill="none"/>
    <linearGradient id="gr-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="0"/>
      <stop offset="50%"  stop-color="${accent}" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    <mask id="mk-${id}" maskUnits="userSpaceOnUse">
      <use href="#bd-${id}" stroke="#fff" stroke-width="1"/>
    </mask>
  </defs>

  <use href="#bd-${id}" stroke="${border}" stroke-width="1"/>

  <g mask="url(#mk-${id})">
    <rect x="0" y="0" width="${sweepW}" height="${H}" fill="url(#gr-${id})">
      <animate attributeName="x" from="${-sweepW}" to="${W}" dur="${dur}s" repeatCount="indefinite"/>
    </rect>
  </g>

  <g transform="translate(16 15)">
    <svg viewBox="0 0 24 24" width="22" height="22">${iconSvg}</svg>
  </g>

  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">
    <text x="48" y="26" font-size="18" font-weight="800" fill="${ink}" letter-spacing="-0.3">${escapeXml(value)}</text>
    <text x="48" y="40" font-size="9.5" font-weight="700" fill="${muted}" letter-spacing="1.6">${escapeXml(label)}</text>
  </g>
</svg>
`;
}

const PILL_H = 22;
const PILL_RX = 5;
const PILL_PAD_X = 10;
const PILL_ICON_W = 14;
const PILL_ICON_GAP = 6;
const PILL_SEP_GAP = 6;

function placeIcon(name, color, x, y)
{
  return ICONS[name](color).replace(/x="\d+(?:\.\d+)?" y="\d+(?:\.\d+)?"/, `x="${x}" y="${y}"`);
}

function svgPill({ label, message, icon, bg, border, borderOpacity = 1, labelColor, valueColor, iconColor })
{
  const iconW = icon ? PILL_ICON_W + PILL_ICON_GAP : 0;
  const lw = label ? textWidth(label) + PILL_SEP_GAP : 0;
  const mw = textWidth(message);
  const W = PILL_PAD_X + iconW + lw + mw + PILL_PAD_X;
  const iconX = PILL_PAD_X;
  const iconY = (PILL_H - 14) / 2;
  const labelX = PILL_PAD_X + iconW;
  const valueX = labelX + lw;
  const ty = 15;
  const iconSvg = icon ? '\n  ' + placeIcon(icon, iconColor, iconX, iconY) : '';
  const labelText = label
    ? `\n    <text x="${labelX}" y="${ty}" fill="${labelColor}" font-weight="500">${escapeXml(label)}</text>`
    : '';
  const aria = label ? `${escapeXml(label)}: ${escapeXml(message)}` : escapeXml(message);
  const strokeOpAttr = borderOpacity < 1 ? ` stroke-opacity="${borderOpacity}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${PILL_H}" role="img" aria-label="${aria}">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${PILL_H - 1}" rx="${PILL_RX}" fill="${bg}" stroke="${border}"${strokeOpAttr}/>${iconSvg}
  <g font-family="'Segoe UI',-apple-system,BlinkMacSystemFont,Inter,sans-serif" font-size="11">${labelText}
    <text x="${valueX}" y="${ty}" fill="${valueColor}" font-weight="600">${escapeXml(message)}</text>
  </g>
</svg>
`;
}

// Neutral muted label color that reads cleanly on any dark themed background.
const THEMED_LABEL = '#8b95a7';

/**
 * Renders a project-themed pill for sibling READMEs. Kept identical to the
 * original design because those repos own their themes.
 */
function svgThemed({ label, message, theme, icon })
{
  const accent = theme.labelFg;
  return svgPill({
    label, message, icon,
    bg: theme.labelBg,
    border: accent,
    borderOpacity: 0.28,
    labelColor: THEMED_LABEL,
    valueColor: accent,
    iconColor: accent,
  });
}

const WORKFLOW_WORDS = {
  success: 'passing',
  failure: 'failing',
  startup_failure: 'failing',
  timed_out: 'timed out',
  cancelled: 'canceled',
  action_required: 'action required',
  'in progress': 'running',
};

/**
 * Maps a raw badge value to card wording and display state.
 * @param {object} b badge definition
 * @param {string | number} value raw value from getValue
 * @returns {{ text: string, state: 'ok' | 'muted' | 'fail' }}
 */
function statCopy(b, value)
{
  let text = typeof value === 'number' ? fmtNum(value) : value;
  let state = 'ok';
  if (b.kind === 'workflow')
  {
    text = WORKFLOW_WORDS[value] ?? value;
    if (text === 'failing' || text === 'timed out') state = 'fail';
    else if (text !== 'passing') state = 'muted';
  }
  if (['none', 'unknown', 'no runs', 'NOASSERTION'].includes(text)) state = 'muted';
  return { text, state };
}

const CARD_W = 415;
const CARD_H = 178;
const CARD_RX = 10;
const CARD_PAD = 14;
const CARD_ICON = 40;
const DESC_SIZE = 12.5;
const DESC_LINE_H = 17;
const DESC_TOP = 78;
const DESC_MAX_LINES = 3;
const STATS_RULE_Y = 127;
const STAT_VALUE_Y = 150;
const STAT_LABEL_Y = 164;

/**
 * Greedily wraps text into lines that fit a pixel width.
 * @param {string} text
 * @param {number} maxW
 * @param {number} size
 * @returns {string[]}
 */
function wrapText(text, maxW, size)
{
  const lines = [];
  let line = '';
  for (const word of text.split(' '))
  {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidthAt(next, size) * 1.06 > maxW)
    {
      lines.push(line);
      line = word;
    } else
    {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Renders a project card matched to the activity and stack cards: rounded
 * border, amber sheen along the top edge, icon and name, wrapped description,
 * and a row of live stats.
 * @param {{ id: string, name: string, language?: string, tag?: string, description: string, iconData: string, stats: { label: string, text: string, state: string }[], dark: boolean }} p
 * @returns {string}
 */
function svgProjectCard({ id, name, language, tag, description, iconData, stats, dark })
{
  const t = tokens(dark);
  const descFill = dark ? '#adbac7' : '#424a53';
  const key = `${id}-${dark ? 'd' : 'l'}`;
  const innerW = CARD_W - CARD_PAD * 2;

  let lines = wrapText(description, innerW, DESC_SIZE);
  if (lines.length > DESC_MAX_LINES)
  {
    lines = lines.slice(0, DESC_MAX_LINES);
    lines[DESC_MAX_LINES - 1] = lines[DESC_MAX_LINES - 1].replace(/[\s,;:]*\S*$/, '') + '...';
  }
  const descSvg = lines.map((l, i) =>
    `<text x="${CARD_PAD}" y="${DESC_TOP + i * DESC_LINE_H}" font-size="${DESC_SIZE}" fill="${descFill}">${escapeXml(l)}</text>`).join('\n    ');

  const cellW = innerW / stats.length;
  let statSvg = '';
  stats.forEach((s, i) =>
  {
    const cx = CARD_PAD + cellW * i + cellW / 2;
    let size = 13.5;
    while (size > 11 && textWidthAt(s.text, size) * 1.12 > cellW - 8) size -= 0.5;
    const fill = s.state === 'fail' ? t.danger : s.state === 'muted' ? t.muted : t.ink;
    statSvg += `
    <text x="${cx.toFixed(1)}" y="${STAT_VALUE_Y}" text-anchor="middle" font-size="${size}" font-weight="800" fill="${fill}" letter-spacing="-0.2">${escapeXml(s.text)}</text>
    <text x="${cx.toFixed(1)}" y="${STAT_LABEL_Y}" text-anchor="middle" font-size="9" font-weight="700" fill="${t.muted}" letter-spacing="1.4">${escapeXml(s.label)}</text>`;
    if (i > 0)
    {
      const dx = CARD_PAD + cellW * i;
      statSvg += `\n    <line x1="${dx.toFixed(1)}" y1="${STATS_RULE_Y + 10}" x2="${dx.toFixed(1)}" y2="${CARD_H - 10}" stroke="${t.sep}" stroke-width="1"/>`;
    }
  });

  let tagSvg = '';
  if (tag)
  {
    const tagW = Math.ceil(textWidthAt(tag, 9) * 1.1 + tag.length * 1.2 + 18);
    const tx = CARD_W - CARD_PAD - tagW;
    tagSvg = `
  <rect x="${tx}" y="16" width="${tagW}" height="18" rx="9" fill="rgba(${t.accentRgb},0.14)" stroke="rgba(${t.accentRgb},0.65)" stroke-width="1"/>
  <text x="${tx + tagW / 2}" y="28.5" text-anchor="middle" font-family="${FONT}" font-size="9" font-weight="700" fill="${t.accent}" letter-spacing="1.2">${escapeXml(tag)}</text>`;
  }

  const sheenW = 180;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" role="img" aria-label="${escapeXml(name)}">
  <defs>
    <linearGradient id="sheen-${key}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${t.accent}" stop-opacity="0"/>
      <stop offset="50%"  stop-color="${t.accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${t.accent}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="clip-${key}"><rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" rx="${CARD_RX}" ry="${CARD_RX}"/></clipPath>
  </defs>

  <rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${CARD_H - 1}" rx="${CARD_RX}" ry="${CARD_RX}" fill="none" stroke="${t.border}"/>

  <g clip-path="url(#clip-${key})">
    <rect x="-${sheenW}" y="0" width="${sheenW}" height="1.5" fill="url(#sheen-${key})">
      <animate attributeName="x" from="-${sheenW}" to="${CARD_W}" dur="9s" begin="0s" repeatCount="indefinite"/>
    </rect>
  </g>

  <image href="${iconData}" x="${CARD_PAD}" y="${CARD_PAD}" width="${CARD_ICON}" height="${CARD_ICON}"/>${tagSvg}

  <g font-family="${FONT}">
    <text x="66" y="31" font-size="15" font-weight="700" fill="${t.ink}" letter-spacing="-0.2">${escapeXml(name)}</text>${language ? `
    <text x="66" y="48" font-size="11" font-weight="600" fill="${t.muted}" letter-spacing="0.3">${escapeXml(language)}</text>` : ''}
    ${descSvg}
  </g>

  <line x1="${CARD_PAD}" y1="${STATS_RULE_Y}" x2="${CARD_W - CARD_PAD}" y2="${STATS_RULE_Y}" stroke="${t.sep}" stroke-width="1"/>
  <g font-family="${FONT}">${statSvg}
  </g>
</svg>
`;
}

/**
 * Fetches a remote SVG icon and returns it as a data URI for embedding.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function iconDataUri(url)
{
  const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return 'data:image/svg+xml;base64,' + Buffer.from(await r.text()).toString('base64');
}

mkdirSync(OUT, { recursive: true });

const README = 'README.md';
let md = readFileSync(README, 'utf8');

// file name -> sha1 of the bytes just written, used to stamp README URLs.
const hashes = {};
const alts = {};
const values = {};
const byId = Object.fromEntries(BADGES.map(b => [b.id, b]));
let failed = 0;

function emit(name, body)
{
  writeFileSync(path.join(OUT, name), body);
  hashes[name] = createHash('sha1').update(body).digest('hex').slice(0, 8);
}

for (const b of BADGES)
{
  try
  {
    const value = await getValue(b);
    values[b.id] = value;
    if (b.kind === 'registry-count')
    {
      emit(`${b.id}-dark.svg`, svgHeader({ label: b.label, value: String(value), icon: b.icon, dark: true, id: b.id + '-d' }));
      emit(`${b.id}-light.svg`, svgHeader({ label: b.label, value: String(value), icon: b.icon, dark: false, id: b.id + '-l' }));
      alts[b.id] = `${b.altName}: ${value} ${plural(value, 'package')}`;
    }
    if (b.theme)
    {
      const message = typeof value === 'number' ? fmtThemed(value) : value;
      emit(`${b.id}-${b.theme.name}.svg`, svgThemed({ label: b.label, message, theme: b.theme, icon: b.icon }));
    }
    console.log(`ok  ${b.id.padEnd(32)} ${value}`);
  } catch (e)
  {
    failed++;
    console.error(`err ${b.id.padEnd(32)} ${e.message}`);
  }
}

for (const section of PROJECT_SECTIONS)
{
  const pics = [];
  for (const card of section.cards)
  {
    const stats = card.stats.map(s => values[s.use] === undefined ? null : ({ label: s.label, ...statCopy(byId[s.use], values[s.use]) }));
    let alt = card.name;
    try
    {
      if (stats.includes(null)) throw new Error(`missing ${card.stats.filter((_, i) => !stats[i]).map(s => s.use).join(', ')}`);
      const [iconData, repoInfo] = await Promise.all([iconDataUri(card.icon), gh(`/repos/${OWNER}/${card.repo}`)]);
      const opts = { id: card.id, name: card.name, language: repoInfo.language ?? '', tag: card.tag, description: card.description, iconData, stats };
      emit(`${card.id}-dark.svg`, svgProjectCard({ ...opts, dark: true }));
      emit(`${card.id}-light.svg`, svgProjectCard({ ...opts, dark: false }));
      alt = `${card.name}${card.tag ? ', in development' : ''}. ${card.description} ${stats.map(s => `${s.label.toLowerCase()} ${s.text}`).join(', ')}`;
      console.log(`ok  ${card.id.padEnd(32)} ${stats.map(s => s.text).join(' | ')}`);
    } catch (e)
    {
      failed++;
      console.error(`err ${card.id.padEnd(32)} ${e.message}; keeping the committed card`);
    }
    pics.push(`<a href="${GH}/${card.repo}"><picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/${card.id}-dark.svg"><img alt="${escapeAttr(alt)}" width="${CARD_W}" src="${RAW}/${card.id}-light.svg" /></picture></a>`);
  }
  const re = new RegExp(`<!-- projects:${section.id} -->[\\s\\S]*?<!-- /projects:${section.id} -->`);
  if (!re.test(md))
  {
    console.warn(`  ! projects:${section.id} markers not found in README.md`);
    continue;
  }
  md = md.replace(re, `<!-- projects:${section.id} -->\n<p align="center">\n  ${pics.join('\n  ')}\n</p>\n<!-- /projects:${section.id} -->`);
}

// Stamp every badge URL this script owns with ?v=<hash>. GitHub proxies README
// images through camo, which caches on the URL - without a changing query the
// profile keeps serving the old SVG long after the file here has moved on.
let stamped = 0, unreferenced = [];

// raw.githubusercontent.com serves the same file under both a bare branch name
// and the refs/heads/ form; stamp either one so a hand-written URL is not
// silently skipped.
const RAW_FORMS = [RAW, `https://raw.githubusercontent.com/${OWNER}/${REPO}/refs/heads/main/${OUT}`];

for (const [name, hash] of Object.entries(hashes))
{
  let hit = false;
  for (const base of RAW_FORMS)
  {
    const url = `${base}/${name}`;
    const parts = md.split(url);
    if (parts.length === 1) continue;
    hit = true;
    md = parts.map((part, i) =>
    {
      if (i === 0) return part;
      stamped++;
      return `?v=${hash}` + part.replace(/^\?v=[0-9a-f]+/, '');
    }).join(url);
  }
  if (!hit && /-(dark|light)\.svg$/.test(name)) unreferenced.push(name);
}

/**
 * Escapes a value for an HTML attribute in README markup.
 * @param {string} s
 * @returns {string}
 */
function escapeAttr(s)
{
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Alt text carries the live values, so they survive a broken image and reach screen readers.
md = md.replace(/<img\b[^>]*>/g, tag =>
{
  const m = tag.match(/\/([A-Za-z0-9._-]+)-light\.svg/);
  if (!m || !alts[m[1]]) return tag;
  return tag.replace(/\balt="[^"]*"/, `alt="${escapeAttr(alts[m[1]])}"`);
});

writeFileSync(README, md);

console.log(`\nstamped ${stamped} README badge URLs`);
if (unreferenced.length) console.log(`note: ${unreferenced.length} generated badges are not referenced in README.md: ${unreferenced.join(', ')}`);

if (failed)
{
  console.error(`\n${failed} badge(s) failed to refresh - the committed files for those are stale`);
  process.exitCode = 1;
}
