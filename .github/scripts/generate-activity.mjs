#!/usr/bin/env node

import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT, tokens, escapeXml, fmtNum, plural } from './datasheet.mjs';

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

// Private data (private repo commits, private repo stars/languages) is only returned when the
// token is a classic PAT owned by OWNER carrying the `repo` scope. Without it GitHub silently
// degrades to public-only numbers, so we probe for that below and warn instead of quietly
// publishing a smaller card.
const PROFILE_QUERY = `query($login: String!) {
  viewer { login }
  user(login: $login) {
    createdAt
    contributionsCollection {
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const REPOS_QUERY = `query($login: String!, $after: String) {
  user(login: $login) {
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, isFork: false) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        isPrivate
        stargazerCount
        languages(first: 30) { nodes { name } }
      }
    }
  }
}`;

const profile = await gql(PROFILE_QUERY, { login: OWNER });
const viewerLogin = profile.viewer?.login ?? null;
const data = profile.user;

async function fetchRepos()
{
  const nodes = [];
  let totalCount = 0;
  let after = null;
  do
  {
    const page = (await gql(REPOS_QUERY, { login: OWNER, after })).user.repositories;
    totalCount = page.totalCount;
    nodes.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return { nodes, totalCount };
}

const repoData = await fetchRepos();

// All-time contribution totals: iterate yearly windows to now. contributionsCollection
// accepts a max 1-year window, so we chunk. We start from a fixed history floor rather than
// the account's creation date: after transferring repos in and rewriting authorship, the
// account is younger than its own commit history, but GitHub still attributes those
// historical commits to the new owner - so anchoring to createdAt would drop every commit
// dated before the account existed.
const HISTORY_FLOOR = '2016-01-01T00:00:00Z';
async function fetchAllTimeTotals(createdAt)
{
  const start = new Date(Math.min(new Date(createdAt).getTime(), new Date(HISTORY_FLOOR).getTime()));
  const now = new Date();
  const totals = { commits: 0, prs: 0, issues: 0, reviews: 0, restricted: 0 };
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
          restrictedContributionsCount
        }
      }
    }`;
    const d = await gql(q, { login: OWNER, from: from.toISOString(), to: to.toISOString() });
    const c = d.user.contributionsCollection;
    totals.commits += c.totalCommitContributions;
    totals.prs += c.totalPullRequestContributions;
    totals.issues += c.totalIssueContributions;
    totals.reviews += c.totalPullRequestReviewContributions;
    // Contributions the token cannot resolve individually but that the profile shares as a count.
    // Zero whenever the token can already see the private repos, so this never double counts.
    totals.restricted += c.restrictedContributionsCount;
    cursor = to;
  }
  return totals;
}

const allTime = await fetchAllTimeTotals(data.createdAt);

const userRest = await rest(`/users/${OWNER}`);

// total_private_repos is only present when the token authenticates as OWNER, and it reports every
// private repo the account owns regardless of what the token may read. Comparing it against the
// private repos the repo query actually returned catches a fine-grained PAT pinned to a subset of
// repositories, which otherwise degrades silently: stars/languages quietly drop the repos it
// cannot see, and only the restricted-contribution fallback keeps the commit count whole.
const privateRepos = userRest.total_private_repos;
const visiblePrivateRepos = repoData.nodes.filter(r => r.isPrivate).length;
const includesPrivate = viewerLogin === OWNER && typeof privateRepos === 'number';
if (!includesPrivate)
{
  console.warn(`  ! token does not authenticate as ${OWNER} (viewer: ${viewerLogin ?? 'unknown'});`);
  console.warn('    cards fall back to public-only figures.');
}
else if (visiblePrivateRepos < privateRepos)
{
  console.warn(`  ! token reads only ${visiblePrivateRepos} of ${privateRepos} private repos.`);
  console.warn('    Commit totals stay whole via restrictedContributionsCount, but stars and');
  console.warn('    languages undercount. Grant the PAT access to all repositories.');
}

const languageSet = new Set();
for (const repo of repoData.nodes)
  for (const lang of (repo.languages?.nodes ?? []))
    languageSet.add(lang.name);

const cal = data.contributionsCollection.contributionCalendar;
const days = cal.weeks.flatMap(w => w.contributionDays);
const totalContrib = cal.totalContributions;
const totalCommits = allTime.commits + allTime.restricted;
const totalPRs = allTime.prs;
const totalReviews = allTime.reviews;
const totalIssues = allTime.issues;
const totalStars = repoData.nodes.reduce((s, n) => s + n.stargazerCount, 0);
const totalRepos = userRest.public_repos + (privateRepos ?? 0);
const totalLanguages = languageSet.size;
const YEAR_DAYS = 365;
const activeDays = days.slice(-YEAR_DAYS).filter(d => d.contributionCount > 0).length;

console.log(`repos ${totalRepos} (${userRest.public_repos} public + ${privateRepos ?? 0} private), languages ${totalLanguages}, stars ${totalStars}`);
console.log(`commits ${totalCommits}${allTime.restricted ? ` (incl. ${allTime.restricted} restricted)` : ''}, prs ${totalPRs}, reviews ${totalReviews}, issues ${totalIssues}`);

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

const STATS_SUBTITLE = includesPrivate ? 'Including private repositories' : 'Public repositories only';

const CARD_W = 415;
const CARD_H = 178;
const PAD_X = 2;
const TITLE_Y = 20;
const TITLE_RULE_Y = 30;

/**
 * Formats a calendar date as a short month and year, such as "Sep 2025".
 * @param {string} iso
 * @returns {string}
 */
function monthYear(iso)
{
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Draws the shared frame of a datasheet table: opening ink rule, title, meta text, and title rule.
 * @param {ReturnType<typeof tokens>} t
 * @param {string} title
 * @param {string} meta
 * @returns {string}
 */
function tableFrame(t, title, meta)
{
  return `<rect x="0" y="0" width="${CARD_W}" height="1.5" fill="${t.ink}"/>
  <text x="${PAD_X}" y="${TITLE_Y}" font-size="14" font-weight="600" fill="${t.ink}">${escapeXml(title)}</text>
  <text x="${CARD_W - PAD_X}" y="${TITLE_Y}" text-anchor="end" font-size="12" fill="${t.muted}">${escapeXml(meta)}</text>
  <rect x="0" y="${TITLE_RULE_Y}" width="${CARD_W}" height="1" fill="${t.rule}"/>
  <rect x="0" y="${CARD_H - 1}" width="${CARD_W}" height="1" fill="${t.rule}"/>`;
}

/**
 * Draws parameter rows: label on the left, value on the right, a hairline between rows.
 * @param {ReturnType<typeof tokens>} t
 * @param {{ label: string, value: string }[]} rows
 * @param {number} top
 * @param {number} rowH
 * @returns {string}
 */
function tableRows(t, rows, top, rowH)
{
  return rows.map((r, i) =>
  {
    const y = top + rowH * i;
    const baseline = y + rowH / 2 + 5.5;
    const rule = i < rows.length - 1 ? `\n  <rect x="0" y="${y + rowH - 0.5}" width="${CARD_W}" height="1" fill="${t.rule}"/>` : '';
    return `<text x="${PAD_X}" y="${baseline}" font-size="14" fill="${t.muted}">${escapeXml(r.label)}</text>
  <text x="${CARD_W - PAD_X}" y="${baseline}" text-anchor="end" font-size="15" font-weight="600" fill="${t.ink}">${escapeXml(r.value)}</text>${rule}`;
  }).join('\n  ');
}

const contributionRows = [
  { label: 'Current streak', value: `${fmtNum(currentStreak)} ${plural(currentStreak, 'day')}` },
  { label: 'Longest streak', value: `${fmtNum(longestStreak)} ${plural(longestStreak, 'day')}` },
];

const statRows = [
  { label: 'Commits, all time', n: totalCommits, value: fmtNum(totalCommits), spoken: `${fmtNum(totalCommits)} ${plural(totalCommits, 'commit')} all time` },
  { label: 'Pull requests, all time', n: totalPRs, value: fmtNum(totalPRs), spoken: `${fmtNum(totalPRs)} ${plural(totalPRs, 'pull request')} all time` },
  { label: 'Active days, last year', n: activeDays, value: `${activeDays} of ${YEAR_DAYS}`, spoken: `active on ${activeDays} of the last ${YEAR_DAYS} days` },
  { label: 'Languages', n: totalLanguages, value: fmtNum(totalLanguages), spoken: `${fmtNum(totalLanguages)} ${plural(totalLanguages, 'language')}` },
].filter(r => r.n > 0);

const contributionsMeta = `${fmtNum(totalContrib)} in the last year`;

function svgContributions(dark)
{
  const t = tokens(dark);
  const plotTop = 44;
  const plotH = 52;
  const plotLeft = PAD_X;
  const plotRight = CARD_W - PAD_X;
  const plotW = plotRight - plotLeft;
  const baseY = plotTop + plotH;

  const n = days.length;
  const xAt = i => plotLeft + (i / (n - 1)) * plotW;
  const yAt = v => plotTop + plotH - (v / maxDay) * plotH;

  let line = '';
  let length = 0;
  for (let i = 0; i < n; i++)
  {
    const x = xAt(i), y = yAt(days[i].contributionCount);
    line += (i === 0 ? 'M ' : ' L ') + x.toFixed(1) + ' ' + y.toFixed(1);
    if (i > 0) length += Math.hypot(x - xAt(i - 1), y - yAt(days[i - 1].contributionCount));
  }
  length = Math.ceil(length);
  const lastX = xAt(n - 1), lastY = yAt(days[n - 1].contributionCount);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" role="img" aria-label="Contributions: ${escapeXml(contributionsMeta)}">
<g font-family="${FONT}" style="font-variant-numeric: tabular-nums">
  ${tableFrame(t, 'Contributions', contributionsMeta)}
  <rect x="${plotLeft}" y="${plotTop}" width="${plotW}" height="1" fill="${t.rule}" opacity="0.6"/>
  <rect x="${plotLeft}" y="${plotTop + plotH / 2}" width="${plotW}" height="1" fill="${t.rule}" opacity="0.6"/>
  <text x="${plotLeft}" y="${plotTop - 3}" font-size="10.5" fill="${t.muted}">${fmtNum(maxDay)} per day</text>
  <text x="${plotLeft}" y="${plotTop + plotH / 2 - 3}" font-size="10.5" fill="${t.muted}">${fmtNum(Math.round(maxDay / 2))}</text>
  <rect x="${plotLeft}" y="${baseY}" width="${plotW}" height="1" fill="${t.rule}"/>
  <path d="${line}" fill="none" stroke="${t.trace}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="${length}" stroke-dashoffset="0">
    <animate attributeName="stroke-dashoffset" from="${length}" to="0" dur="1.2s" fill="freeze"/>
  </path>
  <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.5" fill="${t.trace}"/>
  <text x="${plotLeft}" y="${baseY + 14}" font-size="11.5" fill="${t.muted}">${monthYear(days[0].date)}</text>
  <text x="${plotRight}" y="${baseY + 14}" text-anchor="end" font-size="11.5" fill="${t.muted}">${monthYear(days[n - 1].date)}</text>
  <rect x="0" y="122" width="${CARD_W}" height="1" fill="${t.rule}"/>
  ${tableRows(t, contributionRows, 123, 27)}
</g>
</svg>
`;
}

function svgStats(dark)
{
  const t = tokens(dark);
  const top = TITLE_RULE_Y + 1;
  const rowH = (CARD_H - 1 - top) / statRows.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" role="img" aria-label="Stats: ${escapeXml(STATS_SUBTITLE)}">
<g font-family="${FONT}" style="font-variant-numeric: tabular-nums">
  ${tableFrame(t, 'Stats', STATS_SUBTITLE)}
  ${tableRows(t, statRows, top, rowH)}
</g>
</svg>
`;
}

const ARTIFACTS = [
  {
    id: 'activity-contributions',
    render: svgContributions,
    alt: `Contributions: ${contributionsMeta}; ${contributionRows.map(r => `${r.label.toLowerCase()} ${r.value}`).join('; ')}`,
  },
  {
    id: 'activity-stats',
    render: svgStats,
    alt: `Stats, ${STATS_SUBTITLE.toLowerCase()}: ${statRows.map(r => r.spoken).join('; ')}`,
  },
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
