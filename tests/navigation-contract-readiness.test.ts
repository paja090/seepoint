import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canAccess } from '../lib/rbac.ts';
import {
  NavigationContractValidationError,
  deriveNavigationContractDisplay,
  parseNavigationContactInput,
  parseNavigationContractFilters,
  parseNavigationContractInput,
} from '../lib/navigation/contract-policy.ts';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const validContract = {
  contractNumber: ' NAV-2026-001 ', contractType: 'RENTAL', clientId: 'client-1',
  startDate: '2026-08-01', endDate: '2027-08-01', monthlyPrice: '1500.50',
  totalPrice: 18_006, status: 'ACTIVE', autoRenews: false, alertDaysBefore: 0,
};

test('contract input normalizes data and preserves a zero-day alert', () => {
  const parsed = parseNavigationContractInput(validContract);
  assert.equal(parsed.contractNumber, 'NAV-2026-001');
  assert.equal(parsed.monthlyPrice, 1500.5);
  assert.equal(parsed.alertDaysBefore, 0);
  assert.throws(() => parseNavigationContractInput({ ...validContract, contractType: 'HACKED' }), NavigationContractValidationError);
  assert.throws(() => parseNavigationContractInput({ ...validContract, endDate: '2026-07-31' }), /před datem začátku/);
  assert.throws(() => parseNavigationContractInput({ ...validContract, startDate: '2026-02-30' }), /platné kalendářní datum/);
  assert.throws(() => parseNavigationContractInput({ ...validContract, monthlyPrice: -1 }), NavigationContractValidationError);
});

test('contact input validates enums, e-mail, phone and lengths', () => {
  const contact = parseNavigationContactInput({ clientId: 'client-1', contactType: 'AGENCY', name: ' Eva Nová ', email: 'EVA@EXAMPLE.CZ', phone: '+420 777 111 222' });
  assert.equal(contact.name, 'Eva Nová');
  assert.equal(contact.email, 'eva@example.cz');
  assert.throws(() => parseNavigationContactInput({ clientId: 'client-1', contactType: 'UNKNOWN', name: 'Eva' }), NavigationContractValidationError);
  assert.throws(() => parseNavigationContactInput({ clientId: 'client-1', name: 'Eva', email: 'neplatny-mail' }), /platný formát/);
});

test('display state respects explicit draft and terminated states before dates', () => {
  const now = new Date('2026-08-30T12:00:00.000Z');
  assert.equal(deriveNavigationContractDisplay('TERMINATED', '2026-01-01', '2030-01-01', 30, now).code, 'TERMINATED');
  assert.equal(deriveNavigationContractDisplay('DRAFT', '2026-01-01', '2026-01-02', 30, now).code, 'DRAFT');
  assert.equal(deriveNavigationContractDisplay('ACTIVE', '2026-01-01', '2026-08-30', 0, now).code, 'EXPIRING');
  assert.equal(deriveNavigationContractDisplay('ACTIVE', '2027-01-01', '2028-01-01', 30, now).code, 'UPCOMING');
});

test('list filters are bounded and reject invalid statuses', () => {
  assert.deepEqual(parseNavigationContractFilters(new URLSearchParams('take=25&skip=10&status=ACTIVE')).take, 25);
  assert.throws(() => parseNavigationContractFilters(new URLSearchParams('take=201')), NavigationContractValidationError);
  assert.throws(() => parseNavigationContractFilters(new URLSearchParams('status=UNKNOWN')), NavigationContractValidationError);
});

test('contracts and contacts use dedicated permissions excluded from field roles', () => {
  assert.equal(canAccess('ADMIN', 'navigationContracts'), true);
  assert.equal(canAccess('SALES', 'navigationContacts'), true);
  assert.equal(canAccess('TECHNICIAN', 'navigationContracts'), false);
  assert.equal(canAccess('WORKER', 'navigationContacts'), false);
  for (const path of [
    'app/api/navigation/contracts/route.ts', 'app/api/navigation/contracts/[id]/route.ts', 'app/navigation/contracts/page.tsx',
  ]) assert.match(source(path), /navigationContracts/);
  for (const path of [
    'app/api/navigation/contacts/route.ts', 'app/api/navigation/contacts/[id]/route.ts', 'app/navigation/contacts/page.tsx',
  ]) assert.match(source(path), /navigationContacts/);
});

test('mutations enforce tenant-bound links, serialize primary contact changes and create audit logs', () => {
  const service = source('lib/navigation/contract-service.ts');
  assert.match(service, /id: data\.clientId, organizationId, active: true/);
  assert.match(service, /id: data\.offerId, organizationId/);
  assert.match(service, /offer\.clientId !== data\.clientId/);
  assert.match(service, /order\.crmOrder\.clientId !== data\.clientId/);
  assert.match(service, /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(service, /isPrimary: false/);
  assert.match(service, /crmAuditLog\.create/);
});

test('contact form sends e-mail and both modules support non-destructive editing', () => {
  const contactView = source('components/navigation/ContactPersonsManagementView.tsx');
  const contractView = source('components/navigation/ContractManagementView.tsx');
  assert.match(contactView, /role, phone, email, isPrimary/);
  assert.match(contactView, /method: editingId \? 'PATCH' : 'POST'/);
  assert.match(contractView, /method: editingId \? 'PATCH' : 'POST'/);
  assert.match(contractView, /deriveNavigationContractDisplay/);
  assert.doesNotMatch(contactView, /method: 'DELETE'/);
  assert.doesNotMatch(contractView, /method: 'DELETE'/);
});
