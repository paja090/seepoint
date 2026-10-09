import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import { getVisibleNavigation } from '../../lib/navigation';
import { canAccess } from '../../lib/rbac';
import { hasModuleAccess } from '../../lib/module-policy';

// Read-only reproductions. No database, credentials, or network requests.
const portal = middleware(new NextRequest('http://academy.test/p/synthetic-token'));
assert.equal(portal.status, 307);
assert.equal(portal.headers.get('location'), 'http://academy.test/login');
console.log('AUD-01 CONFIRMED: anonymous /p/token redirects to /login before token validation.');
const nav = getVisibleNavigation({ role: 'SALES', organization: { plan: 'PRO' } });
assert.ok(nav.flatMap(h => h.groups.flatMap(g => g.items)).some(i => i[0] === '/warehouse'));
assert.equal(canAccess('SALES', 'warehouse'), false);
console.log('AUD-02 CONFIRMED: SALES sees /warehouse link but warehouse page guard denies section.');
const actor = { role: 'MANAGER', organizationId: 'synthetic-org', organization: { id: 'synthetic-org', isActive: true, plan: 'BUSINESS', enabledModules: { aiRealization: false, work: true } }, membership: { organizationId: 'synthetic-org', isActive: true } };
assert.equal(hasModuleAccess(actor, 'aiRealization', 'realization'), true);
assert.equal(getVisibleNavigation(actor as any).flatMap(h => h.groups.flatMap(g => g.items)).some(i => i[0] === '/realization'), false);
console.log('AUD-03 CONFIRMED: work fallback allows realization page while navigation hides it.');
