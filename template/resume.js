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
const GH_CACHE_KEY = 'resume-gh-cache-v2';
const GH_CACHE_TTL_MS = 30 * 60 * 1000;

// Curated repo icons (mirrors fetch-github.js).
const ICON_MAP = {
  'zero-query': 'https://raw.githubusercontent.com/tonywied17/zero-query/main/.github/images/logo-animated.svg',
  'zero-server': 'https://raw.githubusercontent.com/tonywied17/zero-server/main/website-docs/public/icons/logo-animated.svg',
  'zero-transfer': 'https://tonywied17.github.io/zero-transfer/assets/zero-transfer-logo.svg',
  'molex-media-electron': 'https://raw.githubusercontent.com/tonywied17/molex-media-electron/main/.github/assets/logo.svg',
  'bladewake-demo': 'https://raw.githubusercontent.com/tonywied17/bladewake-demo/main/assets/bladewake_icon.svg',
};

const EXCLUDE = new Set(['ng-juwanji']);
const INCLUDE_FORKS = ['plex-poster-set-helper'];

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
  const headers = { Accept: 'application/vnd.github+json' };
  const [listRes, ...forkRes] = await Promise.all([
    fetch('https://api.github.com/users/tonywied17/repos?per_page=100&sort=pushed&type=owner', { headers }),
    ...INCLUDE_FORKS.map((n) => fetch(`https://api.github.com/repos/tonywied17/${n}`, { headers })),
  ]);
  if (!listRes.ok) throw new Error(`gh ${listRes.status}`);
  const all = await listRes.json();
  const forks = (await Promise.all(forkRes.map(async (r) => {
    if (!r.ok) return null;
    const d = await r.json();
    const src = d.source ?? d.parent;
    return {
      ...d,
      stargazers_count: src?.stargazers_count ?? d.stargazers_count,
      forks_count: src?.forks_count ?? d.forks_count,
      fork: false,
    };
  }))).filter(Boolean);
  const merged = [...all.filter((r) => !EXCLUDE.has(r.name)), ...forks];
  writeCache(merged);
  return { repos: merged, fromCache: false };
}

async function refreshRepos() {
  const grid = document.getElementById('repos');
  if (!grid) return;
  try {
    const { repos: all } = await fetchRepos();
    const repos = all
      .filter((r) => !r.fork && !r.archived && !EXCLUDE.has(r.name))
      .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (Date.parse(b.pushed_at) - Date.parse(a.pushed_at)))
      .slice(0, 9);
    grid.innerHTML = repos.map(repoCard).join('');
    grid.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));

    const stars = all.reduce((s, r) => s + (r.fork ? 0 : r.stargazers_count), 0);
    setStat('Stars', stars);
    setStat('Repos', all.length);
  } catch { /* offline / rate-limited - keep build-time content */ }
}

function repoCard(r) {
  const esc = (s) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const initial = (r.name || '?').charAt(0).toUpperCase();
  const icon = ICON_MAP[r.name];
  const iconEl = icon
    ? `<img class="card-icon" src="${esc(icon)}" alt="" loading="lazy" data-initial="${esc(initial)}" onerror="const s=document.createElement('span');s.className='card-icon letter';s.textContent=this.dataset.initial;this.replaceWith(s);" />`
    : `<span class="card-icon letter">${esc(initial)}</span>`;
  return `<a class="card repo reveal in" href="${esc(r.html_url)}" target="_blank" rel="noopener">
    <div class="card-row">
      ${iconEl}
      <div class="card-body">
        <div class="repo-head"><h3>${esc(r.name)}</h3><span class="arrow">↗</span></div>
        <p class="repo-desc">${esc(r.description ?? '')}</p>
        <div class="repo-meta">
          ${r.language ? `<span class="tag lang" data-lang="${esc(r.language)}"><span class="dot"></span>${esc(r.language)}</span>` : ''}
          <span class="tag">★ ${r.stargazers_count}</span>
          ${r.forks_count ? `<span class="tag">⑂ ${r.forks_count}</span>` : ''}
        </div>
      </div>
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

// --------------------------------------------------------------------
// Animated background: a constellation of nodes that drift, link to
// nearby neighbors, and are pulled toward the mouse. Cards "boost" the
// field while hovered to feel reactive.
// --------------------------------------------------------------------
(function bgFx() {
  const canvas = document.getElementById('bg-fx');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  let DPR = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  let nodes = [];
  const mouse = { x: -9999, y: -9999, active: false };
  let boost = 0; // 0..1, ramps when a card is hovered

  function accentColor() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    return v || '#3b82f6';
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return [59, 130, 246];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }

  function seed() {
    // Density: ~1 node per 14k px², capped for big screens / mobile.
    const target = Math.min(110, Math.max(40, Math.round((w * h) / 14000)));
    nodes = new Array(target).fill(0).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 0.8 + Math.random() * 1.6,
    }));
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });
  window.addEventListener('mouseleave', () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999; });

  // Cards lift the boost while hovered.
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest?.('.card, .hero-card, .skill-row')) {
      document.body.classList.add('fx-boost');
    }
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest?.('.card, .hero-card, .skill-row')) {
      document.body.classList.remove('fx-boost');
    }
  });

  resize();

  const LINK_DIST = 130;
  const MOUSE_PULL = 140;

  function tick() {
    const [r, g, b] = hexToRgb(accentColor());
    // Smoothly chase the boost target so transitions feel velvety.
    const target = document.body.classList.contains('fx-boost') ? 1 : 0;
    boost += (target - boost) * 0.06;

    ctx.clearRect(0, 0, w, h);

    for (const n of nodes) {
      // Gentle drift
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
      if (n.y < -10) n.y = h + 10; else if (n.y > h + 10) n.y = -10;

      // Mouse magnetism
      if (mouse.active) {
        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_PULL * MOUSE_PULL) {
          const d = Math.sqrt(d2) || 1;
          const pull = (1 - d / MOUSE_PULL) * 0.6;
          n.x += (dx / d) * pull;
          n.y += (dy / d) * pull;
        }
      }
    }

    // Edges
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const c = nodes[j];
        const dx = a.x - c.x;
        const dy = a.y - c.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < LINK_DIST * LINK_DIST) {
          const t = 1 - Math.sqrt(d2) / LINK_DIST;
          const alpha = (0.10 + 0.35 * boost) * t;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
      }
    }

    // Nodes
    const dotAlpha = 0.55 + 0.35 * boost;
    ctx.fillStyle = `rgba(${r},${g},${b},${dotAlpha.toFixed(3)})`;
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cursor halo
    if (mouse.active) {
      const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 180);
      grad.addColorStop(0, `rgba(${r},${g},${b},${(0.18 + 0.25 * boost).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 180, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
