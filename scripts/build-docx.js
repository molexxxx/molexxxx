import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Tab, TabStopType, TabStopPosition, ExternalHyperlink, BorderStyle,
} from 'docx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const data = JSON.parse(readFileSync(resolve(root, 'resume.data.json'), 'utf8'));

const INK = '0B1220';
const ACCENT = '2563EB';
const MUTED = '4B5563';

const tabStops = [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }];

const p = (children, opts = {}) => new Paragraph({ children, spacing: { before: 0, after: 60 }, ...opts });

const sectionHeading = (text) => new Paragraph({
  spacing: { before: 220, after: 100 },
  border: { bottom: { color: 'E5E7EB', size: 6, style: BorderStyle.SINGLE, space: 4 } },
  children: [new TextRun({ text: text.toUpperCase(), bold: true, color: ACCENT, size: 20, characterSpacing: 40 })],
});

const bullet = (text) => new Paragraph({
  bullet: { level: 0 },
  spacing: { after: 40 },
  children: [new TextRun({ text, color: INK, size: 20 })],
});

const jobHeader = (left, right) => new Paragraph({
  tabStops,
  spacing: { before: 100, after: 20 },
  children: [...left, new TextRun({ children: [new Tab()] }), new TextRun({ text: right, color: MUTED, size: 18, font: 'Consolas' })],
});

const link = (label, url) => new ExternalHyperlink({
  link: url,
  children: [new TextRun({ text: label, color: ACCENT, size: 20, underline: {} })],
});

const children = [];

// HERO
children.push(new Paragraph({
  spacing: { after: 40 },
  children: [new TextRun({ text: data.name, bold: true, color: INK, size: 56 })],
}));
children.push(new Paragraph({
  spacing: { after: 40 },
  children: [new TextRun({ text: data.title, color: ACCENT, bold: true, size: 24 })],
}));
children.push(new Paragraph({
  spacing: { after: 120 },
  children: [new TextRun({ text: data.tagline, color: MUTED, size: 20 })],
}));

// CONTACT line
const contactRuns = [
  new TextRun({ text: `${data.location}  ·  `, color: MUTED, size: 20 }),
  link(data.email, `mailto:${data.email}`),
  new TextRun({ text: `  ·  ${data.phone}`, color: MUTED, size: 20 }),
];
for (const l of data.links) {
  contactRuns.push(new TextRun({ text: '  ·  ', color: MUTED, size: 20 }));
  contactRuns.push(link(l.label, l.url));
}
children.push(new Paragraph({
  spacing: { after: 160 },
  border: { bottom: { color: INK, size: 18, style: BorderStyle.SINGLE, space: 8 } },
  children: contactRuns,
}));

// SUMMARY
children.push(new Paragraph({
  spacing: { after: 160 },
  shading: { type: 'clear', fill: 'EFF6FF' },
  border: { left: { color: ACCENT, size: 18, style: BorderStyle.SINGLE, space: 8 } },
  children: [new TextRun({ text: data.summary, color: INK, size: 20 })],
}));

// EXPERIENCE
children.push(sectionHeading('Experience'));
for (const job of data.experience) {
  children.push(jobHeader(
    [
      new TextRun({ text: job.role, bold: true, color: INK, size: 22 }),
      new TextRun({ text: `  ·  ${job.company}`, color: MUTED, size: 22 }),
    ],
    `${job.start} – ${job.end}`,
  ));
  children.push(new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: job.location, color: MUTED, italics: true, size: 18 })],
  }));
  for (const h of job.highlights) children.push(bullet(h));
}

// PROJECTS
children.push(sectionHeading('Selected Projects'));
for (const proj of data.projects) {
  children.push(new Paragraph({
    spacing: { before: 80, after: 20 },
    children: [
      link(proj.name, proj.url),
    ],
  }));
  children.push(new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: proj.blurb, color: MUTED, size: 20 })],
  }));
}

// SKILLS
children.push(sectionHeading('Skills'));
for (const s of data.skills) {
  children.push(new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: `${s.group}:  `, bold: true, color: MUTED, size: 18 }),
      new TextRun({ text: s.items.join('  ·  '), color: INK, size: 20 }),
    ],
  }));
}

// EDUCATION
children.push(sectionHeading('Education'));
for (const e of data.education) {
  children.push(jobHeader(
    [
      new TextRun({ text: e.degree, bold: true, color: INK, size: 22 }),
      new TextRun({ text: `  ·  ${e.school}`, color: MUTED, size: 22 }),
    ],
    `${e.start} – ${e.end}`,
  ));
  children.push(new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: e.location, color: MUTED, italics: true, size: 18 })],
  }));
  if (e.notes) for (const n of e.notes) children.push(bullet(n));
}

const doc = new Document({
  creator: data.name,
  title: `${data.name} — Resume`,
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 20, color: INK } },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 720, right: 900, bottom: 720, left: 900 },
      },
    },
    children,
  }],
});

const buffer = await Packer.toBuffer(doc);
mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/resume.docx'), buffer);
console.log('  ✓ dist/resume.docx');
