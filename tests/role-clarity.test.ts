import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('shell rozlišuje aktivní, organizační a platformovou roli', () => {
  const shell = source('components/AppShell.tsx');
  const responsive = source('components/ResponsiveAppShell.tsx');
  const topbar = source('components/AppTopbar.tsx');

  assert.match(shell, /organizationRoleLabel: user\.membership\?\.role === 'OWNER' \? 'Vlastník organizace'/);
  assert.match(shell, /isPlatformSuperAdmin: user\.platformRole === 'SUPER_ADMIN'/);
  assert.match(responsive, /Aktivní role: \{roleLabel\(user\.role\)\}/);
  assert.match(responsive, /Členství: \{user\.organizationRoleLabel\}/);
  assert.match(responsive, /Platforma: Superadmin/);
});

test('profil vysvětluje, že přepnutí aktivní role neodebírá oprávnění', () => {
  const profile = source('app/profile/page.tsx');
  assert.match(profile, /Aktivní role: \{roleLabel\(user\.role\)\}/);
  assert.match(profile, /Členství: \{user\.membership\?\.role === 'OWNER'/);
  assert.match(profile, /user\.platformRole === 'SUPER_ADMIN'/);
  assert.match(profile, /Nemění vaše členství v organizaci ani platformové oprávnění/);
});
