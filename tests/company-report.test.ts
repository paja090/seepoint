import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildStaticDataSourceAudit,
  formatCompanyReportCsv,
  normalizeReportPeriod,
  resolveReportPeriod,
  type CompanyExecutiveReport,
} from '@/lib/reports/company-report';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

test('resolveReportPeriod computes exact week, month, quarter, and YTD ranges', () => {
  const ref = new Date('2026-11-22T15:00:00.000Z');

  assert.equal(normalizeReportPeriod('week'), 'week');
  assert.equal(normalizeReportPeriod('quarter'), 'quarter');
  assert.equal(normalizeReportPeriod('year'), 'year');
  assert.equal(normalizeReportPeriod('invalid'), 'month');

  const week = resolveReportPeriod('week', ref);
  assert.equal(week.dateFromIso, '2026-11-16');
  assert.equal(week.dateToIso, '2026-11-22');

  const month = resolveReportPeriod('month', ref);
  assert.equal(month.dateFromIso, '2026-10-24');
  assert.equal(month.dateToIso, '2026-11-22');

  const quarter = resolveReportPeriod('quarter', ref);
  assert.equal(quarter.dateFromIso, '2026-08-25');
  assert.equal(quarter.dateToIso, '2026-11-22');

  const year = resolveReportPeriod('year', ref);
  assert.equal(year.dateFromIso, '2026-01-01');
  assert.equal(year.dateToIso, '2026-11-22');
});

test('buildStaticDataSourceAudit clearly distinguishes AUTO, SEMI_AUTO, and MANUAL sources', () => {
  const auditConnected = buildStaticDataSourceAudit({
    gmailConnected: true,
    hasGooglePlanOrders: true,
    hasInvoices: false,
  });

  const autoRows = auditConnected.filter((r) => r.automation === 'AUTO');
  const semiRows = auditConnected.filter((r) => r.automation === 'SEMI_AUTO');
  const manualRows = auditConnected.filter((r) => r.automation === 'MANUAL');

  assert.ok(autoRows.length >= 4, 'expected at least 4 automated data sources');
  assert.ok(semiRows.length >= 1, 'expected semi-automatic invoicing audit row');
  assert.ok(manualRows.length >= 1, 'expected manual/accounting audit row');

  const gmailRow = auditConnected.find((r) => r.category.includes('Gmail'));
  assert.ok(gmailRow);
  assert.match(gmailRow.currentStatus, /Gmail připojen/);

  const auditDisconnected = buildStaticDataSourceAudit({
    gmailConnected: false,
    hasGooglePlanOrders: false,
    hasInvoices: true,
  });
  const gmailRowOff = auditDisconnected.find((r) => r.category.includes('Gmail'));
  assert.ok(gmailRowOff);
  assert.match(gmailRowOff.currentStatus, /připojit firemní Gmail/);
});

test('formatCompanyReportCsv outputs Czech Excel UTF-8 BOM semicolon-separated CSV with proper escaping', () => {
  const period = resolveReportPeriod('month', new Date('2026-11-22T12:00:00.000Z'));
  const sampleReport: CompanyExecutiveReport = {
    organizationId: 'org-test',
    organizationName: 'SeePoint s.r.o.',
    generatedAt: '2026-11-22T12:00:00.000Z',
    period,
    kpis: {
      workOrdersTotal: 25,
      workOrdersDone: 20,
      workOrdersOpen: 5,
      workOrdersOverdue: 2,
      workOrdersAwaitingInvoice: 3,
      workOrdersTotalPrice: 185000,
      workEntriesHours: 142.5,
      workEntriesLaborCost: 54000,
      offersCreated: 10,
      offersAccepted: 4,
      offersConversionPct: 40,
      offersAcceptedValue: 320000,
      offersPipelineValue: 410000,
      crmOrdersCount: 8,
      crmOrdersValue: 490000,
      crmOrdersViaAgencyCount: 3,
      invoicesIssuedCount: 0,
      invoicesIssuedTotal: 0,
      inboxTotalRelevant: 34,
      inboxNewInquiries: 9,
      inboxComplaints: 1,
      inboxPendingReview: 4,
      gmailConnected: true,
      surfacesTotal: 120,
      surfacesOccupied: 90,
      surfaceOccupancyPct: 75,
      knownMonthlyRent: 280000,
      expirationsTotal30d: 6,
      expirationsCritical: 2,
    },
    summaryTable: [
      {
        area: 'Obchod & CRM',
        metric: 'CRM zakázky',
        valueDisplay: '8 zakázek; 490 000 Kč',
        numericValue: 490000,
        detail: 'Z toho 3 přes "agenturu"',
        source: 'CRM + Google Sales',
        automation: 'AUTO',
      },
    ],
    workByType: [
      { workType: 'INSTALLATION', label: 'Montáž', total: 15, done: 12, overdue: 1, totalPrice: 120000 },
    ],
    topClients: [
      { clientName: 'Kofola a.s.', agencyName: 'Knowlimits', ordersCount: 3, totalValue: 210000, source: 'CRM' },
    ],
    inboxByCategory: [
      { classification: 'NEW_INQUIRY', label: 'Nové poptávky', count: 9, pendingReview: 2 },
    ],
    dataSourceAudit: buildStaticDataSourceAudit({
      gmailConnected: true,
      hasGooglePlanOrders: true,
      hasInvoices: false,
    }),
  };

  const csv = formatCompanyReportCsv(sampleReport);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM for Czech Excel');
  assert.match(csv, /FIREMNÍ REPORT;SeePoint s\.r\.o\./);
  assert.match(csv, /"8 zakázek; 490 000 Kč"/);
  assert.match(csv, /"Z toho 3 přes ""agenturu"""/);
  assert.match(csv, /Kofola a\.s\.;Knowlimits;3;210000;CRM/);
  assert.match(csv, /5\. PŘEHLED ZDROJŮ DAT/);
});

test('Contract checks: /reports route, API, navigation, and organization module registration exist', () => {
  const navSrc = read('lib/navigation.ts');
  assert.match(navSrc, /\["\/reports","Firemní reporty"/);

  const modSrc = read('lib/organization-modules.ts');
  assert.match(modSrc, /routes:\s*\['\/analytics',\s*'\/reports'\]/);

  const apiSrc = read('app/api/reports/company/route.ts');
  assert.match(apiSrc, /requireApiAccess\('clients', 'analytics'\)/);
  assert.match(apiSrc, /formatCompanyReportCsv/);

  const pageSrc = read('app/reports/page.tsx');
  assert.match(pageSrc, /requirePageAccess\('clients', 'analytics'\)/);
  assert.match(pageSrc, /buildCompanyExecutiveReport/);
});
