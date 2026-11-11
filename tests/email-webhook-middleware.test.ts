import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware.ts';

test('Resend callbacks reach signature verification without a user session', () => {
  const response = middleware(new NextRequest('https://example.cz/api/webhooks/resend', { method: 'POST' }));
  assert.equal(response.headers.get('x-middleware-next'), '1');
});

test('The webhook exemption does not expose other webhooks, child routes or email settings', () => {
  for (const path of ['/api/webhooks/other', '/api/webhooks/resend/extra', '/api/webhooks/resend-copy', '/api/settings/email', '/api/settings/email/test']) {
    const response = middleware(new NextRequest(`https://example.cz${path}`, { method: 'POST' }));
    assert.equal(response.status, 401, path);
  }
});

test('Vercel cron routes and signed ack-email reach handler auth without a session cookie', () => {
  for (const path of [
    '/api/cron/planner',
    '/api/cron/ai-inbox',
    '/api/cron/sales-radar',
    '/api/cron/daily-briefing',
    '/api/cron/google-sheet-plan',
    '/api/work-orders/ack-email?token=abc.def',
  ]) {
    const response = middleware(new NextRequest(`https://example.cz${path}`, { method: 'GET' }));
    assert.equal(response.headers.get('x-middleware-next'), '1', path);
  }

  for (const blocked of ['/api/cron/other', '/api/work-orders', '/api/work-orders/ack-email/extra']) {
    const response = middleware(new NextRequest(`https://example.cz${blocked}`, { method: 'GET' }));
    assert.equal(response.status, 401, blocked);
  }
});
