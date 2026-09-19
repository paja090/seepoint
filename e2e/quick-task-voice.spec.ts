import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';

// Allow a cold Chrome start on constrained developer machines; assertions keep their normal timeout.
test.setTimeout(120_000);

let html: string;
test.beforeAll(async () => {
  test.setTimeout(180_000);
  const bundle = await build({ stdin: { contents: `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {AiQuickTaskModal} from './components/tasks/AiQuickTaskModal';
    function App() {
      const [open, setOpen] = useState(false);
      const [mounted, setMounted] = useState(true);
      return <><button onClick={()=>{setMounted(true);setOpen(true)}}>Otevřít úkolníček</button>
        <button onClick={()=>setMounted(false)}>Unmount</button>
        {mounted && <AiQuickTaskModal isOpen={open} onClose={()=>setOpen(false)} employees={[]}/>}</>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  `, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
  html = `<html lang="cs"><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`;
});

type VoiceMock = { starts: number; stops: number; tracksStopped: number; permissions: number; chosenType: string; finishPermission?: () => void };
declare global { interface Window { voiceMock: VoiceMock } }

async function setup(page: Page, options: { permission?: 'denied' | 'pending' | 'unavailable'; format?: 'mp4' | 'default'; empty?: boolean; unsupported?: boolean; recorderError?: boolean } = {}) {
  await page.addInitScript(options => {
    const stats: VoiceMock = { starts: 0, stops: 0, tracksStopped: 0, permissions: 0, chosenType: '' };
    window.voiceMock = stats;
    const stream = { getTracks: () => [{ stop: () => { stats.tracksStopped++; } }] };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
      stats.permissions++;
      if (options.permission === 'denied') throw new DOMException('denied', 'NotAllowedError');
      if (options.permission === 'unavailable') throw new DOMException('unavailable', 'NotFoundError');
      if (options.permission === 'pending') await new Promise<void>(resolve => { stats.finishPermission = resolve; });
      return stream;
    } } });
    class Recorder {
      state = 'inactive';
      mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      static isTypeSupported(type: string) { return options.format === 'default' ? false : options.format === 'mp4' ? type === 'audio/mp4' : type === 'audio/webm;codecs=opus'; }
      constructor(_stream: unknown, init?: { mimeType: string }) { this.mimeType = init?.mimeType || 'audio/mp4'; stats.chosenType = init?.mimeType || 'default'; }
      start() { this.state = 'recording'; stats.starts++; if (options.recorderError) setTimeout(() => this.onerror?.(), 0); }
      stop() {
        this.state = 'inactive'; stats.stops++;
        setTimeout(() => {
          this.ondataavailable?.({ data: new Blob(options.empty ? [] : ['recorded-audio'], { type: this.mimeType }) });
          this.onstop?.();
          this.onstop?.(); // Defend even against duplicated stop callbacks.
        }, 0);
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: options.unsupported ? undefined : Recorder });
  }, options);
  await page.route('http://localhost:4179/', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://localhost:4179/');
  await page.getByRole('button', { name: 'Otevřít úkolníček' }).click();
  expect(await page.evaluate(() => window.voiceMock.permissions)).toBe(0);
}

for (const format of ['mp4', 'default', undefined] as const) test(`record → stop → transcript → edit → tasks (${format || 'webm'})`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { format });
  let uploads = 0;
  let submitted = '';
  await page.route('**/api/ai/transcribe-quick-task', async route => {
    uploads++;
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    expect(route.request().postDataBuffer()?.toString()).toContain('recorded-audio');
    await route.fulfill({ json: { transcript: 'Pavle zítra zavolej grafikovi.' } });
  });
  await page.route('**/api/ai/parse-quick-tasks', async route => {
    submitted = route.request().postDataJSON().prompt;
    await route.fulfill({ json: { tasks: [{ id: 'task-a', title: 'Zavolat Petrovi', priority: 'MEDIUM' }] } });
  });
  await page.getByRole('button', { name: 'Namluvit úkol' }).click();
  await expect(page.getByRole('status')).toContainText('Poslouchám');
  await expect(page.getByRole('button', { name: 'Vytvořit Check-list' })).toBeDisabled();
  await page.getByRole('button', { name: 'Ukončit nahrávání' }).click();
  await expect(page.getByRole('textbox')).toHaveValue('Pavle zítra zavolej grafikovi.');
  const stats = await page.evaluate(() => window.voiceMock);
  expect(stats.starts).toBe(1); expect(stats.stops).toBe(1); expect(stats.tracksStopped).toBe(1);
  expect(stats.chosenType).toBe(format === 'default' ? 'default' : format === 'mp4' ? 'audio/mp4' : 'audio/webm;codecs=opus');
  expect(uploads).toBe(1);
  await page.getByRole('textbox').fill('Zítra zavolat Petrovi a objednat folie.');
  await page.getByRole('button', { name: 'Vytvořit Check-list' }).click();
  await expect(page.getByText('Vytvořen Check-list o 1 položkách!')).toBeVisible();
  expect(submitted).toBe('Zítra zavolat Petrovi a objednat folie.');
});

for (const permission of ['denied', 'unavailable'] as const) test(`microphone ${permission} preserves manual input`, async ({ page }) => {
  await setup(page, { permission });
  await page.route('**/api/ai/parse-quick-tasks', route => route.fulfill({ json: { tasks: [{ id: 'manual-task', title: 'Ručně zadaný úkol', priority: 'MEDIUM' }] } }));
  await page.getByRole('button', { name: 'Namluvit úkol' }).click();
  await expect(page.getByRole('alert')).toContainText(permission === 'denied' ? 'Mikrofon není povolen' : 'Mikrofon není dostupný');
  await page.getByRole('textbox').fill('Ručně zadaný úkol');
  await expect(page.getByRole('button', { name: 'Vytvořit Check-list' })).toBeEnabled();
  await page.getByRole('button', { name: 'Vytvořit Check-list' }).click();
  await expect(page.getByText('Vytvořen Check-list o 1 položkách!')).toBeVisible();
});

for (const unmount of [false, true]) test(`cleanup on ${unmount ? 'unmount' : 'close'}`, async ({ page }) => {
  await setup(page);
  let uploads = 0;
  await page.route('**/api/ai/transcribe-quick-task', route => { uploads++; return route.abort(); });
  await page.getByRole('button', { name: 'Namluvit úkol' }).click();
  await expect(page.getByRole('status')).toContainText('Poslouchám');
  await page.getByRole('button', { name: unmount ? 'Unmount' : 'Zavřít AI úkolníček', exact: true }).click();
  expect(await page.evaluate(() => window.voiceMock.tracksStopped)).toBe(1);
  expect(await page.evaluate(() => window.voiceMock.stops)).toBe(1);
  expect(uploads).toBe(0);
});

test('permission pending: no parallel start and late stream is released after close', async ({ page }) => {
  await setup(page, { permission: 'pending' });
  await page.getByRole('button', { name: 'Namluvit úkol' }).dblclick();
  await expect(page.getByRole('status')).toContainText('Povolte přístup');
  expect(await page.evaluate(() => window.voiceMock.permissions)).toBe(1);
  await page.getByRole('button', { name: 'Zavřít AI úkolníček' }).click();
  await page.evaluate(() => window.voiceMock.finishPermission?.());
  await expect.poll(() => page.evaluate(() => window.voiceMock.tracksStopped)).toBe(1);
  expect(await page.evaluate(() => window.voiceMock.starts)).toBe(0);
});

test('transcription failure shows safe error and restores manual editing', async ({ page }) => {
  await setup(page);
  await page.route('**/api/ai/transcribe-quick-task', route => route.fulfill({ status: 502, json: { error: 'technical provider stack trace' } }));
  await page.getByRole('textbox').fill('Původní text');
  await page.getByRole('button', { name: 'Namluvit úkol' }).click();
  await page.getByRole('button', { name: 'Ukončit nahrávání' }).click();
  await expect(page.getByRole('alert')).toContainText('AI přepis není dostupný');
  await expect(page.getByRole('alert')).not.toContainText('stack trace');
  await expect(page.getByRole('textbox')).toHaveValue('Původní text');
  await expect(page.getByRole('textbox')).toBeEnabled();
});

for (const kind of ['empty', 'unsupported', 'recorderError'] as const) test(`${kind} is recoverable`, async ({ page }) => {
  await setup(page, { [kind]: true });
  await page.getByRole('button', { name: 'Namluvit úkol' }).click();
  if (kind === 'empty') await page.getByRole('button', { name: 'Ukončit nahrávání' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('textbox')).toBeEnabled();
});

test('transcription pending disables controls; close discards late response', async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/ai/transcribe-quick-task', async route => { await pending; await route.fulfill({ json: { transcript: 'Late transcript' } }).catch(() => {}); });
  await page.getByRole('button', { name: 'Namluvit úkol' }).click();
  await page.getByRole('button', { name: 'Ukončit nahrávání' }).click();
  await expect(page.getByRole('status')).toContainText('Přepisuji hlas');
  await expect(page.getByRole('button', { name: 'Namluvit úkol' })).toBeDisabled();
  await expect(page.getByRole('textbox')).toBeDisabled();
  await page.getByRole('button', { name: 'Zavřít AI úkolníček' }).click();
  release();
  await page.getByRole('button', { name: 'Otevřít úkolníček' }).click();
  await expect(page.getByRole('textbox')).toHaveValue('');
});

test('recording duration limit stops the microphone and transcribes', async ({ page }) => {
  await setup(page);
  await page.clock.install();
  await page.route('**/api/ai/transcribe-quick-task', route => route.fulfill({ json: { transcript: 'Hotový přepis' } }));
  await page.getByRole('button', { name: 'Namluvit úkol' }).click();
  await expect(page.getByRole('status')).toContainText('Poslouchám');
  await page.clock.fastForward(121_000);
  await expect(page.getByRole('textbox')).toHaveValue('Hotový přepis');
  expect(await page.evaluate(() => window.voiceMock.tracksStopped)).toBe(1);
});

test('client transcription timeout restores text input', async ({ page }) => {
  await setup(page);
  await page.clock.install();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/ai/transcribe-quick-task', async route => { await pending; await route.abort().catch(() => {}); });
  await page.getByRole('button', { name: 'Namluvit úkol' }).click();
  await page.getByRole('button', { name: 'Ukončit nahrávání' }).click();
  await expect(page.getByRole('status')).toContainText('Přepisuji hlas');
  await page.clock.fastForward(31_000);
  await expect(page.getByRole('alert')).toContainText('Přepis trval příliš dlouho');
  await expect(page.getByRole('textbox')).toBeEnabled();
  release();
});
