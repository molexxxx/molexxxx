import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Document, Packer, Paragraph, TextRun,
  Tab, TabStopType, TabStopPosition, ExternalHyperlink, BorderStyle,
} from 'docx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const data = JSON.parse(readFileSync(resolve(root, 'resume.data.json'), 'utf8'));

// Palette mirrors print CSS.
const INK = '0B1220';
const INK_2 = '1F2937';
const MUTED = '4B5563';
const ACCENT = '1D4ED8';
const RULE = '9CA3AF';

// docx sizes are half-points (so 21 = 10.5pt). Mirror print CSS values.
const SIZE_BASE = 21;
const SIZE_BULLET = 20;
const SIZE_NAME = 48;
const SIZE_ROLE = 23;
const SIZE_H2 = 26;
const SIZE_JOB_TITLE = 22;
const SIZE_META = 19;
const SIZE_TIME = 18;
const SIZE_PROJECT = 21;
const SIZE_SKILL_LABEL = 17;
const SIZE_SKILL_ITEMS = 19;

const FONT = 'Calibri';
const MONO = 'Consolas';

const rightTab = [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }];

const sectionHeading = (text) => new Paragraph({
  spacing: { before: 280, after: 120 },
  border: { bottom: { color: RULE, size: 8, style: BorderStyle.SINGLE, space: 4 } },
  children: [new TextRun({
    text: text.toUpperCase(),
    bold: true, color: INK, size: SIZE_H2,
    font: FONT, characterSpacing: 30,
  })],
});

const bullet = (text) => new Paragraph({
  bullet: { level: 0 },
  spacing: { after: 30, line: 280 },
  children: [new TextRun({ text, color: INK_2, size: SIZE_BULLET, font: FONT })],
});

const link = (label, url, opts = {}) => new ExternalHyperlink({
  link: url,
  children: [new TextRun({
    text: label, color: ACCENT,
    size: opts.size ?? SIZE_BASE,
    bold: opts.bold ?? false,
    font: FONT,
    underline: opts.underline === false ? undefined : {},
  })],
});

const jobHeader = (title, company, time) => new Paragraph({
  tabStops: rightTab,
  spacing: { before: 140, after: 20 },
  children: [
    new TextRun({ text: title, bold: true, color: INK, size: SIZE_JOB_TITLE, font: FONT }),
    new TextRun({ text: '  ·  ', color: MUTED, size: SIZE_JOB_TITLE, font: FONT }),
    new TextRun({ text: company, color: ACCENT, bold: true, size: SIZE_JOB_TITLE, font: FONT }),
    new TextRun({ children: [new Tab()] }),
    new TextRun({ text: time, color: MUTED, size: SIZE_TIME, font: MONO }),
  ],
});

const children = [];

// ---------- HEADER ----------
children.push(new Paragraph({
  spacing: { after: 40 },
  children: [new TextRun({ text: data.name, bold: true, color: INK, size: SIZE_NAME, font: FONT })],
}));
children.push(new Paragraph({
  spacing: { after: 120 },
  children: [new TextRun({ text: data.title, color: ACCENT, bold: true, size: SIZE_ROLE, font: FONT })],
}));

// Summary — plain paragraph, no shaded box.
children.push(new Paragraph({
  spacing: { after: 100, line: 300 },
  children: [new TextRun({ text: data.summary, color: INK_2, size: SIZE_BASE, font: FONT })],
}));

// Contact line — single row, separator dots, hyperlinked email + links.
const contactRuns = [
  new TextRun({ text: data.location, color: MUTED, size: SIZE_META, font: FONT }),
  new TextRun({ text: '   ·   ', color: MUTED, size: SIZE_META, font: FONT }),
  link(data.email, `mailto:${data.email}`, { size: SIZE_META, underline: false }),
];
for (const l of data.links || []) {
  contactRuns.push(new TextRun({ text: '   ·   ', color: MUTED, size: SIZE_META, font: FONT }));
  contactRuns.push(link(l.label, l.url, { size: SIZE_META, underline: false }));
}
children.push(new Paragraph({
  spacing: { after: 120 },
  border: { bottom: { color: INK, size: 12, style: BorderStyle.SINGLE, space: 6 } },
  children: contactRuns,
}));

// ---------- EXPERIENCE ----------
children.push(sectionHeading('Experience'));
for (const job of data.experience) {
  children.push(jobHeader(job.role, job.company, `${job.start} – ${job.end}`));
  if (job.location) {
    children.push(new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: job.location, color: MUTED, italics: true, size: SIZE_META, font: FONT })],
    }));
  }
  for (const h of job.highlights || []) children.push(bullet(h));
}

// ---------- SELECTED PROJECTS ----------
children.push(sectionHeading('Selected Projects'));
for (const proj of data.projects) {
  children.push(new Paragraph({
    spacing: { before: 100, after: 30 },
    children: [
      link(proj.name, proj.url, { size: SIZE_PROJECT, bold: true, underline: false }),
    ],
  }));
  if (proj.blurb) {
    children.push(new Paragraph({
      spacing: { after: 40, line: 280 },
      children: [new TextRun({ text: proj.blurb, color: INK_2, size: SIZE_BULLET, font: FONT })],
    }));
  }
}

// ---------- SKILLS ----------
children.push(sectionHeading('Skills'));
for (const s of data.skills) {
  children.push(new Paragraph({
    spacing: { after: 50, line: 280 },
    children: [
      new TextRun({
        text: `${s.group.toUpperCase()}   `,
        bold: true, color: MUTED, size: SIZE_SKILL_LABEL,
        font: FONT, characterSpacing: 20,
      }),
      new TextRun({
        text: s.items.join('  ·  '),
        color: INK_2, size: SIZE_SKILL_ITEMS, font: FONT,
      }),
    ],
  }));
}

// ---------- EDUCATION ----------
children.push(sectionHeading('Education'));
for (const e of data.education) {
  children.push(jobHeader(e.degree, e.school, `${e.start} – ${e.end}`));
  if (e.location) {
    children.push(new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: e.location, color: MUTED, italics: true, size: SIZE_META, font: FONT })],
    }));
  }
  if (e.notes) for (const n of e.notes) children.push(bullet(n));
}

const doc = new Document({
  creator: data.name,
  title: `${data.name} - Resume`,
  styles: {
    default: {
      document: { run: { font: FONT, size: SIZE_BASE, color: INK } },
    },
  },
  sections: [{
    properties: {
      page: {
        // 0.5in top/bottom (720 twips), 0.55in sides (~792 twips). Matches @page in print CSS.
        margin: { top: 720, right: 792, bottom: 720, left: 792 },
      },
    },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
mkdirSync(resolve(root, 'dist'), { recursive: true });
const outPath = resolve(root, 'dist/resume.docx');
if (existsSync(outPath)) rmSync(outPath);
writeFileSync(outPath, buffer);
console.log('  ✓ dist/resume.docx');
