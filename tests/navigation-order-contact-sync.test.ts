import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Navigation order detail view exposes contact edit button and CRM link', () => {
  const detailSource = readFileSync(new URL('../components/navigation/NavigationOrderDetailView.tsx', import.meta.url), 'utf8');
  
  assert.match(detailSource, /setShowContactModal\(true\)/, 'Contact card must have button to open contact modal');
  assert.match(detailSource, /<Edit3 size=\{13\} \/> Upravit/, 'Contact card must show "Upravit" button');
  assert.match(detailSource, /\/clients\/\$\{currentOrder\.clientId\}/, 'Client name must link to CRM client card');
  assert.match(detailSource, /<NavigationContactModal/, 'Detail view must render NavigationContactModal');
});

test('NavigationContactModal provides complete form and syncs with CRM', () => {
  const modalSource = readFileSync(new URL('../components/navigation/NavigationContactModal.tsx', import.meta.url), 'utf8');

  assert.match(modalSource, /contactPerson/, 'Modal must have contactPerson field');
  assert.match(modalSource, /contactEmail/, 'Modal must have contactEmail field');
  assert.match(modalSource, /contactPhone/, 'Modal must have contactPhone field');
  assert.match(modalSource, /assignedUserId/, 'Modal must have assignedUserId selector');
  assert.match(modalSource, /\/api\/navigation\/orders\/\$\{orderId\}\/contact/, 'Modal must call contact update API');
  assert.match(modalSource, /Automatická synchronizace s CRM/, 'Modal must inform user about automatic CRM synchronization');
});

test('Navigation order contact API enforces auth, tenant isolation and updates CRM client & order', () => {
  const routeSource = readFileSync(new URL('../app/api/navigation/orders/[id]/contact/route.ts', import.meta.url), 'utf8');

  assert.match(routeSource, /requireApiAccess\('offers', 'navigation'\)/, 'Route must require offers/navigation access');
  assert.match(routeSource, /tx\.client\.update/, 'Route must update client in CRM');
  assert.match(routeSource, /tx\.crmAuditLog\.create/, 'Route must log CRM audit entry');
  assert.match(routeSource, /action:\s*'UPDATE_CONTACT'/, 'Route must record UPDATE_CONTACT action');
  assert.match(routeSource, /getNavigationOrderDetail\(id, user\)/, 'Route must return updated order detail');
});
