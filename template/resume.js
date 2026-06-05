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

(() =>
{
  const nav = document.querySelector('.nav');
  const toggle = document.getElementById('nav-toggle');
  const scrim = document.getElementById('nav-scrim');
  const links = document.getElementById('nav-links');
  if (!nav || !toggle || !links) return;

  const setOpen = (open) =>
  {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  scrim?.addEventListener('click', () => setOpen(false));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) =>
  {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false);
  });
  const mq = window.matchMedia('(min-width: 769px)');
  mq.addEventListener?.('change', (e) => { if (e.matches) setOpen(false); });
})();

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

(() =>
{
  const btn = document.getElementById('to-top');
  if (!btn) return;
  window.addEventListener('scroll', () =>
  {
    btn.classList.toggle('is-visible', window.scrollY > 320);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

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

const GH_STATS_KEY = 'resume-gh-stats-v1';
const GH_STATS_TTL = 2 * 60 * 60 * 1000;

function setStat(label, value)
{
  for (const el of document.querySelectorAll('.stat'))
  {
    const lbl = el.querySelector('.lbl');
    if (lbl?.textContent?.trim().toLowerCase() === label.toLowerCase())
    {
      const num = el.querySelector('.num');
      if (num) num.textContent = String(value);
    }
  }
}

function setOsStat(label, value)
{
  for (const el of document.querySelectorAll('.os-stat'))
  {
    const lbl = el.querySelector('.os-lbl');
    if (lbl?.textContent?.trim() === label)
    {
      const num = el.querySelector('.os-num');
      if (num) num.textContent = String(value);
    }
  }
}

async function refreshStats()
{
  try
  {
    let data = null;
    try
    {
      const cached = JSON.parse(localStorage.getItem(GH_STATS_KEY) ?? 'null');
      if (cached?.t && Date.now() - cached.t < GH_STATS_TTL) data = cached;
    } catch { }

    if (!data)
    {
      const res = await fetch('./github.json');
      if (!res.ok) return;
      const json = await res.json();
      data = { t: Date.now(), ...json };
      try { localStorage.setItem(GH_STATS_KEY, JSON.stringify(data)); } catch { }
    }

    if (data.totals)
    {
      setStat('Stars', data.totals.stars);
      setStat('Repos', data.totals.repos);
      setOsStat('GitHub Stars', data.totals.stars);
      setOsStat('npm Packages', data.totals.npm);
      setOsStat('Public Repos', data.totals.repos);
      setOsStat('Gists', data.totals.gists);
    }
    if (data.user?.followers != null) setStat('Followers', data.user.followers);
  } catch { }
}

refreshStats();

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

  function readVar(name, fallback)
  {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function hexToRgb(hex)
  {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return [120, 180, 255];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';

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
    for (let i = 0; i < 2; i++)
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
  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
  window.addEventListener('mouseleave', () => { mouse.active = false; });

  const HOVER_TYPES = [
    { type: 'heroCard', sel: '.hero-card' },
    { type: 'card',     sel: '.card:not(.hero-card)' },
    { type: 'stat',     sel: '.os-stat' },
  ];

  function classifyTarget(target)
  {
    for (const { type, sel } of HOVER_TYPES)
    {
      const el = target?.closest?.(sel);
      if (el) return { type, el };
    }
    return null;
  }

  let hoverStartTime = 0;
  document.addEventListener('pointerover', (e) =>
  {
    const next = classifyTarget(e.target);
    if (next?.el !== hoveredCard?.el) hoverStartTime = performance.now() * 0.001;
    hoveredCard = next;
  });
  document.addEventListener('pointerout', (e) =>
  {
    const c = classifyTarget(e.target);
    if (c && c.el === hoveredCard?.el) hoveredCard = null;
  });

  const rings = [];
  let lastRingT = 0;
  let lastMoveT = 0;
  window.addEventListener('mousemove', () => { lastMoveT = performance.now(); });
  window.addEventListener('pointerdown', (e) =>
  {
    rings.push({ x: e.clientX, y: e.clientY, life: 0, ttl: 55 });
  });

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

  function emitEmbers(rect, accent)
  {
    const small = rect.width < 180 || rect.height < 60;
    const n = small ? (Math.random() < 0.25 ? 1 : 0) : (Math.random() < 0.55 ? 1 : 0);
    for (let i = 0; i < n; i++)
    {
      const side = Math.floor(Math.random() * 4);
      let x, y, vx, vy;
      if (side === 0)      { x = rect.left + Math.random() * rect.width;  y = rect.top;    vy = -rand(0.3, 0.9); vx = rand(-0.3, 0.3); }
      else if (side === 1) { x = rect.right;  y = rect.top + Math.random() * rect.height;  vx = rand(0.3, 0.9);  vy = rand(-0.3, 0.3); }
      else if (side === 2) { x = rect.left + Math.random() * rect.width;  y = rect.bottom; vy = rand(0.3, 0.9);  vx = rand(-0.3, 0.3); }
      else                 { x = rect.left;   y = rect.top + Math.random() * rect.height;  vx = -rand(0.3, 0.9); vy = rand(-0.3, 0.3); }
      embers.push({ x, y, vx, vy, life: 0, ttl: rand(60, 110), r: rand(1.0, 2.2), rgb: accent });
    }
  }

  function drawHeroOrbit(rect, accent, accent2, light, now)
  {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rx = rect.width / 2 + 14;
    const ry = rect.height / 2 + 14;
    ctx.save();
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    ctx.strokeStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${light ? 0.10 : 0.18})`;
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

  function drawCardBorderTrace(rect, accent, accent2, light, now)
  {
    const W = rect.width, H = rect.height;
    const perim = 2 * (W + H);
    const speed = perim * 0.28;
    ctx.save();
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    for (let d = 0; d < 2; d++)
    {
      const pos = ((now * speed + d * perim * 0.5) % perim + perim) % perim;
      let px, py;
      if (pos < W)            { px = rect.left + pos;              py = rect.top; }
      else if (pos < W + H)   { px = rect.right;                   py = rect.top + (pos - W); }
      else if (pos < 2*W + H) { px = rect.right - (pos - W - H);  py = rect.bottom; }
      else                    { px = rect.left;                    py = rect.bottom - (pos - 2*W - H); }
      const rgb = d === 0 ? accent : accent2;
      const halo = ctx.createRadialGradient(px, py, 0, px, py, 14);
      halo.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${light ? 0.5 : 0.7})`);
      halo.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${light ? 0.85 : 1.0})`;
      ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawStatOrbit(rect, accent, accent2, light, now)
  {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const r = Math.min(rect.width, rect.height) * 0.40;
    ctx.save();
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    ctx.strokeStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${light ? 0.10 : 0.18})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 2; i++)
    {
      const theta = now * 1.8 + i * Math.PI;
      const sx = cx + Math.cos(theta) * r;
      const sy = cy + Math.sin(theta) * r;
      const rgb = i === 0 ? accent : accent2;
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 11);
      halo.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${light ? 0.45 : 0.65})`);
      halo.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${light ? 0.75 : 0.95})`;
      ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

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

    if (hoveredCard && document.contains(hoveredCard.el))
    {
      const r = hoveredCard.el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < h)
      {
        switch (hoveredCard.type)
        {
          case 'heroCard': drawHeroOrbit(r, accent, accent2, light, now); break;
          case 'card':     drawCardBorderTrace(r, accent, accent2, light, now); emitEmbers(r, accent); break;
          case 'stat':     drawStatOrbit(r, accent, accent2, light, now); break;
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
      const halo = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 6);
      halo.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(a * 0.45).toFixed(3)})`);
      halo.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
