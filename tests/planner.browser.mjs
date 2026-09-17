// Real React/mobile interaction checks against a mocked Planner API; no production writes.
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import { readFileSync, mkdirSync } from 'node:fs';
const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {PlannerCockpit} from './components/planner/PlannerCockpit'; import {PlannerSettings} from './components/planner/PlannerSettings'; createRoot(document.getElementById('root')).render(location.pathname.includes('settings') ? <PlannerSettings /> : <PlannerCockpit />);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' } });
const css = await postcss([tailwind({ content: ['./components/planner/**/*.{ts,tsx}'] })]).process(readFileSync('app/globals.css', 'utf8'), { from: undefined });
const preferences = { timezone: 'Europe/Prague', workingDays: [1,2,3,4,5], workingStart: '09:00', workingEnd: '17:00', lunchStart: '12:00', lunchEnd: '12:30', meetingBufferMinutes: 15, defaultMeetingDuration: 45, preferredFocusStart: '09:00', preferredFocusEnd: '12:00', preferredMeetingStart: '09:00', preferredMeetingEnd: '17:00', noMeetingBlocks: [], aiEnabled: false, autoSuggestions: false };
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined });
mkdirSync('tmp/planner', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let saved, settingsSaved;
  await page.route('https://planner-test.invalid/**', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.fulfill({ contentType: 'text/html', body: '<main id="root" style="padding:16px;max-width:1440px;margin:auto"></main>' });
    if (url.pathname === '/api/planner/settings') {
      if (route.request().method() === 'PUT') { settingsSaved = route.request().postDataJSON(); return route.fulfill({ json: { ok: true } }); }
      return route.fulfill({ json: { preferences, connections: [], googleConfigured: false, googleEnabled: true, isAdmin: true } });
    }
    if (url.pathname === '/api/planner/blocks') { saved = route.request().postDataJSON(); return route.fulfill({ json: { id: 'new' } }); }
    const date = url.searchParams.get('date') || '2026-09-16', view = url.searchParams.get('view');
    return route.fulfill({ json: { date, view, preferences, items: [], tasks: [{ id:'canonical-task', sourceKind:'WORK_TASK', title:'Dokončit nabídku klientovi', dueAt:null, href:'/my-tasks', priority:'HIGH', plannedMinutes:60 }], attention: [], capacity:{ totalMinutes:450,busyMinutes:0,freeMinutes:450,utilization:0 }, slots:[], connections:[], canSeeTeam:true, aiAvailable:false, googleEnabled:true, team:[{id:'user-a',name:'Martin',today:{freeMinutes:300,utilization:25},weekFreeMinutes:1500,importantTasks:2,deadlines:1,overCapacity:false}] } });
  });
  const open = async path => { await page.goto('https://planner-test.invalid' + path); await page.addStyleTag({ content: css.css }); await page.addScriptTag({ content: bundle.outputFiles[0].text }); };
  await open('/planner');
  await expect(page.getByRole('heading', { name: 'Priority', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'tmp/planner/planner-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '+ Pracovní blok', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Propojit s úkolem').selectOption('WORK_TASK:canonical-task');
  await expect(page.getByLabel('Název', { exact: true })).toHaveValue('Dokončit nabídku klientovi');
  await page.getByRole('button', { name: 'Potvrdit a uložit' }).click();
  await expect.poll(() => saved?.sourceId).toBe('canonical-task');
  expect(saved.sourceKind).toBe('WORK_TASK');
  expect(saved.requestKey).toBeTruthy();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Tým', exact: true }).click();
  await expect(page.getByText('Martin', { exact:true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Týden', exact: true }).click();
  await page.screenshot({ path: 'tmp/planner/planner-week.png', fullPage: true });
  await open('/settings/planner');
  await expect(page.getByRole('heading', { name: 'Pracovní rytmus' })).toBeVisible();
  await page.getByLabel('Rezerva mezi schůzkami (min)').fill('30');
  await page.getByRole('button', { name: 'Uložit moje preference' }).click();
  await expect.poll(() => settingsSaved?.preferences.meetingBufferMinutes).toBe(30);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'tmp/planner/planner-settings-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  console.log('PASS: mobile overflow, Today/Week/Team, confirmed task-linked block, preferences, no browser errors');
} finally { await browser.close(); }
