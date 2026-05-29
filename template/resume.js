// Theme toggle
const root = document.documentElement;
const KEY = 'resume-theme';
const saved = localStorage.getItem(KEY);
if (saved) root.setAttribute('data-theme', saved);
else if (window.matchMedia('(prefers-color-scheme: light)').matches) root.setAttribute('data-theme', 'light');

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem(KEY, next);
});

// Footer year
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

// Reveal on scroll
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    }
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
);
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// Refresh GitHub data live, with a 30-minute localStorage cache so we don't
// burn through the 60-req/hr unauthenticated GitHub API rate limit per visitor.
const GH_CACHE_KEY = 'resume-gh-cache-v1';
const GH_CACHE_TTL_MS = 30 * 60 * 1000;

function readCache() {
  try {
    const raw = localStorage.getItem(GH_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.t !== 'number' || !Array.isArray(entry.data)) return null;
    if (Date.now() - entry.t > GH_CACHE_TTL_MS) return null;
    return entry.data;
  } catch { return null; }
}

function writeCache(data) {
  try { localStorage.setItem(GH_CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch {}
}

async function fetchRepos() {
  const cached = readCache();
  if (cached) return { repos: cached, fromCache: true };
  const res = await fetch('https://api.github.com/users/tonywied17/repos?per_page=100&sort=pushed&type=owner', {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`gh ${res.status}`);
  const all = await res.json();
  writeCache(all);
  return { repos: all, fromCache: false };
}

async function refreshRepos() {
  const grid = document.getElementById('repos');
  if (!grid) return;
  try {
    const { repos: all } = await fetchRepos();
    const repos = all
      .filter((r) => !r.fork && !r.archived)
      .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (Date.parse(b.pushed_at) - Date.parse(a.pushed_at)))
      .slice(0, 9);
    grid.innerHTML = repos.map(repoCard).join('');
    grid.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));

    const stars = all.reduce((s, r) => s + (r.fork ? 0 : r.stargazers_count), 0);
    setStat('Stars', stars);
    setStat('Repos', all.length);
  } catch { /* offline / rate-limited — keep build-time content */ }
}

function repoCard(r) {
  const esc = (s) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<a class="card repo reveal in" href="${esc(r.html_url)}" target="_blank" rel="noopener">
    <div class="repo-head"><h3>${esc(r.name)}</h3><span class="arrow">↗</span></div>
    <p class="repo-desc">${esc(r.description ?? '')}</p>
    <div class="repo-meta">
      ${r.language ? `<span class="tag lang" data-lang="${esc(r.language)}"><span class="dot"></span>${esc(r.language)}</span>` : ''}
      <span class="tag">★ ${r.stargazers_count}</span>
      ${r.forks_count ? `<span class="tag">⑂ ${r.forks_count}</span>` : ''}
    </div>
  </a>`;
}

function setStat(label, value) {
  for (const s of document.querySelectorAll('.stat')) {
    const lbl = s.querySelector('.lbl');
    if (lbl?.textContent?.trim().toLowerCase() === label.toLowerCase()) {
      const num = s.querySelector('.num');
      if (num) num.textContent = String(value);
    }
  }
}

refreshRepos();
