import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CrmClientValidationError,
  parseBranchInput,
  parseClientInput,
  parseClientListQuery,
  parseContactInput,
} from '../lib/crm/client-policy.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('CRM client input normalizes safe values and rejects invalid contact data', () => {
  const client = parseClientInput({
    name: '  Testovací   klient s.r.o. ',
    email: ' OBCHOD@EXAMPLE.CZ ',
    website: 'https://example.cz/kontakt',
    billingCountry: 'cz',
  });
  assert.equal(client.name, 'Testovací klient s.r.o.');
  assert.equal(client.email, 'obchod@example.cz');
  assert.equal(client.billingCountry, 'CZ');
  assert.throws(() => parseClientInput({ name: 'X', email: 'neplatny-email' }), CrmClientValidationError);
  assert.throws(() => parseClientInput({ name: 'X', website: 'javascript:alert(1)' }), CrmClientValidationError);
});

test('CRM contacts and branches enforce lengths, email and complete GPS pairs', () => {
  const contact = parseContactInput({ firstName: 'Jan', lastName: 'Novák', email: 'JAN@EXAMPLE.CZ', isPrimary: true });
  assert.equal(contact.email, 'jan@example.cz');
  assert.equal(contact.isPrimary, true);
  assert.throws(() => parseContactInput({ firstName: 'Jan', lastName: 'Novák', email: 'x' }), CrmClientValidationError);
  assert.throws(() => parseBranchInput({ name: 'Ostrava', latitude: 49.82 }), /šířku i délku/);
  assert.throws(() => parseBranchInput({ name: 'Ostrava', latitude: 95, longitude: 18.2 }), /šířka/);
  assert.deepEqual(parseBranchInput({ name: 'Ostrava', latitude: 49.82, longitude: 18.26 }).latitude, 49.82);
});

test('CRM client list query is bounded and validates enum filters', () => {
  const parsed = parseClientListQuery(new URLSearchParams('q=test&page=2&pageSize=50&status=ACTIVE'));
  assert.deepEqual({ page: parsed.page, pageSize: parsed.pageSize, status: parsed.status }, { page: 2, pageSize: 50, status: 'ACTIVE' });
  assert.throws(() => parseClientListQuery(new URLSearchParams('pageSize=1000')), CrmClientValidationError);
  assert.throws(() => parseClientListQuery(new URLSearchParams('status=HACKED')), CrmClientValidationError);
});

test('CRM update keeps normalized name, assignee tenant check and audit in one transaction', () => {
  const route = read('app/api/crm/clients/[id]/route.ts');
  assert.match(route, /normalizedName: normalizeClientName\(nextName\)/);
  assert.match(route, /organizationMember\.count/);
  assert.match(route, /UPDATE_CLIENT/);
  assert.match(route, /TransactionIsolationLevel\.Serializable/);
  assert.match(route, /Trvalé mazání klientů není přes API povoleno/);
  assert.match(route, /\['ADMIN', 'MANAGER'\]\.includes\(auth\.role\)/);
});

test('CRM merge moves every client-linked module and serializes concurrent merges', () => {
  const merge = read('lib/crm/merge-service.ts');
  for (const model of [
    'clientContact', 'clientBranch', 'offer', 'crmOrder', 'occupancy', 'advertisingSurface',
    'workOrder', 'workEntry', 'clientContract', 'clientInvoice', 'clientCommunication',
    'crmTask', 'clientDocument', 'navigationDocumentationReport', 'navigationContract',
    'navigationContactPerson', 'salesOpportunity', 'carrierHistoryLog',
  ]) assert.match(merge, new RegExp(`tx\\.${model}\\.updateMany`), model);
  assert.match(merge, /TransactionIsolationLevel\.Serializable/);
  assert.match(merge, /sourcePrimaryContacts/);
  assert.match(merge, /where: \{ id: sourceClientId, active: true \}/);
});

test('CRM AI lookup is authorized, rate-limited and advisory only', () => {
  const route = read('app/api/crm/clients/[id]/ai-enrich/route.ts');
  const lookup = read('app/api/crm/clients/ai-lookup/route.ts');
  const ui = read('components/clients/ClientAiEnrichCard.tsx');
  const overview = read('components/crm/ClientOverviewTab.tsx');
  for (const source of [route, lookup]) {
    assert.match(source, /requireApiAccess\('clients'\)/);
    assert.match(source, /rateLimitPolicies\.crmAi/);
    assert.match(source, /AbortSignal\.timeout/);
  }
  assert.doesNotMatch(route, /prisma\.client(Contact|Branch)\.(create|update)/);
  assert.doesNotMatch(route, /prisma\.client\.update/);
  assert.match(route, /organizationId: actor\.organizationId, active: true/);
  assert.match(ui, /Do CRM nebylo nic automaticky uloženo/);
  assert.match(ui, /NÁVRH – NEULOŽENO/);
  assert.match(ui, /NÁVRH K RUČNÍMU OVĚŘENÍ/);
  assert.doesNotMatch(ui, /100% Právní Pravdivost/);
  assert.doesNotMatch(ui, /router\.refresh/);
  assert.match(overview, /NEOVĚŘENÝ HISTORICKÝ NÁVRH/);
  assert.match(overview, /Nové AI návrhy se\s+už do CRM automaticky neukládají/);
  assert.doesNotMatch(overview, />\s*ULOŽENO V CRM\s*</);
});

test('CRM list and active profile relations are bounded', () => {
  const page = read('app/clients/page.tsx');
  const service = read('lib/crm/client-service.ts');
  assert.match(page, /take: pageSize/);
  assert.match(page, /prisma\.client\.count/);
  assert.match(service, /contacts: \{ where: \{ active: true \}/);
  assert.match(service, /branches: \{ where: \{ active: true \}/);
});

test('CRM contact and branch UI describes soft deletion as archiving', () => {
  const contacts = read('components/crm/ClientContactsTab.tsx');
  const branches = read('components/crm/ClientBranchesTab.tsx');
  for (const source of [contacts, branches]) {
    assert.match(source, /Archivovat/);
    assert.match(source, /historie zůstane zachována/);
    assert.doesNotMatch(source, />Smazat</);
  }
});
