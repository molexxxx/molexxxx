import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const USER = process.env.GH_USER || 'tonywied17';
const TOKEN = process.env.GITHUB_TOKEN;

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

// Pull all (non-fork) repos
const allRepos = await safe(gh(`/users/${USER}/repos?per_page=100&sort=pushed&type=owner`), []);
const repos = allRepos
  .filter((r) => !r.fork && !r.archived)
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
  }));

const totalStars = allRepos.reduce((s, r) => s + (r.fork ? 0 : r.stargazers_count), 0);

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
  totals: { stars: totalStars, repos: allRepos.length },
  repos,
  fetched_at: new Date().toISOString(),
};

mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/github.json'), JSON.stringify(out, null, 2));
writeFileSync(resolve(root, 'data.github.json'), JSON.stringify(out, null, 2));
console.log(`  ✓ github data (${repos.length} repos, ${totalStars}★)`);
