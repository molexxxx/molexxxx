#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { FONT, tokens, escapeXml } from './datasheet.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = resolve(ROOT, '.github', 'badges');
const README = resolve(ROOT, 'README.md');
const RAW = 'https://raw.githubusercontent.com/molexxxx/molexxxx/main/.github/badges';
mkdirSync(OUT, { recursive: true });

const STACK = [
  { area: 'Languages', items: ['TypeScript', 'JavaScript', 'Rust', 'C++', 'C#', 'Python', 'Go', 'Java'] },
  { area: 'Backend', items: ['zero-server', 'Node.js', 'Express', 'ASP.NET Core', 'Spring Boot', 'Drogon', 'GraphQL', 'gRPC'] },
  { area: 'Frontend and desktop', items: ['zQuery', 'React', 'Angular', 'Tailwind CSS', 'Vite', 'Electron', 'Qt', 'WinForms'] },
  { area: 'Data', items: ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'Redis', 'Elasticsearch', 'EF Core'] },
  { area: 'Real-time and IoT', items: ['WebSocket', 'WebRTC', 'SSE', 'STUN/TURN', 'MQTT', 'CoAP', 'LoRaWAN', 'NB-IoT'] },
  { area: 'Infrastructure', items: ['Docker', 'Kubernetes', 'Nginx', 'Linux', 'GitHub Actions', 'AWS', 'Azure', 'Cloudflare'] },
  { area: 'Robotics and drones', items: ['ROS 2', 'PX4', 'MAVLink', 'MATLAB', 'Simulink', 'OpenCV', 'NumPy'] },
  { area: 'Audio, graphics, and games', items: ['Web Audio API', 'SuperCollider', 'FAUST', 'GLSL', 'Vulkan', 'SDL3', 'Three.js', 'Godot'] },
];

const CARD_W = 415;
const TITLE_RULE_Y = 30;
const ROW_H = 26;
const COLS = 2;
const COL_X = [2, 210];
const ROWS = Math.max(...STACK.map(s => Math.ceil(s.items.length / COLS)));
const CARD_H = TITLE_RULE_Y + 1 + ROWS * ROW_H + 1;

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Renders one stack group as a ruled datasheet table: ink rule, title, and a
 * two-column item list with hairlines between rows.
 * @param {{ area: string, items: string[] }} group
 * @param {boolean} dark
 * @returns {string}
 */
function renderCard(group, dark)
{
  const t = tokens(dark);
  let rows = '';
  for (let r = 0; r < ROWS; r++)
  {
    const y = TITLE_RULE_Y + 1 + r * ROW_H;
    for (let c = 0; c < COLS; c++)
    {
      const item = group.items[r * COLS + c];
      if (item) rows += `\n    <text x="${COL_X[c]}" y="${y + 17.5}" font-size="14" fill="${t.ink}">${escapeXml(item)}</text>`;
    }
    if (r < ROWS - 1) rows += `\n    <rect x="0" y="${y + ROW_H - 0.5}" width="${CARD_W}" height="1" fill="${t.rule}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" role="img" aria-label="${escapeXml(group.area)}: ${escapeXml(group.items.join(', '))}">
  <rect x="0" y="0" width="${CARD_W}" height="1.5" fill="${t.ink}"/>
  <g font-family="${FONT}">
    <text x="2" y="20" font-size="14" font-weight="600" fill="${t.ink}">${escapeXml(group.area)}</text>${rows}
  </g>
  <rect x="0" y="${TITLE_RULE_Y}" width="${CARD_W}" height="1" fill="${t.rule}"/>
  <rect x="0" y="${CARD_H - 1}" width="${CARD_W}" height="1" fill="${t.rule}"/>
</svg>
`;
}

/**
 * Escapes a value for an HTML attribute in README markup.
 * @param {string} s
 * @returns {string}
 */
function attr(s)
{
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const hash = body => createHash('sha1').update(body).digest('hex').slice(0, 8);

const images = STACK.map(group =>
{
  const slug = `stack-${slugify(group.area)}`;
  const dark = renderCard(group, true);
  const light = renderCard(group, false);
  writeFileSync(resolve(OUT, `${slug}-dark.svg`), dark);
  writeFileSync(resolve(OUT, `${slug}-light.svg`), light);
  console.log(`ok  ${slug.padEnd(40)} ${group.items.length} items`);
  const alt = attr(`${group.area}: ${group.items.join(', ')}`);
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${RAW}/${slug}-dark.svg?v=${hash(dark)}"><img alt="${alt}" width="${CARD_W}" src="${RAW}/${slug}-light.svg?v=${hash(light)}" /></picture>`;
});

const pairs = [];
for (let i = 0; i < images.length; i += 2) pairs.push(images.slice(i, i + 2).join(' '));

const wrapped = `<!-- stack:start -->\n<p align="center">\n  ${pairs.join('\n  ')}\n</p>\n<!-- stack:end -->`;

let md = readFileSync(README, 'utf8');
if (!md.includes('<!-- stack:start -->') || !md.includes('<!-- stack:end -->'))
{
  console.error('stack markers not found in README.md');
  process.exit(1);
}
md = md.replace(/<!-- stack:start -->[\s\S]*?<!-- stack:end -->/, wrapped);
writeFileSync(README, md);
console.log(`wrote ${STACK.length} stack tables to README.md`);
