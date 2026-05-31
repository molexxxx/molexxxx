#!/usr/bin/env node

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN = process.env.GH_TOKEN;
if (!TOKEN)
{
  console.error('GH_TOKEN env var is required');
  process.exit(1);
}

const OWNER = 'tonywied17';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = resolve(ROOT, '.github', 'badges');
const RAW = `https://raw.githubusercontent.com/${OWNER}/${OWNER}/main/.github/badges`;
mkdirSync(OUT, { recursive: true });

async function gql(query, variables = {})
{
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'tonywied17-activity-gen',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) throw new Error(`graphql: HTTP ${r.status}`);
  const j = await r.json();
  if (j.errors) throw new Error('graphql: ' + JSON.stringify(j.errors));
  return j.data;
}

const QUERY = `query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    following { totalCount }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      totalCount
      nodes { stargazerCount forkCount }
    }
  }
}`;

const data = (await gql(QUERY, { login: OWNER })).user;

const cal = data.contributionsCollection.contributionCalendar;
const days = cal.weeks.flatMap(w => w.contributionDays);
const totalContrib = cal.totalContributions;
const totalCommits = data.contributionsCollection.totalCommitContributions;
const totalPRs = data.contributionsCollection.totalPullRequestContributions;
const totalReviews = data.contributionsCollection.totalPullRequestReviewContributions;
const totalIssues = data.contributionsCollection.totalIssueContributions;
const totalStars = data.repositories.nodes.reduce((s, n) => s + n.stargazerCount, 0);
const totalForks = data.repositories.nodes.reduce((s, n) => s + n.forkCount, 0);
const totalRepos = data.repositories.totalCount;
const followers = data.followers.totalCount;

// streaks: contiguous days ending today (or yesterday) with > 0
let currentStreak = 0;
for (let i = days.length - 1; i >= 0; i--)
{
  if (days[i].contributionCount > 0) currentStreak++;
  else if (i === days.length - 1) continue; // allow today 0 without breaking
  else break;
}
let longestStreak = 0, run = 0;
for (const d of days)
{
  if (d.contributionCount > 0) { run++; if (run > longestStreak) longestStreak = run; }
  else run = 0;
}

const maxDay = Math.max(...days.map(d => d.contributionCount), 1);
const busiest = days.reduce((a, b) => b.contributionCount > a.contributionCount ? b : a, days[0]);

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

const PALETTE = {
  dark: { surfaceA: '#11151f', surfaceB: '#0a0d14', border: '#1f2533', ink: '#e6e9f1', muted: '#94a3b8', grid: '#1c2230' },
  light: { surfaceA: '#ffffff', surfaceB: '#f7f8fb', border: '#e4e7ee', ink: '#0b1220', muted: '#5b6472', grid: '#eef0f5' },
};

const ACCENTS = {
  year: { a: '#a78bfa', b: '#60a5fa' },
  stats: { a: '#22d3ee', b: '#2563eb' },
  streak: { a: '#f59e0b', b: '#ef4444' },
};

function chromeDefs(id, dark, accentA, accentB)
{
  const p = dark ? PALETTE.dark : PALETTE.light;
  return `
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.surfaceA}"/>
      <stop offset="100%" stop-color="${p.surfaceB}"/>
    </linearGradient>
    <linearGradient id="ac-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accentA}"/>
      <stop offset="100%" stop-color="${accentB}"/>
    </linearGradient>
    <linearGradient id="tint-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accentA}" stop-opacity="${dark ? 0.18 : 0.10}"/>
      <stop offset="100%" stop-color="${accentA}" stop-opacity="0"/>
    </linearGradient>`;
}

function chromeFrame(id, W, H, RX, dark, accentA, accentB, perimeter)
{
  const p = dark ? PALETTE.dark : PALETTE.light;
  const bx = 1, by = 1, bw = W - 2, bh = H - 2, br = RX - 0.5;
  const borderD = `M ${bx + br} ${by} H ${bx + bw - br} A ${br} ${br} 0 0 1 ${bx + bw} ${by + br} V ${by + bh - br} A ${br} ${br} 0 0 1 ${bx + bw - br} ${by + bh} H ${bx + br} A ${br} ${br} 0 0 1 ${bx} ${by + bh - br} V ${by + br} A ${br} ${br} 0 0 1 ${bx + br} ${by} Z`;
  const dash = Math.max(40, Math.round(perimeter * 0.12));
  const gap = perimeter - dash;
  return {
    bg: `
  <rect x="0" y="0" width="${W}" height="${H}" rx="${RX}" ry="${RX}" fill="url(#bg-${id})"/>
  <rect x="0" y="0" width="${W}" height="${H}" rx="${RX}" ry="${RX}" fill="url(#tint-${id})"/>`,
    border: `
  <path id="bd-${id}" d="${borderD}" fill="none"/>
  <use href="#bd-${id}" stroke="${p.border}" stroke-width="1"/>
  <use href="#bd-${id}" stroke="url(#ac-${id})" stroke-width="1.2" stroke-opacity="0.55"/>
  <use href="#bd-${id}" stroke="url(#ac-${id})" stroke-width="2" stroke-dasharray="${dash} ${gap}" stroke-linecap="round">
    <animate attributeName="stroke-dashoffset" from="0" to="-${perimeter}" dur="6s" repeatCount="indefinite"/>
  </use>`,
    motes: `
  <g clip-path="url(#clip-${id})">
    <circle r="2.1" fill="${accentA}"><animateMotion dur="7s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
    <circle r="1.6" fill="${accentB}"><animateMotion dur="7s" begin="-1.75s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
    <circle r="1.3" fill="${accentA}" opacity="0.75"><animateMotion dur="7s" begin="-3.5s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
    <circle r="1" fill="${accentB}" opacity="0.7"><animateMotion dur="7s" begin="-5.25s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
  </g>`,
  };
}

// ----- year contribution sparkline card -----
function svgYear(dark)
{
  const W = 880, H = 230, RX = 12;
  const id = `yr-${dark ? 'd' : 'l'}`;
  const p = dark ? PALETTE.dark : PALETTE.light;
  const accentA = ACCENTS.year.a, accentB = ACCENTS.year.b;
  const perimeter = 2 * (W - 2 + H - 2) - 8 * (RX - 0.5) + 2 * Math.PI * (RX - 0.5);
  const f = chromeFrame(id, W, H, RX, dark, accentA, accentB, perimeter);

  // plot area
  const PL = 28, PR = 28, PT = 100, PB = 36;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;

  // path points
  const n = days.length;
  const xAt = i => PL + (i / (n - 1)) * plotW;
  const yAt = v => PT + plotH - (v / maxDay) * plotH;

  let line = '';
  for (let i = 0; i < n; i++)
  {
    line += (i === 0 ? 'M ' : ' L ') + xAt(i).toFixed(1) + ' ' + yAt(days[i].contributionCount).toFixed(1);
  }
  const area = `${line} L ${xAt(n - 1).toFixed(1)} ${PT + plotH} L ${xAt(0).toFixed(1)} ${PT + plotH} Z`;

  // approximate path length for stroke-dasharray reveal
  let approxLen = 0;
  for (let i = 1; i < n; i++)
  {
    const dx = xAt(i) - xAt(i - 1);
    const dy = yAt(days[i].contributionCount) - yAt(days[i - 1].contributionCount);
    approxLen += Math.hypot(dx, dy);
  }
  approxLen = Math.ceil(approxLen);

  // month tick labels (first day of each month within range)
  const ticks = [];
  let lastMonth = -1;
  for (let i = 0; i < n; i++)
  {
    const d = new Date(days[i].date + 'T00:00:00Z');
    if (d.getUTCMonth() !== lastMonth)
    {
      lastMonth = d.getUTCMonth();
      const label = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      ticks.push({ x: xAt(i), label });
    }
  }

  // gridlines (4 horizontal)
  let grid = '';
  for (let k = 1; k <= 3; k++)
  {
    const y = PT + (plotH * k) / 4;
    grid += `<line x1="${PL}" y1="${y}" x2="${PL + plotW}" y2="${y}" stroke="${p.grid}" stroke-width="1"/>`;
  }

  // tick labels
  let tickLabels = '';
  for (const t of ticks)
  {
    tickLabels += `<text x="${t.x.toFixed(1)}" y="${PT + plotH + 16}" font-size="10" fill="${p.muted}" text-anchor="middle">${t.label}</text>`;
  }

  // last-point pulse + animated traveling dot
  const lastX = xAt(n - 1), lastY = yAt(days[n - 1].contributionCount);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contributions in the last year">
  <defs>${chromeDefs(id, dark, accentA, accentB)}
    <linearGradient id="area-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${accentA}" stop-opacity="${dark ? 0.55 : 0.35}"/>
      <stop offset="100%" stop-color="${accentA}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="line-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accentA}"/>
      <stop offset="100%" stop-color="${accentB}"/>
    </linearGradient>
    <clipPath id="clip-${id}"><rect x="0" y="0" width="${W}" height="${H}" rx="${RX}" ry="${RX}"/></clipPath>
  </defs>
  ${f.bg}
  ${f.border}
  ${f.motes}

  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">
    <text x="28" y="42" font-size="11" font-weight="700" fill="${p.muted}" letter-spacing="2.2">CONTRIBUTIONS · LAST 365 DAYS</text>
    <text x="28" y="78" font-size="36" font-weight="800" fill="${p.ink}" letter-spacing="-0.8">${fmtNum(totalContrib)}</text>
    <text x="${28 + 10 + (String(fmtNum(totalContrib)).length * 22)}" y="78" font-size="13" font-weight="600" fill="${p.muted}">contributions</text>

    <g text-anchor="end">
      <text x="${W - 28}" y="42" font-size="11" font-weight="700" fill="${p.muted}" letter-spacing="2.2">PEAK DAY</text>
      <text x="${W - 28}" y="64" font-size="16" font-weight="800" fill="${p.ink}">${busiest.contributionCount}</text>
      <text x="${W - 28}" y="80" font-size="11" font-weight="600" fill="${p.muted}">${busiest.date}</text>
    </g>
  </g>

  <g>${grid}</g>

  <path d="${area}" fill="url(#area-${id})" opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="1.4s" begin="0.4s" fill="freeze"/>
  </path>

  <path d="${line}" fill="none" stroke="url(#line-${id})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
    stroke-dasharray="${approxLen}" stroke-dashoffset="${approxLen}">
    <animate attributeName="stroke-dashoffset" from="${approxLen}" to="0" dur="2s" begin="0.2s" fill="freeze"/>
  </path>

  <g opacity="0">
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3.5" fill="${accentB}"/>
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="6" fill="${accentB}" fill-opacity="0.3">
      <animate attributeName="r" values="6;12;6" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="fill-opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite"/>
    </circle>
    <animate attributeName="opacity" from="0" to="1" dur="0.6s" begin="2.1s" fill="freeze"/>
  </g>

  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">${tickLabels}</g>
</svg>
`;
}

// ----- stats strip -----
function svgStats(dark)
{
  const stats = [
    { label: 'COMMITS', value: fmtNum(totalCommits) },
    { label: 'PULL REQS', value: fmtNum(totalPRs) },
    { label: 'REVIEWS', value: fmtNum(totalReviews) },
    { label: 'ISSUES', value: fmtNum(totalIssues) },
    { label: 'STARS', value: fmtNum(totalStars) },
    { label: 'REPOS', value: fmtNum(totalRepos) },
    { label: 'FOLLOWERS', value: fmtNum(followers) },
  ];
  const W = 880, H = 120, RX = 12;
  const id = `st-${dark ? 'd' : 'l'}`;
  const p = dark ? PALETTE.dark : PALETTE.light;
  const accentA = ACCENTS.stats.a, accentB = ACCENTS.stats.b;
  const perimeter = 2 * (W - 2 + H - 2) - 8 * (RX - 0.5) + 2 * Math.PI * (RX - 0.5);
  const f = chromeFrame(id, W, H, RX, dark, accentA, accentB, perimeter);

  const PAD = 28;
  const innerW = W - PAD * 2;
  const colW = innerW / stats.length;

  let cells = '';
  let dividers = '';
  for (let i = 0; i < stats.length; i++)
  {
    const cx = PAD + colW * i + colW / 2;
    const s = stats[i];
    cells += `
    <g text-anchor="middle">
      <text x="${cx.toFixed(1)}" y="56" font-size="28" font-weight="800" fill="${p.ink}" letter-spacing="-0.6" opacity="0">
        ${escapeXml(s.value)}
        <animate attributeName="opacity" from="0" to="1" dur="0.6s" begin="${0.15 + i * 0.08}s" fill="freeze"/>
      </text>
      <text x="${cx.toFixed(1)}" y="78" font-size="10" font-weight="700" fill="${p.muted}" letter-spacing="2">${escapeXml(s.label)}</text>
    </g>`;
    if (i > 0)
    {
      const dx = PAD + colW * i;
      dividers += `<line x1="${dx.toFixed(1)}" y1="32" x2="${dx.toFixed(1)}" y2="88" stroke="${p.grid}" stroke-width="1"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Activity stats">
  <defs>${chromeDefs(id, dark, accentA, accentB)}
    <clipPath id="clip-${id}"><rect x="0" y="0" width="${W}" height="${H}" rx="${RX}" ry="${RX}"/></clipPath>
  </defs>
  ${f.bg}
  ${f.border}
  ${f.motes}
  <g>${dividers}</g>
  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">${cells}</g>
</svg>
`;
}

// ----- streak card -----
function svgStreak(dark)
{
  const tiles = [
    { label: 'CURRENT STREAK', value: `${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}` },
    { label: 'LONGEST STREAK', value: `${longestStreak} ${longestStreak === 1 ? 'day' : 'days'}` },
    { label: 'ACTIVE DAYS', value: fmtNum(days.filter(d => d.contributionCount > 0).length) + ' / 365' },
  ];
  const W = 880, H = 110, RX = 12;
  const id = `sk-${dark ? 'd' : 'l'}`;
  const p = dark ? PALETTE.dark : PALETTE.light;
  const accentA = ACCENTS.streak.a, accentB = ACCENTS.streak.b;
  const perimeter = 2 * (W - 2 + H - 2) - 8 * (RX - 0.5) + 2 * Math.PI * (RX - 0.5);
  const f = chromeFrame(id, W, H, RX, dark, accentA, accentB, perimeter);

  const PAD = 28;
  const innerW = W - PAD * 2;
  const colW = innerW / tiles.length;

  let cells = '';
  let dividers = '';
  for (let i = 0; i < tiles.length; i++)
  {
    const cx = PAD + colW * i + colW / 2;
    const t = tiles[i];
    cells += `
    <g text-anchor="middle">
      <text x="${cx.toFixed(1)}" y="52" font-size="24" font-weight="800" fill="${p.ink}" letter-spacing="-0.4" opacity="0">
        ${escapeXml(t.value)}
        <animate attributeName="opacity" from="0" to="1" dur="0.6s" begin="${0.2 + i * 0.12}s" fill="freeze"/>
      </text>
      <text x="${cx.toFixed(1)}" y="74" font-size="10" font-weight="700" fill="${p.muted}" letter-spacing="2.2">${escapeXml(t.label)}</text>
    </g>`;
    if (i > 0)
    {
      const dx = PAD + colW * i;
      dividers += `<line x1="${dx.toFixed(1)}" y1="28" x2="${dx.toFixed(1)}" y2="82" stroke="${p.grid}" stroke-width="1"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Activity streak">
  <defs>${chromeDefs(id, dark, accentA, accentB)}
    <clipPath id="clip-${id}"><rect x="0" y="0" width="${W}" height="${H}" rx="${RX}" ry="${RX}"/></clipPath>
  </defs>
  ${f.bg}
  ${f.border}
  ${f.motes}
  <g>${dividers}</g>
  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">${cells}</g>
</svg>
`;
}

const ARTIFACTS = [
  { id: 'activity-year', render: svgYear, alt: 'Contributions in the last year' },
  { id: 'activity-stats', render: svgStats, alt: 'GitHub stats' },
  { id: 'activity-streak', render: svgStreak, alt: 'Streak' },
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

// ----- inject into README between markers -----
const ts = Date.now().toString(36);
const block = ARTIFACTS.map(a =>
{
  const { darkHash, lightHash } = manifest[a.id];
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/${a.id}-dark.svg?v=${darkHash}&t=${ts}"><img alt="${escapeXml(a.alt)}" src="${RAW}/${a.id}-light.svg?v=${lightHash}&t=${ts}" /></picture>`;
}).join('<br/>\n  ');

const wrapped = `<!-- activity:start -->\n  ${block}\n<!-- activity:end -->`;

const README = resolve(ROOT, 'README.md');
let md = readFileSync(README, 'utf8');

if (md.includes('<!-- activity:start -->') && md.includes('<!-- activity:end -->'))
{
  md = md.replace(/<!-- activity:start -->[\s\S]*?<!-- activity:end -->/, wrapped);
} else
{
  // insert a fresh Activity section right before Stack
  const stackIdx = md.indexOf('### Stack');
  const section = `### Activity\n\n<p align="center">\n  ${block}\n</p>\n\n`;
  if (stackIdx >= 0)
  {
    md = md.slice(0, stackIdx) + section.replace(`  ${block}`, `<!-- activity:start -->\n  ${block}\n<!-- activity:end -->`) + md.slice(stackIdx);
  } else
  {
    md += `\n\n### Activity\n\n<p align="center">\n${wrapped}\n</p>\n`;
  }
}

writeFileSync(README, md);
console.log('README updated (activity block)');
