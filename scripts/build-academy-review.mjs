import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { onboardingLessons } from './academy-onboarding-content.mjs';

// Curated, synthetic QX training captures only. Never package arbitrary reports.
const root = new URL('../reports/academy-live-2026-10-09/', import.meta.url);
const files = ['01-navigacni-koncept.md', '02-vice-provozoven.md', '03-kontrola-klientskeho-nahledu.md', '04-proc-nelze-odeslat-nabidku.md', '05-mapove-podklady.md', '06-vyhledani-klienta.md'];
const lessons = [];
const media = {};
for (const lesson of onboardingLessons) {
  for (const item of lesson.steps) for (const block of item.blocks) {
    if (block.file) media[block.file] = (await readFile(new URL(block.file, root))).toString('base64');
  }
  lessons.push({ ...lesson, sourceHash: createHash('sha256').update(JSON.stringify(lesson)).digest('hex') });
}
for (const file of files) {
  const source = await readFile(new URL(file, root), 'utf8');
  const parts = source.split(/^## /m);
  const title = parts[0].split('\n')[0].replace(/^# /, '');
  const steps = [];
  for (const part of parts.slice(1)) {
    const [heading, ...lines] = part.split('\n');
    if (!/^\d+\./.test(heading) && !heading.startsWith('Známá nesrovnalost')) continue;
    const blocks = [];
    for (const paragraph of lines.join('\n').trim().split(/\n\s*\n/)) {
      const img = paragraph.match(/^!\[([^\]]*)\]\((\d{2}-[a-z0-9-]+\.jpg)\)$/);
      if (img) {
        const bytes = await readFile(new URL(img[2], root));
        media[img[2]] = bytes.toString('base64');
        blocks.push({ kind: 'image', text: img[1], file: img[2] });
      } else {
        blocks.push({ kind: 'text', text: paragraph.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*|`/g, '') });
      }
    }
    steps.push({ title: heading.replace(/^\d+\.\s*/, ''), blocks });
  }
  lessons.push({ slug: file.replace(/\.md$/, ''), title, capability: file.startsWith('06-') ? 'crm' : 'offers', category: 'Další pracovní postupy', verification: 'Ověřeno 9. 10. 2026 na školicích datech QX promotion v roli ADMIN na počítači. Omezení konkrétních kroků jsou uvedena v lekci.', duration: '1–3 min', route: file.startsWith('06-') ? '/clients' : '/offers', status: 'PUBLISHED', verifiedAt: '2026-10-09', sourceHash: createHash('sha256').update(source).digest('hex'), steps });
}
await writeFile(new URL('../lib/academy/review-lessons.json', import.meta.url), JSON.stringify(lessons, null, 2)+'\n');
await writeFile(new URL('../lib/academy/review-media.json', import.meta.url), JSON.stringify(media)+'\n');
console.log(`Prepared ${lessons.length} lessons and ${Object.keys(media).length} protected screenshots.`);
