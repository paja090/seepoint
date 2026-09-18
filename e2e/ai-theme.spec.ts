import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

test('AI theme stays scoped, works on mobile and covers standalone dialogs', async ({ page }, testInfo) => {
  const root = process.cwd();
  const bundle = await build({ stdin: { contents: `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { SalesOpportunitiesHeader } from './components/opportunities/SalesOpportunitiesHeader';
    import { AiInboxDashboardWidget } from './components/dashboard/AiInboxDashboardWidget';
    import { OccupancyAssistantChat } from './components/occupancy/OccupancyAssistantChat';
    import { AiQuickTaskModal } from './components/tasks/AiQuickTaskModal';
    function Preview() {
      const [open, setOpen] = useState(false);
      return <>
        <div data-testid="outside" className="bg-white text-slate-900 p-4">Běžná stránka</div>
        <main className="ai-theme ai-workspace p-4 space-y-6" style={{maxWidth:1100,margin:'auto'}}>
          <SalesOpportunitiesHeader stats={{totalNew:24,totalHighScore:8,totalContactThisWeek:12,totalProposals:6,totalConverted:3}}
            canAutoDiscover onAutoDiscover={()=>{}} onOpenManualModal={()=>setOpen(true)} onOpenSettings={()=>{}}/>
          <AiInboxDashboardWidget summary={{unreviewedCount:4}}/>
          <OccupancyAssistantChat/>
          <div data-testid="email" className="ai-original-email bg-white text-slate-800 p-4"><span className="text-slate-900">Původní dokument</span></div>
          <div role="alert" className="bg-rose-50 text-rose-800 border border-rose-200 p-3">Ukázka chybového hlášení</div>
        </main>
        <AiQuickTaskModal isOpen={open} onClose={()=>setOpen(false)} employees={[]}/>
      </>;
    }
    createRoot(document.getElementById('root')).render(<Preview/>);
  `, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });
  const css = await postcss([tailwindcss({ content: [path.join(root, 'components/**/*.tsx'), { raw: 'bg-white text-slate-900 p-4 space-y-6', extension: 'html' }] })]).process(await readFile(path.join(root, 'app/globals.css'), 'utf8'), { from: undefined });
  const theme = await readFile(path.join(root, 'app/ai-theme.css'), 'utf8');
  const html = `<html lang="cs"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css.css}\n${theme}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`;
  await writeFile(testInfo.outputPath('preview.html'), html);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://ai-theme.test/**', route => route.request().url() === 'http://ai-theme.test/'
    ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('http://ai-theme.test/');
  await expect(page.getByTestId('outside')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByTestId('outside')).toHaveCSS('color', 'rgb(15, 23, 42)');
  await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(9, 15, 29)');
  await expect(page.getByRole('heading', { name: 'AI Obchodní radar' })).toHaveCSS('color', 'rgb(238, 242, 250)');
  const primary = page.getByRole('button', { name: 'Spustit AI hledání' });
  await expect(primary).toHaveCSS('background-color', 'rgb(67, 217, 177)');
  await expect(primary).toHaveCSS('color', 'rgb(6, 43, 36)');
  await primary.focus();
  await expect(primary).toHaveCSS('outline-style', 'solid');
  await expect(page.getByTestId('email')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByTestId('email').locator('span')).toHaveCSS('color', 'rgb(15, 23, 42)');
  await expect(page.getByRole('alert')).toHaveCSS('color', 'rgb(246, 154, 168)');
  await page.screenshot({ path: testInfo.outputPath('ai-theme-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Nová AI příležitost' }).click();
  const modal = page.locator('.ai-theme.fixed');
  await expect(modal.locator('.card')).toHaveCSS('background-color', 'rgb(17, 26, 43)');
  await expect(modal.locator('textarea')).toHaveCSS('background-color', 'rgb(9, 15, 29)');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(modal.getByRole('button', { name: 'Zavřít AI úkolníček' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ai-dialog-mobile.png'), fullPage: true });
  await modal.getByRole('button', { name: 'Zavřít AI úkolníček' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('ai-theme-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});
