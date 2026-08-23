import assert from 'node:assert/strict';
import test from 'node:test';
import { getAppOrigin } from '../lib/app-url.ts';

test('explicit APP_URL has priority for transactional links', () => {
  const request = new Request('https://untrusted.example/forgot-password');
  assert.equal(getAppOrigin(request, { APP_URL: 'https://app.seepoint.cz/path', VERCEL_URL: 'production.vercel.app', VERCEL_ENV: 'production' }), 'https://app.seepoint.cz');
});

test('Vercel preview URL cannot be overwritten by the production APP_URL', () => {
  const request = new Request('https://untrusted.example/forgot-password');
  assert.equal(getAppOrigin(request, { APP_URL: 'https://app.seepoint.cz', VERCEL_URL: 'preview.vercel.app', VERCEL_ENV: 'preview' }), 'https://preview.vercel.app');
});

test('Vercel preview URL is used when APP_URL is missing', () => {
  const request = new Request('https://untrusted.example/forgot-password');
  assert.equal(getAppOrigin(request, { APP_URL: undefined, VERCEL_URL: 'seepoint-preview.vercel.app' }), 'https://seepoint-preview.vercel.app');
});

test('local request origin is the final fallback', () => {
  const request = new Request('http://localhost:3000/forgot-password');
  assert.equal(getAppOrigin(request, { APP_URL: undefined, VERCEL_URL: undefined }), 'http://localhost:3000');
});
