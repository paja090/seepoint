// Run: node tests/vehicle-photos.browser.mjs
// Exercises the real React components with mocked network responses, without production writes.
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import postcss from 'postcss';
import tailwind from 'tailwindcss';

const fixture = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZAAAAABJRU5ErkJggg==';
const bundle = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
    import {VehicleDocumentPreview} from './components/VehicleDocumentPreview';
    import {TeamChatContainer} from './components/chat/TeamChatContainer';
    createRoot(document.getElementById('root')).render(<><VehicleDocumentPreview url={${JSON.stringify(fixture)}} /><TeamChatContainer currentUser={{id:'test',name:'Test',role:'ADMIN'}} vehicles={[{id:'car-1',label:'Test auto'}]} /></>);`,
    resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
});
const css = await postcss([tailwind({ content: ['./components/VehicleDocumentPreview.tsx', './components/chat/TeamChatContainer.tsx'] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => console.error(error.message));
  let failOdometer = false;
  let saved;
  await page.route('https://vehicle-test.invalid/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' });
    if (path === '/api/chat/upload') return route.fulfill({ json: { url: '/api/photos/receipt-1/file' } });
    if (path === '/api/fuel/ocr') {
      const input = route.request().postDataJSON();
      expect(input.imageUrl).toMatch(/^data:image\/jpeg;base64,/);
      if (input.mode === 'odometer') return route.fulfill({ status: failOdometer ? 502 : 200, json: failOdometer ? { error: 'Tachometr není čitelný. Zadejte kilometry ručně.' } : { ok: true, data: { odometer: 142500 } } });
      return route.fulfill({ json: { ok: true, data: { amountCzk: 1850.55, liters: 48.5 } } });
    }
    if (path === '/api/chat/messages' && route.request().method() === 'POST') {
      saved = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: 'saved' } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('https://vehicle-test.invalid/');
  await page.addStyleTag({ content: css.css });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const preview = page.getByRole('button', { name: 'Zobrazit účtenku', exact: true });
  await preview.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const close = page.getByRole('button', { name: 'Zavřít', exact: true });
  const box = await close.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await close.click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(preview).toBeFocused();
  await preview.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  console.log('PASS: mobile preview closes by button and Escape and restores focus');

  await page.getByRole('button', { name: '⛽ Palivo', exact: true }).click();
  const file = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(fixture.split(',')[1], 'base64') };
  const choose = async name => {
    const picker = page.waitForEvent('filechooser');
    await page.getByRole('button', { name }).click();
    await (await picker).setFiles(file);
  };
  await choose('✨ Vyfotit účtenku (AI přečte cenu i litry)');
  await expect(page.getByPlaceholder('Např. 1850')).toHaveValue('1850.55');
  await choose('Vyfotit / vybrat tachometr');
  await expect(page.getByPlaceholder('Např. 142500')).toHaveValue('142500');
  failOdometer = true;
  await choose('Vyfotit / vybrat tachometr');
  await expect(page.getByText('Tachometr není čitelný. Zadejte kilometry ručně.')).toBeVisible();
  await expect(page.getByPlaceholder('Např. 142500')).toHaveValue('142500');
  await page.getByRole('button', { name: 'Uložit Účtenku', exact: true }).click();
  await expect.poll(() => saved).toBeTruthy();
  expect(saved.fuelExpense).toMatchObject({ vehicleId: 'car-1', odometer: 142500, amount: 1850.55, receiptUrl: '/api/photos/receipt-1/file' });
  expect(saved.imageUrl).toBeNull();
  console.log('PASS: separate odometer OCR, retry failure preserves kilometres, receipt remains linked to car');
} finally {
  await browser.close();
}
