#!/usr/bin/env node
/**
 * Renders the README "Stack" section as one animated SVG card per row.
 *
 *  - Per-section accent gradient (matches the header pill badges).
 *  - Animated dashed border pulse + 4 particles orbiting the border path
 *    (animateMotion + mpath — survives GitHub's SVG sanitizer when the file
 *    is loaded via <img> / <source srcset>).
 *  - Chips render simple-icons glyphs in the brand color when available; fall
 *    back to a first-letter tile colored from the section accent otherwise.
 *  - Two themed files per section (stack-{slug}-dark.svg / -light.svg) plus
 *    cache-bust hash rewrite of the matching <picture> block in README.md.
 *
 * Run:  node .github/scripts/generate-stack.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as simpleIcons from 'simple-icons';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT  = resolve(ROOT, '.github', 'badges');
mkdirSync(OUT, { recursive: true });

const CARD_W       = 880;
const PAD_X        = 18;
const PAD_TOP      = 44;     // header band
const PAD_BOTTOM   = 16;
const CHIP_H       = 30;
const CHIP_GAP_X   = 8;
const CHIP_GAP_Y   = 8;
const CHIP_PAD_X   = 11;
const ICON_SIZE    = 14;
const ICON_TEXT_GAP = 7;
const CHIP_FONT    = 12.5;
const CHIP_FONT_W  = 600;

// Approximate character widths for the chip font (Segoe UI / Inter @ 12.5/600).
// Rough but consistent — used only for chip-row wrap math; the SVG itself
// lays out text by absolute x coordinates we compute here.
const CHAR_W = { default: 7.05, ' ': 3.6, '.': 3.4, ',': 3.4, ':': 3.6, ';': 3.6, '/': 4.2, '-': 4.4, '+': 6.4, '#': 8.6, '%': 10.4, '&': 8.2, 'i': 3.4, 'l': 3.4, 'I': 3.6, 't': 4.2, 'r': 4.4, 'f': 4.4, 'j': 3.4, 'm': 11.0, 'w': 9.8, 'M': 10.4, 'W': 11.2 };
const measureText = (s) => {
  let w = 0;
  for (const c of s) w += CHAR_W[c] ?? CHAR_W.default;
  return w;
};

const STACK = [
  { label: 'Languages',         accentA: '#60a5fa', accentB: '#2563eb', chips: [
    { name: 'TypeScript', slug: 'typescript' },
    { name: 'JavaScript', slug: 'javascript' },
    { name: 'Python',     slug: 'python' },
    { name: 'C#',         slug: 'sharp' },
    { name: 'C++',        slug: 'cplusplus' },
    { name: 'Java',       slug: 'openjdk' },
    { name: 'Go',         slug: 'go' },
    { name: 'MATLAB',     color: '#e16a3d' },
    { name: 'Bash',       slug: 'gnubash' },
    { name: 'PowerShell', slug: 'powershell' },
    { name: 'Batch',      color: '#9aa3b2' },
  ]},
  { label: 'Frontend',          accentA: '#22d3ee', accentB: '#0ea5b7', chips: [
    { name: 'zQuery',  color: '#60a5fa' },
    { name: 'React',   slug: 'react' },
    { name: 'Angular', slug: 'angular' },
    { name: 'Tailwind',slug: 'tailwindcss' },
    { name: 'SCSS',    slug: 'sass' },
    { name: 'Vite',    slug: 'vite' },
  ]},
  { label: 'Backend',           accentA: '#34d399', accentB: '#059669', chips: [
    { name: 'zero-server', color: '#60a5fa' },
    { name: 'Node.js',     slug: 'nodedotjs' },
    { name: 'Express',     slug: 'express' },
    { name: 'REST',        color: '#34d399' },
    { name: 'GraphQL',     slug: 'graphql' },
    { name: 'OpenAPI',     slug: 'openapiinitiative' },
    { name: 'ASP.NET Core',slug: 'dotnet' },
    { name: 'EF Core',     slug: 'dotnet' },
    { name: 'Spring Boot', slug: 'spring' },
  ]},
  { label: 'Real-time',         accentA: '#a78bfa', accentB: '#7c3aed', chips: [
    { name: 'WebSocket', slug: 'socketdotio' },
    { name: 'WebRTC',    slug: 'webrtc' },
    { name: 'SSE',       color: '#a78bfa' },
    { name: 'gRPC',      color: '#9333ea' },
    { name: 'HTTP/2',    color: '#a78bfa' },
    { name: 'STUN/TURN', color: '#a78bfa' },
  ]},
  { label: 'Data',              accentA: '#f59e0b', accentB: '#d97706', chips: [
    { name: 'PostgreSQL',    slug: 'postgresql' },
    { name: 'MySQL',         slug: 'mysql' },
    { name: 'SQLite',        slug: 'sqlite' },
    { name: 'MongoDB',       slug: 'mongodb' },
    { name: 'Redis',         slug: 'redis' },
    { name: 'Firebase',      slug: 'firebase' },
    { name: 'Supabase',      slug: 'supabase' },
    { name: 'Prisma',        slug: 'prisma' },
    { name: 'Elasticsearch', slug: 'elasticsearch' },
  ]},
  { label: 'Desktop',           accentA: '#38bdf8', accentB: '#0284c7', chips: [
    { name: 'Electron',      slug: 'electron' },
    { name: 'Qt',            slug: 'qt' },
    { name: 'CustomTkinter', slug: 'python' },
    { name: 'WinForms',      color: '#38bdf8' },
  ]},
  { label: 'Game Engines',      accentA: '#f472b6', accentB: '#db2777', chips: [
    { name: 'Godot',         slug: 'godotengine' },
    { name: 'godot-cpp',     slug: 'cplusplus' },
    { name: 'Unreal Engine', slug: 'unrealengine' },
  ]},
  { label: 'Robotics & Drones', accentA: '#fb7185', accentB: '#e11d48', chips: [
    { name: 'MATLAB',   color: '#e16a3d' },
    { name: 'Simulink', color: '#fb7185' },
    { name: 'ROS 2',    color: '#fb7185' },
    { name: 'PX4',      color: '#fb7185' },
    { name: 'MAVLink',  color: '#fb7185' },
    { name: 'OpenCV',   slug: 'opencv' },
    { name: 'NumPy',    slug: 'numpy' },
  ]},
  { label: 'Audio & Graphics',  accentA: '#fcd34d', accentB: '#f59e0b', chips: [
    { name: 'Web Audio API', color: '#fcd34d' },
    { name: 'SuperCollider', color: '#fcd34d' },
    { name: 'FAUST',         color: '#fcd34d' },
    { name: 'SVG',           slug: 'svg' },
    { name: 'Canvas',        color: '#fcd34d' },
    { name: 'GLSL',          color: '#fcd34d' },
    { name: 'Three.js',      slug: 'threedotjs' },
    { name: 'Inkscape',      slug: 'inkscape' },
  ]},
  { label: 'Auth & Sec',        accentA: '#fb923c', accentB: '#ea580c', chips: [
    { name: 'JWT',                slug: 'jsonwebtokens' },
    { name: 'OAuth 2.0',          slug: 'auth0' },
    { name: 'WebAuthn',           slug: 'yubico' },
    { name: 'TOTP',               color: '#fb923c' },
    { name: 'CSRF',               slug: 'owasp' },
    { name: 'Microsoft Entra ID', color: '#fb923c' },
    { name: 'OIDC',               slug: 'openid' },
    { name: 'Passport',           slug: 'passport' },
    { name: 'Helmet',             color: '#fb923c' },
  ]},
  { label: 'Infra',             accentA: '#94a3b8', accentB: '#475569', chips: [
    { name: 'Docker',         slug: 'docker' },
    { name: 'Nginx',          slug: 'nginx' },
    { name: 'Prometheus',     slug: 'prometheus' },
    { name: 'Linux',          slug: 'linux' },
    { name: 'Git',            slug: 'git' },
    { name: 'GitHub Actions', slug: 'githubactions' },
  ]},
  { label: 'DevOps',            accentA: '#5eead4', accentB: '#0d9488', chips: [
    { name: 'Kubernetes', slug: 'kubernetes' },
    { name: 'Argo CD',    slug: 'argo' },
    { name: 'Jenkins',    slug: 'jenkins' },
    { name: 'GitLab CI',  slug: 'gitlab' },
    { name: 'Grafana',    slug: 'grafana' },
  ]},
  { label: 'Cloud',             accentA: '#818cf8', accentB: '#4f46e5', chips: [
    { name: 'AWS',          slug: 'amazonwebservices' },
    { name: 'EC2',          slug: 'amazonec2' },
    { name: 'RDS',          slug: 'amazonrds' },
    { name: 'S3',           slug: 'amazons3' },
    { name: 'Route 53',     slug: 'amazonroute53' },
    { name: 'CloudFront',   slug: 'amazoncloudfront' },
    { name: 'CloudWatch',   slug: 'amazoncloudwatch' },
    { name: 'Cloudflare',   slug: 'cloudflare' },
    { name: 'Akamai',       slug: 'akamai' },
    { name: 'Azure',        slug: 'microsoftazure' },
    { name: 'Google Cloud', slug: 'googlecloud' },
    { name: 'DigitalOcean', slug: 'digitalocean' },
    { name: 'Vercel',       slug: 'vercel' },
  ]},
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escapeXml = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;' }[c]));

function getIconKey(slug) {
  if (!slug) return undefined;
  const key = 'si' + slug.charAt(0).toUpperCase() + slug.slice(1);
  return simpleIcons[key];
}

function chipWidth(chip) {
  const textW = measureText(chip.name);
  return CHIP_PAD_X + ICON_SIZE + ICON_TEXT_GAP + textW + CHIP_PAD_X;
}

function layoutChips(chips, maxW) {
  const rows = [[]];
  let rowW = 0;
  for (const chip of chips) {
    const w = chipWidth(chip);
    const candidate = rowW === 0 ? w : rowW + CHIP_GAP_X + w;
    if (candidate > maxW && rows[rows.length - 1].length) {
      rows.push([{ ...chip, _w: w }]);
      rowW = w;
    } else {
      rows[rows.length - 1].push({ ...chip, _w: w });
      rowW = candidate;
    }
  }
  return rows;
}

function renderChip(chip, x, y, accentA, dark) {
  const color = chip.color || (getIconKey(chip.slug)?.hex ? '#' + getIconKey(chip.slug).hex : accentA);
  const icon  = getIconKey(chip.slug);
  const chipBg     = dark ? '#161b25' : '#f4f6fb';
  const chipBorder = dark ? '#242b3a' : '#dee2ea';
  const textFill   = dark ? '#dde2ec' : '#1f2330';
  const w = chip._w;
  const iconX = x + CHIP_PAD_X;
  const iconY = y + (CHIP_H - ICON_SIZE) / 2;
  const textX = iconX + ICON_SIZE + ICON_TEXT_GAP;
  const textY = y + CHIP_H / 2 + CHIP_FONT * 0.36;

  const iconNode = icon
    ? `<svg x="${iconX}" y="${iconY}" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="${color}"><path d="${icon.path}"/></svg>`
    : `<g><rect x="${iconX}" y="${iconY}" width="${ICON_SIZE}" height="${ICON_SIZE}" rx="3.5" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-opacity="0.55"/><text x="${iconX + ICON_SIZE/2}" y="${iconY + ICON_SIZE - 3}" text-anchor="middle" font-size="9.5" font-weight="800" fill="${color}">${escapeXml(chip.name[0].toUpperCase())}</text></g>`;

  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${CHIP_H}" rx="8" fill="${chipBg}" stroke="${chipBorder}"/>
    ${iconNode}
    <text x="${textX}" y="${textY}" font-size="${CHIP_FONT}" font-weight="${CHIP_FONT_W}" fill="${textFill}">${escapeXml(chip.name)}</text>
  </g>`;
}

function renderCard(section, dark) {
  const id = slugify(section.label) + (dark ? '-d' : '-l');
  const accentA = section.accentA, accentB = section.accentB;

  const maxRowW = CARD_W - PAD_X * 2;
  const rows = layoutChips(section.chips, maxRowW);
  const cardH = PAD_TOP + rows.length * CHIP_H + (rows.length - 1) * CHIP_GAP_Y + PAD_BOTTOM;

  const surfaceA = dark ? '#11151f' : '#ffffff';
  const surfaceB = dark ? '#0a0d14' : '#f7f8fb';
  const border   = dark ? '#1f2533' : '#e4e7ee';
  const ink      = dark ? '#e6e9f1' : '#0b1220';
  const muted    = dark ? '#94a3b8' : '#5b6472';
  const tintOp   = dark ? 0.16 : 0.09;

  // Border path inset 1px so 2px stroke fits inside the viewBox without clipping.
  const RX = 14;
  const bx = 1, by = 1, bw = CARD_W - 2, bh = cardH - 2, br = RX - 0.5;
  const borderD = `M ${bx + br} ${by} H ${bx + bw - br} A ${br} ${br} 0 0 1 ${bx + bw} ${by + br} V ${by + bh - br} A ${br} ${br} 0 0 1 ${bx + bw - br} ${by + bh} H ${bx + br} A ${br} ${br} 0 0 1 ${bx} ${by + bh - br} V ${by + br} A ${br} ${br} 0 0 1 ${bx + br} ${by} Z`;

  // Chip rows
  let chipsSvg = '';
  let cursorY = PAD_TOP - 2;
  for (const row of rows) {
    let cursorX = PAD_X;
    for (const chip of row) {
      chipsSvg += renderChip(chip, cursorX, cursorY, accentA, dark);
      cursorX += chip._w + CHIP_GAP_X;
    }
    cursorY += CHIP_H + CHIP_GAP_Y;
  }

  const count = section.chips.length;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${cardH}" viewBox="0 0 ${CARD_W} ${cardH}" role="img" aria-label="${escapeXml(section.label)}: ${section.chips.map(c => c.name).join(', ')}">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${surfaceA}"/>
      <stop offset="100%" stop-color="${surfaceB}"/>
    </linearGradient>
    <linearGradient id="ac-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accentA}"/>
      <stop offset="100%" stop-color="${accentB}"/>
    </linearGradient>
    <linearGradient id="tint-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accentA}" stop-opacity="${tintOp}"/>
      <stop offset="60%" stop-color="${accentA}" stop-opacity="0"/>
    </linearGradient>
    <path id="bd-${id}" d="${borderD}" fill="none"/>
    <clipPath id="clip-${id}"><rect x="0" y="0" width="${CARD_W}" height="${cardH}" rx="${RX}" ry="${RX}"/></clipPath>
  </defs>

  <rect x="0" y="0" width="${CARD_W}" height="${cardH}" rx="${RX}" ry="${RX}" fill="url(#bg-${id})"/>
  <rect x="0" y="0" width="${CARD_W}" height="${cardH}" rx="${RX}" ry="${RX}" fill="url(#tint-${id})"/>

  <use href="#bd-${id}" stroke="${border}" stroke-width="1"/>
  <use href="#bd-${id}" stroke="url(#ac-${id})" stroke-width="1.2" stroke-opacity="0.5"/>
  <use href="#bd-${id}" stroke="url(#ac-${id})" stroke-width="2" stroke-dasharray="90 ${Math.round((CARD_W + cardH) * 1.6)}" stroke-linecap="round">
    <animate attributeName="stroke-dashoffset" from="0" to="-${(CARD_W + cardH) * 2}" dur="14s" repeatCount="indefinite"/>
  </use>

  <g clip-path="url(#clip-${id})">
    <circle r="2" fill="${accentA}"><animateMotion dur="12s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
    <circle r="1.6" fill="${accentB}"><animateMotion dur="12s" begin="-3s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
    <circle r="1.4" fill="${accentA}" opacity="0.75"><animateMotion dur="12s" begin="-6s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
    <circle r="1" fill="${accentB}" opacity="0.7"><animateMotion dur="12s" begin="-9s" repeatCount="indefinite" rotate="auto"><mpath href="#bd-${id}"/></animateMotion></circle>
  </g>

  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">
    <g transform="translate(${PAD_X} 16)">
      <rect x="0" y="0" width="4" height="18" rx="2" fill="url(#ac-${id})"/>
      <text x="12" y="14" font-size="14.5" font-weight="800" fill="${ink}" letter-spacing="-0.2">${escapeXml(section.label)}</text>
    </g>
    <g transform="translate(${CARD_W - PAD_X} 16)">
      <text x="0" y="14" text-anchor="end" font-size="10.5" font-weight="700" fill="${muted}" letter-spacing="1.5">${count} ITEMS</text>
    </g>
    ${chipsSvg}
  </g>
</svg>
`;
}

// --- write files + collect hashes ---
const generated = {};
for (const section of STACK) {
  const slug = slugify(section.label);
  const dark = renderCard(section, true);
  const light = renderCard(section, false);
  writeFileSync(resolve(OUT, `stack-${slug}-dark.svg`), dark);
  writeFileSync(resolve(OUT, `stack-${slug}-light.svg`), light);
  generated[slug] = {
    label: section.label,
    darkHash: createHash('sha1').update(dark).digest('hex').slice(0, 8),
    lightHash: createHash('sha1').update(light).digest('hex').slice(0, 8),
  };
  console.log(`ok  stack-${slug.padEnd(20)} ${section.chips.length} chips`);
}

// --- rewrite README block between markers ---
const README = resolve(ROOT, 'README.md');
let md = readFileSync(README, 'utf8');

const RAW = 'https://raw.githubusercontent.com/tonywied17/tonywied17/main/.github/badges';
const block = STACK.map(s => {
  const slug = slugify(s.label);
  const { darkHash, lightHash } = generated[slug];
  return `  <picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/stack-${slug}-dark.svg?v=${darkHash}"><img alt="${escapeXml(s.label)}" src="${RAW}/stack-${slug}-light.svg?v=${lightHash}" /></picture>`;
}).join('\n  <br/>\n');

const wrapped = `<!-- stack:start -->\n<p align="center">\n${block}\n</p>\n<!-- stack:end -->`;

if (md.includes('<!-- stack:start -->') && md.includes('<!-- stack:end -->')) {
  md = md.replace(/<!-- stack:start -->[\s\S]*?<!-- stack:end -->/, wrapped);
} else {
  // First-time install: replace the legacy "### Stack" + <table>...</table> block.
  const m = md.match(/### Stack\s*\n+<table[\s\S]*?<\/table>/);
  if (m) {
    md = md.replace(m[0], `### Stack\n\n${wrapped}`);
  } else {
    console.warn('  ! could not find a Stack table or markers in README.md — appending');
    md += `\n\n### Stack\n\n${wrapped}\n`;
  }
}

writeFileSync(README, md);
console.log(`\nwrote ${STACK.length} cards x 2 themes -> ${OUT}`);
console.log('updated README.md stack block');
