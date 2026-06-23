#!/usr/bin/env node

import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN)
{
  console.error('GH_TOKEN env var is required');
  process.exit(1);
}

const OWNER = 'molexxxx';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = resolve(ROOT, '.github', 'badges');
const RAW = `https://raw.githubusercontent.com/${OWNER}/${OWNER}/main/.github/badges`;
mkdirSync(OUT, { recursive: true });

// drop deprecated artifacts from the previous design
for (const stale of ['activity-year-dark.svg', 'activity-year-light.svg', 'activity-streak-dark.svg', 'activity-streak-light.svg'])
{
  const p = resolve(OUT, stale);
  if (existsSync(p)) rmSync(p);
}

async function gql(query, variables = {})
{
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'molexxxx-activity-gen',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) throw new Error(`graphql: HTTP ${r.status}`);
  const j = await r.json();
  if (j.errors) throw new Error('graphql: ' + JSON.stringify(j.errors));
  return j.data;
}

async function rest(p)
{
  const r = await fetch(`https://api.github.com${p}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'molexxxx-activity-gen',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status} ${r.statusText}`);
  return r.json();
}

const QUERY = `query($login: String!) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 30) { nodes { name } }
      }
    }
  }
}`;

const data = (await gql(QUERY, { login: OWNER })).user;

// All-time contribution totals: iterate yearly windows from account creation to now.
// contributionsCollection accepts a max 1-year window, so we chunk.
async function fetchAllTimeTotals(createdAt)
{
  const start = new Date(createdAt);
  const now = new Date();
  const totals = { commits: 0, prs: 0, issues: 0, reviews: 0 };
  let cursor = new Date(start);
  while (cursor < now)
  {
    const from = new Date(cursor);
    const to = new Date(cursor);
    to.setUTCFullYear(to.getUTCFullYear() + 1);
    if (to > now) to.setTime(now.getTime());
    const q = `query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
        }
      }
    }`;
    const d = await gql(q, { login: OWNER, from: from.toISOString(), to: to.toISOString() });
    const c = d.user.contributionsCollection;
    totals.commits += c.totalCommitContributions;
    totals.prs += c.totalPullRequestContributions;
    totals.issues += c.totalIssueContributions;
    totals.reviews += c.totalPullRequestReviewContributions;
    cursor = to;
  }
  return totals;
}

const allTime = await fetchAllTimeTotals(data.createdAt);

const EXTERNAL_STAR_REPOS = [
  { owner: 'bbrown430', name: 'plex-poster-set-helper-2' },
];
async function fetchExternalStars()
{
  let stars = 0;
  // for (const r of EXTERNAL_STAR_REPOS)
  // {
  //   const q = `query($o:String!,$n:String!){ repository(owner:$o,name:$n){ stargazerCount } }`;
  //   const d = await gql(q, { o: r.owner, n: r.name });
  //   stars += d.repository?.stargazerCount ?? 0;
  // }
  return stars;
}
const externalStars = 0;
const userRest = await rest(`/users/${OWNER}`);

const languageSet = new Set();
for (const repo of data.repositories.nodes)
  for (const lang of (repo.languages?.nodes ?? []))
    languageSet.add(lang.name);

const cal = data.contributionsCollection.contributionCalendar;
const days = cal.weeks.flatMap(w => w.contributionDays);
const totalContrib = cal.totalContributions;
const totalCommits = allTime.commits;
const totalPRs = allTime.prs;
const totalReviews = allTime.reviews;
const totalIssues = allTime.issues;
const totalStars = data.repositories.nodes.reduce((s, n) => s + n.stargazerCount, 0) + externalStars;
const totalRepos = userRest.public_repos;
const totalLanguages = languageSet.size;
const followers = data.followers.totalCount;
const activeDays = days.filter(d => d.contributionCount > 0).length;

let currentStreak = 0;
for (let i = days.length - 1; i >= 0; i--)
{
  if (days[i].contributionCount > 0) currentStreak++;
  else if (i === days.length - 1) continue;
  else break;
}
let longestStreak = 0, run = 0;
for (const d of days)
{
  if (d.contributionCount > 0) { run++; if (run > longestStreak) longestStreak = run; }
  else run = 0;
}

const maxDay = Math.max(...days.map(d => d.contributionCount), 1);

function fmtNum(n)
{
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toLocaleString('en-US');
}

function escapeXml(s)
{
  return String(s).replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

const CARD_W = 415;
const RX = 10;
const COLORS = {
  dark:  { border: '#30363d', ink: '#e6e9f1', muted: '#7d8590', sep: '#1c222c', grid: '#1c222c', accent: '#60a5fa' },
  light: { border: '#d0d7de', ink: '#0b1220', muted: '#656d76', sep: '#eaecef', grid: '#eaecef', accent: '#2563eb' },
};

function headerAnim(id, accent)
{
  return `
    <linearGradient id="pulse-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${accent}" stop-opacity="0"/>
      <stop offset="50%"  stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>`;
}

function headerSweep(id, w, y, dur)
{
  const sweepW = Math.round(w * 0.42);
  return `<rect x="-${sweepW}" y="${y}" width="${sweepW}" height="1" fill="url(#pulse-${id})">
    <animate attributeName="x" from="-${sweepW}" to="${w}" dur="${dur}s" repeatCount="indefinite"/>
  </rect>`;
}

function svgContributions(dark)
{
  const c = dark ? COLORS.dark : COLORS.light;
  const id = `co-${dark ? 'd' : 'l'}`;
  const W = CARD_W;
  const H = 168;

  const PAD_X = 14;
  const HEADER_Y = 20;
  const DIVIDER_Y = 28;

  const plotTop = 42;
  const plotH = 70;
  const plotLeft = PAD_X;
  const plotRight = W - PAD_X;
  const plotW = plotRight - plotLeft;

  const n = days.length;
  const xAt = i => plotLeft + (i / (n - 1)) * plotW;
  const yAt = v => plotTop + plotH - (v / maxDay) * plotH;

  let line = '';
  for (let i = 0; i < n; i++)
  {
    line += (i === 0 ? 'M ' : ' L ') + xAt(i).toFixed(1) + ' ' + yAt(days[i].contributionCount).toFixed(1);
  }
  const area = `${line} L ${xAt(n - 1).toFixed(1)} ${plotTop + plotH} L ${xAt(0).toFixed(1)} ${plotTop + plotH} Z`;

  let approxLen = 0;
  for (let i = 1; i < n; i++)
  {
    const dx = xAt(i) - xAt(i - 1);
    const dy = yAt(days[i].contributionCount) - yAt(days[i - 1].contributionCount);
    approxLen += Math.hypot(dx, dy);
  }
  approxLen = Math.ceil(approxLen);

  const midY = plotTop + plotH / 2;
  const baseY = plotTop + plotH;
  const lastX = xAt(n - 1), lastY = yAt(days[n - 1].contributionCount);

  const stripY = 138;
  const stripCols = [
    { label: 'STREAK',  value: `${currentStreak}d` },
    { label: 'LONGEST', value: `${longestStreak}d` },
    { label: 'ACTIVE',  value: `${activeDays}/365` },
  ];
  const colW = (W - PAD_X * 2) / stripCols.length;
  let strip = '';
  stripCols.forEach((s, i) =>
  {
    const cx = PAD_X + colW * i + colW / 2;
    strip += `
      <text x="${cx.toFixed(1)}" y="${stripY}" text-anchor="middle" font-size="13" font-weight="700" fill="${c.ink}" letter-spacing="-0.2">${escapeXml(s.value)}</text>
      <text x="${cx.toFixed(1)}" y="${stripY + 13}" text-anchor="middle" font-size="9" font-weight="700" fill="${c.muted}" letter-spacing="1.8">${s.label}</text>`;
    if (i > 0)
    {
      const dx = PAD_X + colW * i;
      strip += `<line x1="${dx.toFixed(1)}" y1="${stripY - 13}" x2="${dx.toFixed(1)}" y2="${stripY + 17}" stroke="${c.sep}" stroke-width="1"/>`;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contributions in the last year: ${totalContrib}">
  <defs>
    ${headerAnim(id, c.accent)}
    <linearGradient id="area-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c.accent}" stop-opacity="${dark ? 0.32 : 0.22}"/>
      <stop offset="100%" stop-color="${c.accent}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="clip-${id}"><rect x="0" y="0" width="${W}" height="${H}" rx="${RX}" ry="${RX}"/></clipPath>
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${RX}" ry="${RX}" fill="none" stroke="${c.border}"/>

  <g clip-path="url(#clip-${id})">
    <line x1="0" y1="${DIVIDER_Y}" x2="${W}" y2="${DIVIDER_Y}" stroke="${c.sep}" stroke-width="1"/>
    ${headerSweep(id, W, DIVIDER_Y - 1, 7)}
  </g>

  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">
    <text x="${PAD_X}" y="${HEADER_Y}" font-size="13" font-weight="700" fill="${c.ink}" letter-spacing="-0.1">Contributions</text>
    <text x="${W - PAD_X}" y="${HEADER_Y}" text-anchor="end" font-size="11" font-weight="600" fill="${c.muted}" letter-spacing="1.2">${fmtNum(totalContrib)} · 365d</text>
  </g>

  <line x1="${plotLeft}" y1="${midY}" x2="${plotRight}" y2="${midY}" stroke="${c.grid}" stroke-width="1" stroke-opacity="0.6"/>
  <line x1="${plotLeft}" y1="${baseY}" x2="${plotRight}" y2="${baseY}" stroke="${c.grid}" stroke-width="1"/>

  <path d="${area}" fill="url(#area-${id})" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="1.2s" begin="0.4s" fill="freeze"/>
  </path>

  <path d="${line}" fill="none" stroke="${c.accent}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"
    stroke-dasharray="${approxLen}" stroke-dashoffset="${approxLen}" opacity="0.95">
    <animate attributeName="stroke-dashoffset" from="${approxLen}" to="0" dur="1.8s" begin="0.2s" fill="freeze"/>
  </path>

  <g opacity="0">
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.5" fill="${c.accent}"/>
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="5" fill="${c.accent}" fill-opacity="0.25">
      <animate attributeName="r" values="5;10;5" dur="2.4s" repeatCount="indefinite"/>
      <animate attributeName="fill-opacity" values="0.35;0;0.35" dur="2.4s" repeatCount="indefinite"/>
    </circle>
    <animate attributeName="opacity" from="0" to="1" dur="0.6s" begin="2s" fill="freeze"/>
  </g>

  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">${strip}</g>
</svg>
`;
}

function svgStats(dark)
{
  const c = dark ? COLORS.dark : COLORS.light;
  const id = `st-${dark ? 'd' : 'l'}`;
  const W = CARD_W;
  const H = 168;
  const PAD_X = 14;
  const HEADER_Y = 20;
  const DIVIDER_Y = 28;

  const stats = [
    { label: 'COMMITS',   value: fmtNum(totalCommits) },
    { label: 'PULL REQS', value: fmtNum(totalPRs) },
    { label: 'REVIEWS',   value: fmtNum(totalReviews) },
    { label: 'ISSUES',    value: fmtNum(totalIssues) },
    { label: 'STARS',     value: fmtNum(totalStars) },
    { label: 'REPOS',     value: fmtNum(totalRepos) },
    { label: 'LANGUAGES', value: fmtNum(totalLanguages) },
    { label: 'FOLLOWERS', value: fmtNum(followers) },
  ];

  const cols = 4;
  const rows = 2;
  const gridTop = 46;
  const gridBottom = H - 14;
  const innerW = W - PAD_X * 2;
  const cellW = innerW / cols;
  const cellH = (gridBottom - gridTop) / rows;

  let cells = '';
  let dividers = '';
  for (let i = 0; i < stats.length; i++)
  {
    const r = Math.floor(i / cols);
    const cc = i % cols;
    const cx = PAD_X + cellW * cc + cellW / 2;
    const cy = gridTop + cellH * r + cellH / 2;
    const s = stats[i];
    cells += `
      <g text-anchor="middle">
        <text x="${cx.toFixed(1)}" y="${(cy - 2).toFixed(1)}" font-size="18" font-weight="800" fill="${c.ink}" letter-spacing="-0.4" opacity="0">
          ${escapeXml(s.value)}
          <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${0.15 + i * 0.07}s" fill="freeze"/>
        </text>
        <text x="${cx.toFixed(1)}" y="${(cy + 14).toFixed(1)}" font-size="9" font-weight="700" fill="${c.muted}" letter-spacing="1.8">${s.label}</text>
      </g>`;
  }
  for (let cc = 1; cc < cols; cc++)
  {
    const dx = PAD_X + cellW * cc;
    dividers += `<line x1="${dx.toFixed(1)}" y1="${gridTop}" x2="${dx.toFixed(1)}" y2="${gridBottom}" stroke="${c.sep}" stroke-width="1"/>`;
  }
  const midRowY = gridTop + cellH;
  dividers += `<line x1="${PAD_X}" y1="${midRowY.toFixed(1)}" x2="${W - PAD_X}" y2="${midRowY.toFixed(1)}" stroke="${c.sep}" stroke-width="1"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub stats">
  <defs>
    ${headerAnim(id, c.accent)}
    <clipPath id="clip-${id}"><rect x="0" y="0" width="${W}" height="${H}" rx="${RX}" ry="${RX}"/></clipPath>
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${RX}" ry="${RX}" fill="none" stroke="${c.border}"/>

  <g clip-path="url(#clip-${id})">
    <line x1="0" y1="${DIVIDER_Y}" x2="${W}" y2="${DIVIDER_Y}" stroke="${c.sep}" stroke-width="1"/>
    ${headerSweep(id, W, DIVIDER_Y - 1, 7)}
  </g>

  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">
    <text x="${PAD_X}" y="${HEADER_Y}" font-size="13" font-weight="700" fill="${c.ink}" letter-spacing="-0.1">Stats</text>
    <text x="${W - PAD_X}" y="${HEADER_Y}" text-anchor="end" font-size="11" font-weight="600" fill="${c.muted}" letter-spacing="1.2">all time</text>
  </g>

  <g>${dividers}</g>
  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">${cells}</g>
</svg>
`;
}

const ARTIFACTS = [
  { id: 'activity-contributions', render: svgContributions, alt: 'Contributions' },
  { id: 'activity-stats',         render: svgStats,         alt: 'Stats' },
];

const manifest = {};
for (const a of ARTIFACTS)
{
  const dark = a.render(true);
  const light = a.render(false);
  writeFileSync(resolve(OUT, `${a.id}-dark.svg`), dark);
  writeFileSync(resolve(OUT, `${a.id}-light.svg`), light);
  manifest[a.id] = {
    darkHash: createHash('sha1').update(dark).digest('hex').slice(0, 8),
    lightHash: createHash('sha1').update(light).digest('hex').slice(0, 8),
  };
  console.log(`ok  ${a.id}`);
}

const cardImg = (a) =>
{
  const { darkHash, lightHash } = manifest[a.id];
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/${a.id}-dark.svg?v=${darkHash}"><img alt="${escapeXml(a.alt)}" width="${CARD_W}" src="${RAW}/${a.id}-light.svg?v=${lightHash}" /></picture>`;
};

const block = ARTIFACTS.map(cardImg).join(' ');
const wrapped = `<!-- activity:start -->\n  ${block}\n<!-- activity:end -->`;

const README = resolve(ROOT, 'README.md');
let md = readFileSync(README, 'utf8');

if (md.includes('<!-- activity:start -->') && md.includes('<!-- activity:end -->'))
{
  md = md.replace(/<!-- activity:start -->[\s\S]*?<!-- activity:end -->/, wrapped);
} else
{
  console.warn('  ! activity markers not found in README.md');
}

writeFileSync(README, md);
console.log('README updated (activity block)');
