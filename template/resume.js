/* -------------------------------------------------------------------------- */
/*                                Theme toggle                                */
/* -------------------------------------------------------------------------- */

const root = document.documentElement;
const THEME_STORAGE_KEY = 'resume-theme';
const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
if (savedTheme) root.setAttribute('data-theme', savedTheme);
else if (window.matchMedia('(prefers-color-scheme: light)').matches) root.setAttribute('data-theme', 'light');

document.getElementById('theme-toggle')?.addEventListener('click', () =>
{
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
});

/* -------------------------------------------------------------------------- */
/*                              Mobile nav drawer                             */
/* -------------------------------------------------------------------------- */

(() =>
{
  const nav = document.querySelector('.nav');
  const toggle = document.getElementById('nav-toggle');
  const scrim = document.getElementById('nav-scrim');
  const links = document.getElementById('nav-links');
  if (!nav || !toggle || !links) return;

  /**
   * Toggle the mobile navigation drawer open/closed and sync the related
   * accessibility attributes and body scroll lock.
   *
   * @param {boolean} open True to open the drawer, false to close it.
   * @returns {void}
   */
  const setOpen = (open) =>
  {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  scrim?.addEventListener('click', () => setOpen(false));
  links.addEventListener('click', (e) =>
  {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) =>
  {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false);
  });
  const mq = window.matchMedia('(min-width: 769px)');
  mq.addEventListener?.('change', (e) => { if (e.matches) setOpen(false); });
})();

/* -------------------------------------------------------------------------- */
/*                              Footer year stamp                             */
/* -------------------------------------------------------------------------- */

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* -------------------------------------------------------------------------- */
/*                          Reveal-on-scroll observer                         */
/* -------------------------------------------------------------------------- */

const revealObserver = new IntersectionObserver(
  (entries) =>
  {
    for (const entry of entries)
    {
      if (entry.isIntersecting)
      {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

/* -------------------------------------------------------------------------- */
/*                          GitHub repo grid (client)                         */
/* -------------------------------------------------------------------------- */

const GH_CACHE_KEY = 'resume-gh-cache-v2';
const GH_CACHE_TTL_MS = 30 * 60 * 1000;

const ICON_MAP = {
  'zero-query': 'https://raw.githubusercontent.com/tonywied17/zero-query/main/.github/images/logo-animated.svg',
  'zero-server': 'https://raw.githubusercontent.com/tonywied17/zero-server/main/website-docs/public/icons/logo-animated.svg',
  'zero-transfer': 'https://tonywied17.github.io/zero-transfer/assets/zero-transfer-logo.svg',
  'molex-media-electron': 'https://raw.githubusercontent.com/tonywied17/molex-media-electron/main/.github/assets/logo.svg',
  'bladewake-demo': 'https://raw.githubusercontent.com/tonywied17/bladewake-demo/main/assets/bladewake_icon.svg',
  'MagnifyShit-cpp': 'https://raw.githubusercontent.com/tonywied17/MagnifyShit-cpp/main/.github/assets/icon.svg',
};

const EXCLUDE = new Set(['ng-juwanji']);
const INCLUDE_FORKS = ['plex-poster-set-helper'];

/**
 * Read the cached GitHub repo payload from `localStorage` if it is still
 * within the configured TTL window.
 *
 * @returns {Array<object>|null} Cached repo list, or `null` when missing,
 *   malformed, or expired.
 */
function readCache()
{
  try
  {
    const raw = localStorage.getItem(GH_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.t !== 'number' || !Array.isArray(entry.data)) return null;
    if (Date.now() - entry.t > GH_CACHE_TTL_MS) return null;
    return entry.data;
  } catch { return null; }
}

/**
 * Persist a fetched GitHub repo payload to `localStorage` with the current
 * timestamp. Silently no-ops if storage is unavailable.
 *
 * @param {Array<object>} data Repo objects as returned by the GitHub API.
 * @returns {void}
 */
function writeCache(data)
{
  try { localStorage.setItem(GH_CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch { }
}

/**
 * Fetch the user's public repos from the GitHub API, merging in any forks
 * configured in {@link INCLUDE_FORKS} with upstream star/fork counts. Returns
 * the cached payload when available to avoid hitting the unauthenticated
 * 60-req/hr rate limit.
 *
 * @returns {Promise<{repos: Array<object>, fromCache: boolean}>} The repo
 *   list and a flag indicating whether it came from the local cache.
 * @throws {Error} If the live GitHub request fails and no cache is available.
 */
async function fetchRepos()
{
  const cached = readCache();
  if (cached) return { repos: cached, fromCache: true };
  const headers = { Accept: 'application/vnd.github+json' };
  const [listRes, ...forkRes] = await Promise.all([
    fetch('https://api.github.com/users/tonywied17/repos?per_page=100&sort=pushed&type=owner', { headers }),
    ...INCLUDE_FORKS.map((n) => fetch(`https://api.github.com/repos/tonywied17/${n}`, { headers })),
  ]);
  if (!listRes.ok) throw new Error(`gh ${listRes.status}`);
  const all = await listRes.json();
  const forks = (await Promise.all(forkRes.map(async (r) =>
  {
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

/**
 * Populate the `#repos` grid with the current top repos by stars (then most
 * recently pushed) and refresh the `Repos` / `Stars` stat counters. Fails
 * silently when offline or rate-limited so the build-time markup remains.
 *
 * @returns {Promise<void>}
 */
async function refreshRepos()
{
  const grid = document.getElementById('repos');
  if (!grid) return;
  try
  {
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

/**
 * Render a single repo as an anchor card matching the build-time markup.
 * All interpolated values are HTML-escaped.
 *
 * @param {object} r GitHub repo object.
 * @returns {string} HTML string for one repo card.
 */
function repoCard(r)
{
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
        <div class="repo-head"><h3>${esc(r.name)}</h3><span class="arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg></span></div>
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

/**
 * Update the numeric value on the hero stat whose label matches `label`
 * (case-insensitive). No-ops if no matching stat is present.
 *
 * @param {string} label Stat label text, e.g. `'Stars'` or `'Repos'`.
 * @param {number|string} value Value to display.
 * @returns {void}
 */
function setStat(label, value)
{
  for (const stat of document.querySelectorAll('.stat'))
  {
    const labelEl = stat.querySelector('.lbl');
    if (labelEl?.textContent?.trim().toLowerCase() === label.toLowerCase())
    {
      const numEl = stat.querySelector('.num');
      if (numEl) numEl.textContent = String(value);
    }
  }
}

refreshRepos();

/* -------------------------------------------------------------------------- */
/*                Background canvas FX + custom DOM cursor                    */
/* -------------------------------------------------------------------------- */

/**
 * Self-invoking module that owns the full-viewport background canvas:
 * parallax starfield, drifting nebula washes, occasional comets, hovered-card
 * embers, cursor spark trail, and the synthetic DOM cursor (with comet-hit
 * shatter/reform). Bails out entirely when the user prefers reduced motion.
 */
(function bgFx()
{
  const canvas = document.getElementById('bg-fx');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  let DPR = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;

  const LAYERS = [
    { count: 0, speed: 0.03, size: [0.25, 0.6], alpha: [0.15, 0.40] },
    { count: 0, speed: 0.07, size: [0.40, 0.9], alpha: [0.25, 0.55] },
    { count: 0, speed: 0.13, size: [0.55, 1.2], alpha: [0.35, 0.70] },
  ];
  let stars = [];
  let nebulae = [];
  let comets = [];
  let embers = [];
  const mouse = { x: -9999, y: -9999, active: false };
  let hoveredCard = null;

  const finePointer = window.matchMedia('(pointer: fine)').matches;
  let cur = null;
  let cursorExploding = false;
  let cursorReformTimer = 0;
  if (finePointer)
  {
    document.documentElement.classList.add('fx-cursor');
    cur = document.createElement('div');
    cur.className = 'fx-cursor-el';
    cur.innerHTML = '<span class="fx-cursor-ring"></span><span class="fx-cursor-dot"></span>';
    document.body.appendChild(cur);
    const CURSOR_INTERACTIVE_SEL = 'a, button, [role="button"], input, textarea, select, label[for], .card, summary';
    document.addEventListener('pointermove', (e) =>
    {
      cur.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      cur.classList.add('is-visible');
    });
    document.addEventListener('pointerover', (e) =>
    {
      cur.classList.toggle('is-hot', !!e.target.closest?.(CURSOR_INTERACTIVE_SEL));
    });
    document.addEventListener('pointerdown', () => cur.classList.add('is-down'));
    document.addEventListener('pointerup', () => cur.classList.remove('is-down'));
    window.addEventListener('blur', () => cur.classList.remove('is-down'));
    document.addEventListener('mouseleave', () => cur.classList.remove('is-visible'));
  }
  /**
   * Trigger the cursor shatter animation: emit a radial ember burst from the
   * cursor's current position and toggle the `is-exploding` class on the
   * cursor element. A timer auto-clears the class so the cursor reforms even
   * if the pointer never moves.
   *
   * @param {[number, number, number]} accent  Primary accent color as RGB.
   * @param {[number, number, number]} accent2 Secondary accent color as RGB.
   * @returns {void}
   */
  function explodeCursor(accent, accent2)
  {
    if (!cur || cursorExploding) return;
    cursorExploding = true;
    cur.classList.add('is-exploding');
    const N = 14;
    for (let i = 0; i < N; i++)
    {
      const ang = (i / N) * Math.PI * 2 + rand(-0.2, 0.2);
      const spd = rand(1.8, 3.4);
      embers.push({
        x: mouse.x, y: mouse.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0,
        ttl: rand(40, 75),
        r: rand(1.2, 2.4),
        rgb: i % 2 ? accent : accent2,
      });
    }
    clearTimeout(cursorReformTimer);
    cursorReformTimer = setTimeout(() =>
    {
      if (cur) cur.classList.remove('is-exploding');
      cursorExploding = false;
    }, 420);
  }

  /**
   * Read a CSS custom property from the document root, falling back to a
   * default when it is unset.
   *
   * @param {string} name     CSS variable name, including the leading `--`.
   * @param {string} fallback Value to return when the property is empty.
   * @returns {string} The computed value or the fallback.
   */
  function readVar(name, fallback)
  {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  /**
   * Parse a 6-digit hex color into an `[r, g, b]` tuple.
   *
   * @param {string} hex Hex color string, with or without a leading `#`.
   * @returns {[number, number, number]} RGB channels in 0–255.
   */
  function hexToRgb(hex)
  {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return [120, 180, 255];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }

  /**
   * Uniformly distributed random float in `[a, b)`.
   *
   * @param {number} a Inclusive lower bound.
   * @param {number} b Exclusive upper bound.
   * @returns {number}
   */
  const rand = (a, b) => a + Math.random() * (b - a);

  /**
   * @returns {boolean} `true` when the document is currently in light theme.
   */
  const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';

  /**
   * Re-measure the viewport, resize the canvas for the current DPR, and
   * re-seed the starfield and nebulae to fit the new dimensions.
   *
   * @returns {void}
   */
  function resize()
  {
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

  /**
   * Populate the star and nebula arrays based on the current viewport size.
   * Star count scales gently with viewport area within a sensible floor/ceiling.
   *
   * @returns {void}
   */
  function seed()
  {
    const area = w * h;
    const baseTotal = Math.min(240, Math.max(90, Math.round(area / 9000)));
    LAYERS[0].count = Math.round(baseTotal * 0.55);
    LAYERS[1].count = Math.round(baseTotal * 0.30);
    LAYERS[2].count = Math.round(baseTotal * 0.15);

    stars = [];
    for (let li = 0; li < LAYERS.length; li++)
    {
      const L = LAYERS[li];
      for (let i = 0; i < L.count; i++)
      {
        stars.push({
          layer: li,
          x: Math.random() * w,
          y: Math.random() * h,
          r: rand(L.size[0], L.size[1]),
          baseAlpha: rand(L.alpha[0], L.alpha[1]),
          twPhase: Math.random() * Math.PI * 2,
          twSpeed: rand(0.5, 1.6),
          drift: rand(0.4, 1.2),
        });
      }
    }

    nebulae = [];
    const blobCount = 2;
    for (let i = 0; i < blobCount; i++)
    {
      nebulae.push({
        x: Math.random() * w,
        y: rand(h * 0.1, h * 0.6),
        r: rand(Math.max(w, h) * 0.55, Math.max(w, h) * 0.9),
        vx: rand(-0.02, 0.02),
        vy: rand(-0.015, 0.015),
        hue: i % 2,
      });
    }
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) =>
  {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
  });
  window.addEventListener('mouseleave', () => { mouse.active = false; });

  const HOVER_SEL = '.card, .hero-card';
  document.addEventListener('pointerover', (e) =>
  {
    const el = e.target.closest?.(HOVER_SEL);
    if (el) hoveredCard = el;
  });
  document.addEventListener('pointerout', (e) =>
  {
    const el = e.target.closest?.(HOVER_SEL);
    if (el && el === hoveredCard) hoveredCard = null;
  });

  const rings = [];
  let lastRingT = 0;
  let lastMoveT = 0;
  window.addEventListener('mousemove', () => { lastMoveT = performance.now(); });
  window.addEventListener('pointerdown', (e) =>
  {
    rings.push({ x: e.clientX, y: e.clientY, life: 0, ttl: 55 });
  });

  /**
   * Emit a short cursor-trail of upward-drifting sparks plus an occasional
   * ambient pulse ring. Throttled to skip emission when the pointer has been
   * idle so the field stays calm while reading.
   *
   * @param {[number, number, number]} accent  Primary accent RGB.
   * @param {[number, number, number]} accent2 Secondary accent RGB.
   * @returns {void}
   */
  function emitCursorSparks(accent, accent2)
  {
    if (!mouse.active) return;
    const t = performance.now();
    if (t - lastMoveT > 600) return;
    if (t - lastRingT > 1400)
    {
      lastRingT = t;
      rings.push({ x: mouse.x, y: mouse.y, life: 0, ttl: 70, soft: true });
    }
    const n = Math.random() < 0.85 ? 1 : 2;
    for (let i = 0; i < n; i++)
    {
      const rgb = Math.random() < 0.5 ? accent : accent2;
      const ang = rand(-Math.PI, 0);
      const spd = rand(0.4, 1.3);
      embers.push({
        x: mouse.x + rand(-8, 8),
        y: mouse.y + rand(-6, 6),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0,
        ttl: rand(55, 110),
        r: rand(0.8, 1.9),
        rgb,
      });
    }
  }
  /**
   * Advance and render all active expanding rings, removing any that have
   * exceeded their TTL.
   *
   * @param {[number, number, number]} accent Stroke color as RGB.
   * @param {boolean} light Whether the page is in light theme; controls
   *   compositing and alpha levels.
   * @returns {void}
   */
  function drawRings(accent, light)
  {
    if (!rings.length) return;
    ctx.save();
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    for (let i = rings.length - 1; i >= 0; i--)
    {
      const ring = rings[i];
      ring.life++;
      const t = ring.life / ring.ttl;
      if (t >= 1) { rings.splice(i, 1); continue; }
      const radius = 8 + t * (ring.soft ? 90 : 160);
      const alpha = (1 - t) * (ring.soft ? (light ? 0.18 : 0.28) : (light ? 0.45 : 0.6));
      ctx.strokeStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${alpha.toFixed(3)})`;
      ctx.lineWidth = ring.soft ? 1 : 1.6;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Spawn 0–1 ember particles from a random side of the given rectangle.
   * Small rectangles emit less often than large ones.
   *
   * @param {DOMRect} rect Bounding rect of the hovered element.
   * @param {[number, number, number]} accent Ember color as RGB.
   * @returns {void}
   */
  function emitEmbers(rect, accent)
  {
    const small = rect.width < 180 || rect.height < 60;
    const n = small
      ? (Math.random() < 0.25 ? 1 : 0)
      : (Math.random() < 0.55 ? 1 : 0);
    for (let i = 0; i < n; i++)
    {
      const side = Math.floor(Math.random() * 4);
      let x, y, vx, vy;
      if (side === 0) { x = rect.left + Math.random() * rect.width; y = rect.top; vy = -rand(0.3, 0.9); vx = rand(-0.3, 0.3); }
      else if (side === 1) { x = rect.right; y = rect.top + Math.random() * rect.height; vx = rand(0.3, 0.9); vy = rand(-0.3, 0.3); }
      else if (side === 2) { x = rect.left + Math.random() * rect.width; y = rect.bottom; vy = rand(0.3, 0.9); vx = rand(-0.3, 0.3); }
      else { x = rect.left; y = rect.top + Math.random() * rect.height; vx = -rand(0.3, 0.9); vy = rand(-0.3, 0.3); }
      embers.push({
        x, y, vx, vy,
        life: 0,
        ttl: rand(60, 110),
        r: rand(1.0, 2.2),
        rgb: accent,
      });
    }
  }

  /**
   * Draw the hero card's hover treatment: a soft halo ellipse plus two
   * satellites orbiting in opposition.
   *
   * @param {DOMRect} rect The hero card's bounding rect.
   * @param {[number, number, number]} accent  Primary accent RGB.
   * @param {[number, number, number]} accent2 Secondary accent RGB.
   * @param {boolean} light Whether the page is in light theme.
   * @param {number} now Animation clock in seconds.
   * @returns {void}
   */
  function drawHeroOrbit(rect, accent, accent2, light, now)
  {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rx = rect.width / 2 + 14;
    const ry = rect.height / 2 + 14;

    ctx.save();
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    const ringAlpha = light ? 0.10 : 0.18;
    ctx.strokeStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${ringAlpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 2; i++)
    {
      const theta = now * 0.35 + i * Math.PI;
      const sx = cx + Math.cos(theta) * rx;
      const sy = cy + Math.sin(theta) * ry;
      const rgb = i === 0 ? accent : accent2;
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 16);
      halo.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${light ? 0.35 : 0.55})`);
      halo.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(sx, sy, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${light ? 0.7 : 0.95})`;
      ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /**
   * With low probability per frame, spawn a comet that crosses the viewport.
   *
   * @returns {void}
   */
  function maybeSpawnComet()
  {
    if (Math.random() > 0.004) return;
    const fromLeft = Math.random() < 0.5;
    comets.push({
      x: fromLeft ? -40 : w + 40,
      y: rand(0, h * 0.6),
      vx: (fromLeft ? 1 : -1) * rand(6, 9),
      vy: rand(1.5, 3.5),
      life: 0,
      ttl: 90,
    });
  }

  resize();

  /**
   * Main render loop. Composites the background layers in z-order:
   * nebulae, parallax stars (with cursor-lens bend), comets, hovered-card
   * embers/orbit, cursor sparks, rings, and finally the ember particles
   * themselves. Schedules itself via `requestAnimationFrame`.
   *
   * @returns {void}
   */
  function tick()
  {
    const accentHex = readVar('--accent', '#3b82f6');
    const accent2Hex = readVar('--accent-2', '#1d4ed8');
    const accent = hexToRgb(accentHex);
    const accent2 = hexToRgb(accent2Hex);
    const light = isLight();

    ctx.clearRect(0, 0, w, h);

    ctx.globalCompositeOperation = light ? 'multiply' : 'screen';
    for (const b of nebulae)
    {
      b.x += b.vx; b.y += b.vy;
      if (b.x < -b.r) b.x = w + b.r; else if (b.x > w + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = h + b.r; else if (b.y > h + b.r) b.y = -b.r;
      const rgb = b.hue === 0 ? accent : accent2;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      const peak = light ? 0.035 : 0.06;
      g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${peak})`);
      g.addColorStop(0.6, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(peak * 0.25).toFixed(3)})`);
      g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    const now = performance.now() * 0.001;
    const LENS_R = 160;
    for (const s of stars)
    {
      const L = LAYERS[s.layer];
      s.x += L.speed * s.drift;
      if (s.x > w + 4) s.x = -4;
      if (s.x < -4) s.x = w + 4;

      let dx = 0, dy = 0;
      if (mouse.active)
      {
        const mx = mouse.x - s.x;
        const my = mouse.y - s.y;
        const d2 = mx * mx + my * my;
        if (d2 < LENS_R * LENS_R)
        {
          const d = Math.sqrt(d2) || 1;
          const t = (1 - d / LENS_R);
          const push = t * t * 14 * (0.6 + L.speed * 2);
          dx = (-my / d) * push;
          dy = (mx / d) * push;
        }
      }

      const tw = 0.5 + 0.5 * Math.sin(now * s.twSpeed + s.twPhase);
      const a = s.baseAlpha * (0.55 + 0.45 * tw);
      const rgb = light ? [80, 110, 180] : [220, 230, 255];
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x + dx, s.y + dy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    maybeSpawnComet();
    for (let i = comets.length - 1; i >= 0; i--)
    {
      const c = comets[i];
      c.life++;
      const headX = c.x + c.vx * c.life;
      const headY = c.y + c.vy * c.life;
      const tailX = c.x + c.vx * (c.life - 14);
      const tailY = c.y + c.vy * (c.life - 14);
      const grad = ctx.createLinearGradient(headX, headY, tailX, tailY);
      const headAlpha = 0.9 * (1 - c.life / c.ttl);
      grad.addColorStop(0, `rgba(255,255,255,${headAlpha})`);
      grad.addColorStop(1, `rgba(${accent[0]},${accent[1]},${accent[2]},0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(headX, headY);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      if (finePointer && mouse.active && !cursorExploding)
      {
        const dx = headX - mouse.x, dy = headY - mouse.y;
        if (dx * dx + dy * dy < 22 * 22) explodeCursor(accent, accent2);
      }
      if (c.life > c.ttl || headX < -60 || headX > w + 60) comets.splice(i, 1);
    }

    if (hoveredCard && document.contains(hoveredCard))
    {
      const r = hoveredCard.getBoundingClientRect();
      if (r.bottom > 0 && r.top < h)
      {
        if (hoveredCard.classList.contains('hero-card'))
        {
          drawHeroOrbit(r, accent, accent2, light, now);
        } else
        {
          emitEmbers(r, accent);
        }
      }
    }
    emitCursorSparks(accent, accent2);
    drawRings(accent, light);
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    for (let i = embers.length - 1; i >= 0; i--)
    {
      const e = embers[i];
      e.life++;
      e.x += e.vx;
      e.y += e.vy;
      e.vy -= 0.005;
      const t = e.life / e.ttl;
      if (t >= 1) { embers.splice(i, 1); continue; }
      const a = (1 - t) * 0.9;
      const rgb = e.rgb;
      // Glow halo
      const halo = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 6);
      halo.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(a * 0.45).toFixed(3)})`);
      halo.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 6, 0, Math.PI * 2); ctx.fill();
      // Core
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
