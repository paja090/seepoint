import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('tenant security guard internal rules pass', () => {
  const result = spawnSync(process.execPath, ['scripts/check-tenant-security.mjs', '--self-test'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /self-test: OK/);
});

test('current repository satisfies tenant security policy', () => {
  const result = spawnSync(process.execPath, ['scripts/check-tenant-security.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Tenant security guard: OK/);
});
