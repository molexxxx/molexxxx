#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as simpleIcons from 'simple-icons';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = resolve(ROOT, '.github', 'badges');
mkdirSync(OUT, { recursive: true });

// Single-path icons that simple-icons no longer ships (AWS family, Azure,
// PowerShell). Sourced from simple-icons v12 before Amazon/Microsoft brand
// removals; keyed by the same slug we reference in STACK.
const CUSTOM_ICONS = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'custom-icons.json'), 'utf8'));

const CARD_W = 415;
const PAD_X = 14;
const PAD_TOP = 34;
const PAD_BOTTOM = 14;
const CHIP_H = 26;
const CHIP_GAP_X = 7;
const CHIP_GAP_Y = 7;
const CHIP_PAD_X = 10;
const ICON_SIZE = 13;
const ICON_TEXT_GAP = 7;
const CHIP_FONT = 12.5;
const CHIP_FONT_W = 600;

// Approximate character widths for the chip font
const CHAR_W = { default: 7.05, ' ': 3.6, '.': 3.4, ',': 3.4, ':': 3.6, ';': 3.6, '/': 4.2, '-': 4.4, '+': 6.4, '#': 8.6, '%': 10.4, '&': 8.2, 'i': 3.4, 'l': 3.4, 'I': 3.6, 't': 4.2, 'r': 4.4, 'f': 4.4, 'j': 3.4, 'm': 11.0, 'w': 9.8, 'M': 10.4, 'W': 11.2 };
const measureText = (s) =>
{
  let w = 0;
  for (const c of s) w += CHAR_W[c] ?? CHAR_W.default;
  return w;
};

const ACCENT = '#f5a524';

const STACK = [
  {
    label: 'Languages', chips: [
      { name: 'TypeScript', slug: 'typescript' },
      { name: 'JavaScript', slug: 'javascript' },
      { name: 'Rust', slug: 'rust' },
      { name: 'C++', slug: 'cplusplus' },
      { name: 'C#', slug: 'sharp' },
      { name: 'Python', slug: 'python' },
      { name: 'Go', slug: 'go' },
      { name: 'Java', slug: 'openjdk' },
    ]
  },
  {
    label: 'Backend', chips: [
      { name: 'zero-server', color: ACCENT },
      { name: 'Node.js', slug: 'nodedotjs' },
      { name: 'Express', slug: 'express' },
      { name: 'ASP.NET Core', slug: 'dotnet' },
      { name: 'Spring Boot', slug: 'spring' },
      { name: 'Drogon' },
      { name: 'GraphQL', slug: 'graphql' },
      { name: 'gRPC' },
    ]
  },
  {
    label: 'Frontend and Desktop', chips: [
      { name: 'zQuery', color: ACCENT },
      { name: 'React', slug: 'react' },
      { name: 'Angular', slug: 'angular' },
      { name: 'Tailwind CSS', slug: 'tailwindcss' },
      { name: 'Vite', slug: 'vite' },
      { name: 'Electron', slug: 'electron' },
      { name: 'Qt', slug: 'qt' },
      { name: 'WinForms' },
    ]
  },
  {
    label: 'Data', chips: [
      { name: 'PostgreSQL', slug: 'postgresql' },
      { name: 'MySQL', slug: 'mysql' },
      { name: 'SQLite', slug: 'sqlite' },
      { name: 'MongoDB', slug: 'mongodb' },
      { name: 'Redis', slug: 'redis' },
      { name: 'Elasticsearch', slug: 'elasticsearch' },
      { name: 'EF Core', slug: 'dotnet' },
    ]
  },
  {
    label: 'Real-time and IoT', chips: [
      { name: 'WebSocket' },
      { name: 'WebRTC', slug: 'webrtc' },
      { name: 'SSE' },
      { name: 'STUN/TURN' },
      { name: 'MQTT', slug: 'mqtt' },
      { name: 'CoAP' },
      { name: 'LoRaWAN' },
      { name: 'NB-IoT' },
    ]
  },
  {
    label: 'Infrastructure', chips: [
      { name: 'Docker', slug: 'docker' },
      { name: 'Kubernetes', slug: 'kubernetes' },
      { name: 'Nginx', slug: 'nginx' },
      { name: 'Linux', slug: 'linux' },
      { name: 'GitHub Actions', slug: 'githubactions' },
      { name: 'AWS', slug: 'amazonwebservices' },
      { name: 'Azure', slug: 'microsoftazure' },
      { name: 'Cloudflare', slug: 'cloudflare' },
    ]
  },
  {
    label: 'Robotics and Drones', chips: [
      { name: 'ROS 2', slug: 'ros' },
      { name: 'PX4' },
      { name: 'MAVLink' },
      { name: 'MATLAB' },
      { name: 'Simulink' },
      { name: 'OpenCV', slug: 'opencv' },
      { name: 'NumPy', slug: 'numpy' },
    ]
  },
  {
    label: 'Audio, Graphics, and Games', chips: [
      { name: 'Web Audio API' },
      { name: 'SuperCollider' },
      { name: 'FAUST' },
      { name: 'GLSL' },
      { name: 'Vulkan', slug: 'vulkan' },
      { name: 'SDL3' },
      { name: 'Three.js', slug: 'threedotjs' },
      { name: 'Godot', slug: 'godotengine' },
    ]
  },
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const escapeXml = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

// Resolve a slug to { path, hex } from simple-icons first, then our custom set.
function resolveIcon(slug)
{
  if (!slug) return undefined;
  const si = simpleIcons['si' + slug.charAt(0).toUpperCase() + slug.slice(1)];
  if (si) return { path: si.path, hex: '#' + si.hex };
  const custom = CUSTOM_ICONS[slug];
  if (custom) return { path: custom.path, hex: '#' + custom.hex };
  return undefined;
}

// WCAG relative luminance of an #rrggbb color (0 = black, 1 = white).
function relLuminance(hex)
{
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function rgbToHsl(r, g, b)
{
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h, s, l)
{
  const hue = (p, q, t) =>
  {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else
  {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3);
  }
  return '#' + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

// On the dark card, brand colors that are near-black (Express, JWT, Three.js,
// WebSocket, Rust, AWS, ...) vanish. Lift only those, preserving hue.
function darkSafe(hex)
{
  if (relLuminance(hex) >= 0.14) return hex;
  const [h, s] = rgbToHsl(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
  return hslToHex(h, Math.min(s, 0.7), 0.66);
}

function chipWidth(chip)
{
  const textW = measureText(chip.name);
  const iconW = resolveIcon(chip.slug) || chip.color ? ICON_SIZE + ICON_TEXT_GAP : 0;
  return CHIP_PAD_X + iconW + textW + CHIP_PAD_X;
}

function layoutChips(chips, maxW)
{
  const rows = [[]];
  let rowW = 0;
  for (const chip of chips)
  {
    const w = chipWidth(chip);
    const candidate = rowW === 0 ? w : rowW + CHIP_GAP_X + w;
    if (candidate > maxW && rows[rows.length - 1].length)
    {
      rows.push([{ ...chip, _w: w }]);
      rowW = w;
    } else
    {
      rows[rows.length - 1].push({ ...chip, _w: w });
      rowW = candidate;
    }
  }
  return rows;
}

function renderChip(chip, x, y, dark)
{
  const fallbackColor = dark ? '#94a3b8' : '#5b6472';
  const icon = resolveIcon(chip.slug);
  let color = chip.color || (icon ? icon.hex : fallbackColor);
  if (dark) color = darkSafe(color);
  const chipBg = 'none';
  const chipBorder = dark ? '#30363d' : '#d0d7de';
  const textFill = dark ? '#e6edf3' : '#1f2328';
  const w = chip._w;
  const iconX = x + CHIP_PAD_X;
  const iconY = y + (CHIP_H - ICON_SIZE) / 2;
  const hasMark = Boolean(icon || chip.color);
  const textX = hasMark ? iconX + ICON_SIZE + ICON_TEXT_GAP : x + CHIP_PAD_X;
  const textY = y + CHIP_H / 2 + CHIP_FONT * 0.36;

  const iconNode = !hasMark ? '' : icon
    ? `<svg x="${iconX}" y="${iconY}" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="${color}"><path d="${icon.path}"/></svg>`
    : `<g><rect x="${iconX}" y="${iconY}" width="${ICON_SIZE}" height="${ICON_SIZE}" rx="2.5" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-opacity="0.55"/><text x="${iconX + ICON_SIZE / 2}" y="${iconY + ICON_SIZE - 2.5}" text-anchor="middle" font-size="8" font-weight="800" fill="${color}">${escapeXml(chip.name[0].toUpperCase())}</text></g>`;

  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${CHIP_H}" rx="6" fill="${chipBg}" stroke="${chipBorder}"/>
    ${iconNode}
    <text x="${textX}" y="${textY}" font-size="${CHIP_FONT}" font-weight="${CHIP_FONT_W}" fill="${textFill}">${escapeXml(chip.name)}</text>
  </g>`;
}

const PAIRINGS = [
  ['Languages', 'Backend'],
  ['Frontend and Desktop', 'Data'],
  ['Real-time and IoT', 'Infrastructure'],
  ['Robotics and Drones', 'Audio, Graphics, and Games'],
];

const rowCount = s => layoutChips(s.chips, CARD_W - PAD_X * 2).length;
const PAIR_ROWS = Object.fromEntries(PAIRINGS.flatMap(pair =>
{
  const rows = Math.max(...pair.map(label => rowCount(STACK.find(s => s.label === label))));
  return pair.map(label => [label, rows]);
}));

function renderCard(section, dark)
{
  const id = slugify(section.label) + (dark ? '-d' : '-l');

  const maxRowW = CARD_W - PAD_X * 2;
  const rows = layoutChips(section.chips, maxRowW);
  const n = PAIR_ROWS[section.label] ?? rows.length;
  const cardH = PAD_TOP + n * CHIP_H + (n - 1) * CHIP_GAP_Y + PAD_BOTTOM;

  const border = dark ? '#30363d' : '#d0d7de';
  const ink = dark ? '#e6e9f1' : '#0b1220';
  const muted = dark ? '#7d8590' : '#656d76';
  const sheen = dark ? '#f5a524' : '#b45309';
  const sep = dark ? '#1c222c' : '#eaecef';
  const RX = 10;

  let chipsSvg = '';
  let cursorY = PAD_TOP - 2;
  for (const row of rows)
  {
    let cursorX = PAD_X;
    for (const chip of row)
    {
      chipsSvg += renderChip(chip, cursorX, cursorY, dark);
      cursorX += chip._w + CHIP_GAP_X;
    }
    cursorY += CHIP_H + CHIP_GAP_Y;
  }

  const count = section.chips.length;

  const sheenW = 180;
  const sheenDur = 9;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${cardH}" viewBox="0 0 ${CARD_W} ${cardH}" role="img" aria-label="${escapeXml(section.label)}: ${section.chips.map(c => c.name).join(', ')}">
  <defs>
    <linearGradient id="sheen-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="${sheen}" stop-opacity="0"/>
      <stop offset="50%"  stop-color="${sheen}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${sheen}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="clip-${id}"><rect x="0" y="0" width="${CARD_W}" height="${cardH}" rx="${RX}" ry="${RX}"/></clipPath>
  </defs>

  <rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${cardH - 1}" rx="${RX}" ry="${RX}" fill="none" stroke="${border}"/>

  <g clip-path="url(#clip-${id})">
    <rect x="-${sheenW}" y="0" width="${sheenW}" height="1.5" fill="url(#sheen-${id})">
      <animate attributeName="x" from="-${sheenW}" to="${CARD_W}" dur="${sheenDur}s" begin="0s" repeatCount="indefinite"/>
    </rect>
  </g>

  <line x1="${PAD_X}" y1="${PAD_TOP - 8}" x2="${CARD_W - PAD_X}" y2="${PAD_TOP - 8}" stroke="${sep}" stroke-width="1"/>

  <g font-family="Segoe UI, Inter, -apple-system, BlinkMacSystemFont, sans-serif">
    <text x="${PAD_X}" y="20" font-size="13" font-weight="700" fill="${ink}" letter-spacing="-0.1">${escapeXml(section.label)}</text>
    <text x="${CARD_W - PAD_X}" y="20" text-anchor="end" font-size="11" font-weight="600" fill="${muted}" letter-spacing="1.2">${count}</text>
    ${chipsSvg}
  </g>
</svg>
`;
}

// --- write files + collect hashes ---
const generated = {};
for (const section of STACK)
{
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

const RAW = 'https://raw.githubusercontent.com/molexxxx/molexxxx/main/.github/badges';
const IMG_W = 415;

const queue = STACK.map(s => s);
const byLabel = Object.fromEntries(queue.map(s => [s.label, s]));


const pairs = PAIRINGS.map(row => row.map(l => byLabel[l]).filter(Boolean));

const cardHtml = (s) =>
{
  const slug = slugify(s.label);
  const { darkHash, lightHash } = generated[slug];
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/stack-${slug}-dark.svg?v=${darkHash}"><img alt="${escapeXml(s.label)}" width="${IMG_W}" src="${RAW}/stack-${slug}-light.svg?v=${lightHash}" /></picture>`;
};

const block = pairs.map(p => p.map(cardHtml).join(' ')).join('<br/>\n  ');

const wrapped = `<!-- stack:start -->\n${block}\n<!-- stack:end -->`;

if (md.includes('<!-- stack:start -->') && md.includes('<!-- stack:end -->'))
{
  md = md.replace(/<!-- stack:start -->[\s\S]*?<!-- stack:end -->/, wrapped);
} else
{
  const m = md.match(/### Stack\s*\n+<table[\s\S]*?<\/table>/);
  if (m)
  {
    md = md.replace(m[0], `### Stack\n\n${wrapped}`);
  } else
  {
    console.warn('  ! could not find a Stack table or markers in README.md - appending');
    md += `\n\n### Stack\n\n${wrapped}\n`;
  }
}

writeFileSync(README, md);
console.log(`\nwrote ${STACK.length} cards x 2 themes -> ${OUT}`);
console.log('updated README.md stack block');
