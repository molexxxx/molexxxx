import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const USER = process.env.GH_USER || 'tonywied17';
const NPM_USER = process.env.NPM_USER || 'molex222';
const TOKEN = process.env.GITHUB_TOKEN;

// Curated repo icons (matches the GitHub profile README). Unknown repos render
// a generated letter tile in the client.
const ICON_MAP = {
  'zero-query': 'https://raw.githubusercontent.com/tonywied17/zero-query/main/.github/images/logo-animated.svg',
  'zero-server': 'https://raw.githubusercontent.com/tonywied17/zero-server/main/website-docs/public/icons/logo-animated.svg',
  'zero-transfer': 'https://tonywied17.github.io/zero-transfer/assets/zero-transfer-logo.svg',
  'molex-media-electron': 'https://raw.githubusercontent.com/tonywied17/molex-media-electron/main/.github/assets/logo.svg',
  'bladewake-demo': 'https://raw.githubusercontent.com/tonywied17/bladewake-demo/main/assets/bladewake_icon.svg',
  'MagnifyShit-cpp': 'https://raw.githubusercontent.com/tonywied17/MagnifyShit-cpp/main/.github/assets/icon.svg',
};
const iconFor = (name) => ICON_MAP[name] ?? null;

// Repos to hide from the live grid (e.g. WIP/abandoned).
const EXCLUDE = new Set(['ng-juwanji']);

// Forks worth pinning. We replace the fork's stats (always 0★) with the
// upstream's so the grid reflects the project's real reach.
const INCLUDE_FORKS = ['plex-poster-set-helper'];

const headers = {
  'User-Agent': `${USER}-resume-build`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub ${path} → ${res.status} ${res.statusText}`);
  return res.json();
}

async function safe(promise, fallback) {
  try { return await promise; } catch (e) { console.warn('  ! github fetch failed:', e.message); return fallback; }
}

const user = await safe(gh(`/users/${USER}`), null);

const allRepos = await safe(gh(`/users/${USER}/repos?per_page=100&sort=pushed&type=owner`), []);

// Public gists count.
async function fetchGistsCount() {
  const list = await safe(gh(`/users/${USER}/gists?per_page=100`), []);
  return Array.isArray(list) ? list.length : 0;
}

// Published npm packages for the registered npm user.
async function fetchNpmCount() {
  try {
    const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=maintainer:${NPM_USER}&size=250`, {
      headers: { 'User-Agent': `${USER}-resume-build`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`npm ${res.status}`);
    const json = await res.json();
    return json.total ?? (Array.isArray(json.objects) ? json.objects.length : 0);
  } catch (e) {
    console.warn('  ! npm fetch failed:', e.message);
    return 0;
  }
}

const [gistsCount, npmCount] = await Promise.all([fetchGistsCount(), fetchNpmCount()]);

// Resolve upstream stats for any pinned forks so we can present them honestly.
async function resolveFork(name) {
  const detail = await safe(gh(`/repos/${USER}/${name}`), null);
  if (!detail) return null;
  const src = detail.source ?? detail.parent;
  const upstreamStars = src?.stargazers_count ?? detail.stargazers_count;
  const upstreamForks = src?.forks_count ?? detail.forks_count;
  return {
    ...detail,
    stargazers_count: upstreamStars,
    forks_count: upstreamForks,
    _upstream: src ? src.full_name : null,
  };
}

const forkDetails = (await Promise.all(INCLUDE_FORKS.map(resolveFork))).filter(Boolean);

const combined = [
  ...allRepos.filter((r) => !r.fork && !r.archived && !EXCLUDE.has(r.name)),
  ...forkDetails,
];

const repos = combined
  .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (Date.parse(b.pushed_at) - Date.parse(a.pushed_at)))
  .slice(0, 9)
  .map((r) => ({
    name: r.name,
    full_name: r.full_name,
    description: r.description,
    url: r.html_url,
    homepage: r.homepage,
    language: r.language,
    topics: r.topics ?? [],
    stars: r.stargazers_count,
    forks: r.forks_count,
    pushed_at: r.pushed_at,
    icon: iconFor(r.name),
    initial: (r.name || '?').charAt(0).toUpperCase(),
    upstream: r._upstream ?? null,
  }));

const totalStars = combined.reduce((s, r) => s + r.stargazers_count, 0);

const out = {
  user: user
    ? {
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
        bio: user.bio,
        html_url: user.html_url,
        followers: user.followers,
        following: user.following,
        public_repos: user.public_repos,
      }
    : null,
  totals: { stars: totalStars, repos: allRepos.length, gists: gistsCount, npm: npmCount },
  repos,
  fetched_at: new Date().toISOString(),
};

mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/github.json'), JSON.stringify(out, null, 2));
writeFileSync(resolve(root, 'data.github.json'), JSON.stringify(out, null, 2));
console.log(`  ✓ github data (${repos.length} repos, ${totalStars}★, ${gistsCount} gists, ${npmCount} npm)`);
