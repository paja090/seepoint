import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

test('Planner cron reaches its secret-authenticated handler without a browser cookie', () => {
  const response = middleware(new NextRequest('https://seepoint.vercel.app/api/cron/planner'));
  assert.equal(response.headers.get('x-middleware-next'), '1');
});

test('Planner user APIs and nested cron paths still require a browser session', () => {
  for (const path of ['/api/planner', '/api/planner/settings', '/api/cron/planner/other']) {
    const response = middleware(new NextRequest(`https://seepoint.vercel.app${path}`));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('x-middleware-next'), null);
  }
});
