import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import assert from 'node:assert/strict';

const date = '2035-06-10';
const location = { latitude: 49.82, longitude: 18.26 };
const items = [
  { id: 'work', title: 'Výměna reklamy u nádraží', client: 'Klient A', address: 'Ostrava, Nádražní', source: 'work', state: 'ready', quantity: 2, detailUrl: '/work/work', location },
  { id: 'navigation-point:n', title: 'Montáž směrovky', client: 'Klient B', address: 'Poruba', source: 'navigation', state: 'ready', quantity: 1, detailUrl: '/navigation/n', location: { latitude: 49.83, longitude: 18.2 } },
  { id: 'field-step:f', title: 'Přesun lavičky', client: 'Klient C', address: 'Park', source: 'field', state: 'ready', quantity: 1, detailUrl: '/election-removal/c', location: { latitude: 49.8, longitude: 18.24 } },
  { id: 'issue', title: 'Nepřístupné stanoviště', client: 'Klient D', address: 'Centrum', source: 'field', state: 'issue', reason: 'Uzamčený vjezd, potřeba domluvit přístup.', quantity: 3, detailUrl: '/election-removal/d' },
  { id: 'assigned', title: 'Instalace banneru', client: 'Klient E', address: 'Vítkovice', source: 'work', state: 'planned', quantity: 1, detailUrl: '/work/assigned', planId: 'p' },
].map(item => ({ reason: '', ...item }));
const stop = { jobId: 'assigned', workOrderId: 'assigned', title: 'Instalace banneru', location, routeOrder: 1, arrivalAt: date + 'T06:00:00Z', startAt: date + 'T06:00:00Z', endAt: date + 'T06:20:00Z', serviceMinutes: 20, travel: { durationSeconds: 300, distanceMeters: 2000, estimated: true } };
const crew = { id: 'c', name: 'Posádka Novák', names: ['Jan Novák'], employeeIds: ['e'], vehicleId: 'v', vehicleName: 'Dodávka 01', departureAt: date + 'T05:30:00Z', endAt: date + 'T13:00:00Z', stops: [stop, { ...stop, jobId: 'field-step:f2', workOrderId: '', routeOrder: 2, title: 'Demontáž panelu', location: { latitude: 49.79, longitude: 18.29 } }], returnLeg: { durationSeconds: 300, distanceMeters: 2000 }, serviceMinutes: 40, distanceMeters: 6000, travelSeconds: 900 };
const result = { crews: [crew], conflicts: [], unassigned: [], estimated: true, distanceMeters: 6000, travelSeconds: 900, serviceMinutes: 40 };
const plans = [{ id: 'p', date, status: 'ACTIVE', version: 1, electionCampaignId: null, planningSummary: result }, { id: 'tomorrow', date: '2035-06-11', status: 'DRAFT', version: 1, electionCampaignId: 'campaign', planningSummary: { ...result, crews: [{ ...crew, name: 'Posádka Svoboda', departureAt: '2035-06-11T06:00:00Z', endAt: '2035-06-11T13:00:00Z' }] } }];
const props = { date, today: date, items, plans, canCreate: true, messages: [], depot: location, progress: { 'p:c': { total: 2, done: 1, issues: 1 } } };
const mocks = {
  'next/link': 'export default function Link({children,...props}){return <a {...props}>{children}</a>}',
  'next/navigation': 'export const useRouter=()=>({push:url=>{window.pushed=url},refresh:()=>{window.refreshed=true}});',
};
const bundle = await build({ stdin: { contents: 'import React from "react";import {createRoot} from "react-dom/client";import {DispatchBoard} from "./components/dispatch/DispatchBoard";const props=' + JSON.stringify(props) + ';createRoot(document.getElementById("root")).render(<DispatchBoard {...props} view={new URL(location.href).searchParams.get("view")||"day"}/>);', resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env': '{}' }, plugins: [{ name: 'fixtures', setup(b) { b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, namespace: 'fixture' } : undefined); b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'tsx', resolveDir: process.cwd() })); } }] });
const css = (await postcss([tailwind({ content: ['./components/dispatch/*.tsx', './components/planner/{WeekView,Timeline}.tsx', './components/field-planning/RouteMap.tsx'], theme: { extend: {} }, plugins: [] })]).process('@tailwind base;@tailwind components;@tailwind utilities;', { from: undefined })).css + await readFile('node_modules/leaflet/dist/leaflet.css', 'utf8');
const server = createServer((req, res) => { res.setHeader('Content-Type', req.url === '/bundle.js' ? 'application/javascript' : req.url === '/style.css' ? 'text/css' : 'text/html'); res.end(req.url === '/bundle.js' ? bundle.outputFiles[0].text : req.url === '/style.css' ? css : '<html lang="cs"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><body style="background:#f1f5f9;padding:20px;font-family:Arial,sans-serif"><div id="root"></div><script src="/bundle.js"></script></body></html>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1536, height: 1100 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route(/tile\.openstreetmap\.org/, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e9eff1"/><path d="M0 90H256M95 0V256M0 230L256 0" stroke="#fff" stroke-width="12" fill="none"/></svg>' }));
  await page.route('**/api/**', () => assert.fail('Read-only UI fixture must not call an API'));
  const base = 'http://127.0.0.1:' + server.address().port;
  await page.goto(base); await page.getByRole('region', { name: 'Mapa tras posádek' }).waitFor();
  await page.locator('.leaflet-interactive').last().waitFor();
  assert.equal(await page.getByRole('progressbar', { name: 'Dokončení Posádka Novák' }).getAttribute('value'), '1');
  assert.equal(await page.getByRole('button', { name: /Zvýraznit trasu Posádka Svoboda/ }).count(), 0);
  await page.getByLabel('Zdroj práce').selectOption('navigation'); assert.equal(await page.getByRole('checkbox', { name: 'Vybrat Výměna reklamy u nádraží' }).count(), 0);
  await page.getByRole('button', { name: 'Zrušit filtry' }).click();
  const detailButton = page.getByRole('button', { name: /Výměna reklamy u nádraží/ }); await detailButton.click();
  const dialog = page.getByRole('dialog'); assert.equal(await dialog.isVisible(), true);
  assert.equal(await dialog.getByRole('link', { name: 'Úplný detail a podklady' }).getAttribute('href'), '/work/work');
  await page.keyboard.press('Escape'); assert.equal(await dialog.count(), 0); assert.equal(await detailButton.evaluate(element => element === document.activeElement), true);
  await page.getByRole('checkbox', { name: 'Vybrat dostupné (3)' }).check();
  const link = await page.getByRole('link', { name: /Naplánovat:/ }).getAttribute('href'); assert.equal(new URL(link, base).searchParams.get('jobs'), 'work,navigation-point:n,field-step:f');
  assert.equal(await page.getByRole('checkbox', { name: 'Vybrat Nepřístupné stanoviště' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Zvýraznit trasu Posádka Novák' }).click();
  await page.getByText('Časová osa pracovníků', { exact: false }).click(); assert.ok(await page.getByRole('region', { name: 'Časová osa Jan Novák' }).isVisible());
  await mkdir('tmp', { recursive: true }); await page.screenshot({ path: 'tmp/dispatch-cockpit-desktop.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'tmp/dispatch-cockpit-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: 'Přidat práci', exact: true }).click(); await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: 'Týden', exact: true }).click(); assert.match(await page.evaluate(() => window.pushed), /view=week/);
  await page.goto(base + '/?view=week'); assert.ok(await page.getByText('Posádka Svoboda · Návrh', { exact: true }).isVisible()); assert.equal(await page.getByRole('button', { name: /Upravit čas/ }).count(), 0);
  assert.match(await page.getByRole('link', { name: 'Otevřít trasu →' }).last().getAttribute('href'), /date=2035-06-11/);
  await page.goto(base + '/?view=map'); await page.locator('.leaflet-interactive').last().waitFor(); await page.locator('path.leaflet-interactive').last().click(); assert.ok(await page.getByRole('dialog').isVisible());
  assert.deepEqual(errors, []);
  console.log('PASS desktop/mobile layout, actual RouteMap integration, side-panel keyboard, source filters, mixed selection, progress, read-only week and timeline');
} finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
