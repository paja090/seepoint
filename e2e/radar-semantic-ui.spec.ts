import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import path from 'node:path';

// Isolated component browser test: real React components/styles, mocked HTTP fixtures.
// Does not contact the project database or any AI provider.
test('Radar sources, merge review, keep separate and detach work on desktop and mobile', async ({ page }, testInfo) => {
  const root = process.cwd();
  const bundle = await build({ stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
    import { OpportunityCard } from './components/opportunities/OpportunityCard';
    import { RadarDuplicateReview } from './components/opportunities/RadarDuplicateReview';
    const item = { id:'one', companyName:'Kaufland', title:'Nová prodejna Opava', summary:'Nová prodejna na ulici Hlučínská.', eventType:'STORE_OPENING', city:'Opava', address:'Hlučínská 10', detectedAt:'2026-09-17', updatedAt:'2026-09-17', sourceUrl:'https://news.example/a', sourceTitle:'Nová prodejna', opportunityScore:82, status:'NEW', suggestedMediaTypes:['BILLBOARD'], _count:{sources:2}, sources:[{semanticConfidence:.97}] };
    createRoot(document.getElementById('root')).render(<main style={{maxWidth:1000,margin:'auto',padding:16}}><RadarDuplicateReview onChanged={()=>{}}/><div style={{height:20}}/><OpportunityCard item={item} onChanged={()=>{}} onPrepareProposal={()=>{}} onLinkCrm={()=>{}} onUpdateStatus={()=>{}}/></main>);`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
  const css = await postcss([tailwindcss({ content: [path.join(root, 'components/opportunities/*.tsx')] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
  const source = (id: string) => ({ id, sourceTitle: id === 's1' ? 'Kaufland plánuje prodejnu' : 'Investice 350 milionů korun', sourceUrl: `https://news.example/${id}`, sourceDomain: 'news.example', sourcePublishedAt: '2026-09-16', createdAt: '2026-09-17', semanticConfidence: .97, semanticDecision: 'SAME_OPPORTUNITY' });
  let pending = true, detached = false, rejectMerge = true;
  const actions: string[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://radar.test/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<html lang="cs"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css.css} body{background:#020617;font-family:Arial,sans-serif}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>` });
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); actions.push(body.action);
      if (body.action === 'MERGE' && rejectMerge) return route.fulfill({ status: 429, headers: { 'Retry-After': '42' }, json: { error: 'Příliš mnoho požadavků.' } });
      if (body.action === 'DETACH') detached = true;
      if (body.action === 'KEEP_SEPARATE' || body.action === 'MERGE') pending = false;
      return route.fulfill({ json: { ok: true, processed: 20, proposals: 1, nextCursor: 'next' } });
    }
    if (url.pathname.includes('/opportunities/')) return route.fulfill({ json: { canReviewSources: true, item: { sources: detached ? [source('s1')] : [source('s1'), source('s2')], semanticData: { estimatedValue: '350000000', currency: 'CZK' }, fieldProvenance: { estimatedValue: 's2', currency: 's2' }, dataConflicts: [], mergedRecords: [{ id: 'old', title: 'Původní příležitost', client: { name: 'Kaufland' }, createdOffer: { id: 'offer-old', title: 'Původní nabídka' } }] } } });
    return route.fulfill({ json: { canReview: true, nextCursor: null, items: pending ? [{ id: 's3', canonicalOpportunityId: 'two', candidateOpportunityId: 'one', sourceTitle: 'Další článek o projektu', sourceUrl: 'https://other.example/c', semanticConfidence: .82, resolution: { reason: 'Stejná stavba, ověřte konkrétní adresu.' } }] : [], opportunities: [{ id: 'one', companyName: 'Kaufland', title: 'Nová prodejna Opava', city: 'Opava', semanticData: { address: 'Hlučínská 10' } }, { id: 'two', companyName: 'Kaufland', title: 'Příprava nové prodejny', city: 'Opava' }] } });
  });
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto('http://radar.test/');
  await expect(page.getByText('Jistota posledního přiřazení: 97 %')).toBeVisible();
  await page.getByRole('button', { name: 'Zdroje (2)' }).click();
  await expect(page.getByText('Hodnota investice:')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Investice 350 milionů korun' })).toHaveAttribute('href', 'https://news.example/s2');
  await expect(page.getByRole('link', { name: 'Nabídka: Původní nabídka' })).toHaveAttribute('href', '/offers/offer-old');
  await page.getByRole('button', { name: 'Možné duplicity' }).click();
  await expect(page.getByText('Navrhovaná kanonická příležitost')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('radar-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Je to stejná příležitost', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Zkuste to znovu za 42 s. Změna nebyla provedena.');
  await expect(page.getByText('Navrhovaná kanonická příležitost')).toBeVisible();
  rejectMerge = false;
  await page.getByRole('button', { name: 'Je to stejná příležitost', exact: true }).click();
  await expect(page.getByText('Příležitosti byly sjednoceny.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Tento zdroj nepatří k této příležitosti' }).last().click();
  await expect(page.getByRole('link', { name: 'Investice 350 milionů korun' })).toHaveCount(0);
  pending = true;
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Možné duplicity' }).click();
  await page.screenshot({ path: testInfo.outputPath('radar-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Jde o jinou příležitost' }).click();
  await expect(page.getByText('Příležitosti zůstávají oddělené.')).toBeVisible();
  await page.getByRole('button', { name: 'Backfill Semantic Deduplication', exact: false }).click();
  await expect(page.getByText('Prověřeno 20 příležitostí', { exact: false })).toBeVisible();
  expect(actions).toEqual(['MERGE', 'MERGE', 'DETACH', 'KEEP_SEPARATE', 'BACKFILL_PREVIEW']);
  expect(errors).toEqual([]);
});
