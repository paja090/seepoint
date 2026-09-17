import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { canAccess, roles, type AppSection } from '../lib/rbac';
import { PLAN_MODULE_PRESETS, SYSTEM_MODULES, isModuleEnabled } from '../lib/organization-modules';
import { findActiveNavigation, getVisibleNavigation, matchesNavigationPath, navigationHubs } from '../lib/navigation';

// The audit is a frozen inventory of the pre-redesign links, sections and modules.
const original = readFileSync('docs/navigation-audit.md', 'utf8').split('\n')
  .filter(line => line.startsWith('| ') && line.includes(' | /'))
  .map(line => { const [, , href, section, module] = line.split('|').map(s => s.trim()); return { href, section: section as AppSection, module }; });
const hrefs = (hubs: typeof navigationHubs) => hubs.flatMap(h => h.groups.flatMap(g => g.items.map(i => i[0]))).sort();
const additions = [{ href: '/planner', section: 'planner' as AppSection, module: 'planner' }, { href: '/settings/planner', section: 'planner' as AppSection, module: 'planner' }];
const current = [...original, ...additions];

test('every original link is preserved exactly once and resolves to an existing page', () => {
  assert.equal(original.length, 36);
  assert.deepEqual(hrefs(navigationHubs), current.map(i => i.href).sort());
  assert.equal(new Set(hrefs(navigationHubs)).size, current.length);
  for (const { href } of current) assert.ok(existsSync(`app${href}/page.tsx`), href);
});

test('all roles retain the original visibility across plans, overrides and missing organization', () => {
  const organizations = [null, ...Object.keys(PLAN_MODULE_PRESETS).map(plan => ({ plan })),
    { plan: 'ENTERPRISE', enabledModules: Object.fromEntries(SYSTEM_MODULES.map(m => [m.id, false])) },
    ...SYSTEM_MODULES.map(m => ({ plan: 'START', enabledModules: { [m.id]: true } })),
    ...SYSTEM_MODULES.map(m => ({ plan: 'ENTERPRISE', enabledModules: { [m.id]: false } })),
  ];
  for (const role of roles) for (const organization of organizations) {
    const expected = current.filter(item => canAccess(role, item.section) &&
      (item.module !== 'planner' || organization) &&
      (!organization || item.module === '—' || isModuleEnabled(organization, item.module))).map(i => i.href).sort();
    const actual = getVisibleNavigation({ role, organization });
    assert.deepEqual(hrefs(actual), expected, `${role}: ${JSON.stringify(organization)}`);
    assert.ok(actual.every(h => h.groups.length && h.groups.every(g => g.items.length)));
  }
});

test('platform and organization onboarding restrictions remain isolated between requests', () => {
  const base = { role: 'ADMIN' as const, organization: { plan: 'START' } };
  const admin = hrefs(getVisibleNavigation(base));
  assert.ok(!admin.includes('/onboarding'));
  const superAdmin = hrefs(getVisibleNavigation({ ...base, platformRole: 'SUPER_ADMIN' }));
  assert.ok(superAdmin.includes('/admin/organizations') && superAdmin.includes('/onboarding'));
  for (const membership of [{ role: 'OWNER', roles: [] }, { role: 'MEMBER', roles: ['ADMIN'] }]) {
    const result = hrefs(getVisibleNavigation({ ...base, membership }));
    assert.ok(result.includes('/onboarding') && !result.includes('/admin/organizations'));
  }
  assert.ok(!hrefs(getVisibleNavigation({ ...base, role: 'MANAGER', platformRole: 'SUPER_ADMIN' })).includes('/admin/organizations'));
  assert.deepEqual(hrefs(getVisibleNavigation(base)), admin);
});

test('nested paths choose the most specific item and hub without prefix collisions', () => {
  for (const [path, href, hub] of [
    ['/clients/acme?tab=contacts', '/clients', 'sales'],
    ['/clients/dashboard', '/clients/dashboard', 'sales'],
    ['/offers/123/pricing', '/offers', 'sales'],
    ['/work/route/', '/work/route', 'operations'],
    ['/work/123', '/work', 'operations'],
    ['/settings/company', '/settings/company', 'management'],
    ['/sales/opportunities/123', '/sales/opportunities', 'ai'],
    ['/occupancy/ai', '/occupancy', 'spaces'],
  ]) {
    const active = findActiveNavigation(navigationHubs, path);
    assert.equal(active?.item[0], href);
    assert.equal(active?.hub.id, hub);
  }
  assert.equal(matchesNavigationPath('/clients-other', '/clients'), false);
  assert.equal(findActiveNavigation([], '/clients'), undefined);
});
