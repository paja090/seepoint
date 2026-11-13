import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import {
  CANONICAL_SALESPEOPLE,
  KNOWN_SALESPEOPLE,
  resolveCanonicalSalesperson,
  resolveSalesProjectType,
  parseCampaignDates,
  parseContactDetails,
  parseGoogleSalesSheetCsv,
  syncGoogleSalesToCrm,
  getGoogleSalesSheetSummary,
} from '../lib/sales/google-sales-sync';
import { sanitizeOwnerEmailDigestSettings } from '../lib/planner/owner-reports';

test('CANONICAL_SALESPEOPLE and KNOWN_SALESPEOPLE correctly unify SeePoint salespeople without duplicates', () => {
  assert.equal(CANONICAL_SALESPEOPLE.length, 5);
  const codes = CANONICAL_SALESPEOPLE.map((s) => s.code);
  assert.deepEqual(codes, ['MM', 'M', 'V', 'Z', 'S']);

  assert.equal(KNOWN_SALESPEOPLE['mm'].code, 'MM');
  assert.equal(KNOWN_SALESPEOPLE['m'].code, 'M');
  assert.equal(KNOWN_SALESPEOPLE['mk'].code, 'M'); // Canonical code is M
  assert.equal(KNOWN_SALESPEOPLE['mk'].displayCode, 'M / MK');
  assert.equal(KNOWN_SALESPEOPLE['v'].code, 'V');
  assert.equal(KNOWN_SALESPEOPLE['vk'].code, 'V'); // Canonical code is V
  assert.equal(KNOWN_SALESPEOPLE['vk'].displayCode, 'V / VK');
  assert.equal(KNOWN_SALESPEOPLE['z'].code, 'Z');
  assert.equal(KNOWN_SALESPEOPLE['zv'].code, 'Z'); // Canonical code is Z
  assert.equal(KNOWN_SALESPEOPLE['zv'].displayCode, 'Z / ZV');
  assert.equal(KNOWN_SALESPEOPLE['s'].code, 'S');

  // resolveCanonicalSalesperson maps aliases correctly
  assert.equal(resolveCanonicalSalesperson('MK').code, 'M');
  assert.equal(resolveCanonicalSalesperson('MK').displayCode, 'M / MK');
  assert.equal(resolveCanonicalSalesperson('Marek').code, 'M');
  assert.equal(resolveCanonicalSalesperson('VK').code, 'V');
  assert.equal(resolveCanonicalSalesperson('ZV').code, 'Z');
  assert.equal(resolveCanonicalSalesperson('MM').code, 'MM');
  assert.equal(resolveCanonicalSalesperson('Silva').code, 'S');
});

test('resolveSalesProjectType maps shorthand codes to proper Prisma CrmProjectType and labels', () => {
  assert.deepEqual(resolveSalesProjectType('CP'), {
    projectType: 'CITY_POSTER',
    label: 'City Poster (CP)',
  });

  assert.deepEqual(resolveSalesProjectType('PL'), {
    projectType: 'BENCH',
    label: 'Promo Lavička (PL)',
  });

  assert.deepEqual(resolveSalesProjectType('T'), {
    projectType: 'TOWER',
    label: 'Tower (T)',
  });

  assert.deepEqual(resolveSalesProjectType('MT'), {
    projectType: 'TOWER',
    label: 'MiniTower (MT)',
  });

  assert.deepEqual(resolveSalesProjectType('PH'), {
    projectType: 'HORIZON',
    label: 'Promohorizont (PH)',
  });

  assert.deepEqual(resolveSalesProjectType('CLV'), {
    projectType: 'CLV',
    label: 'Citylight (CLV)',
  });

  assert.deepEqual(resolveSalesProjectType('NAV'), {
    projectType: 'NAVIGATION',
    label: 'Navigace (Nav)',
  });

  assert.deepEqual(resolveSalesProjectType('CG'), {
    projectType: 'CITY_GALLERY',
    label: 'Výstavní projekt (CG)',
  });

  assert.deepEqual(resolveSalesProjectType(null), {
    projectType: 'OTHER',
    label: 'Ostatní media',
  });
});

test('parseCampaignDates handles full Czech dates d.m.yyyy', () => {
  const { dateFrom, dateTo } = parseCampaignDates('1.12.2026', '31.12.2026');
  assert.ok(dateFrom instanceof Date);
  assert.ok(dateTo instanceof Date);
  assert.equal(dateFrom?.toISOString().slice(0, 10), '2026-12-01');
  assert.equal(dateTo?.toISOString().slice(0, 10), '2026-12-31');
});

test('parseCampaignDates handles short dates and wraps year when end month is earlier than start month', () => {
  const { dateFrom, dateTo } = parseCampaignDates('1.12.2026', '28.2.');
  assert.equal(dateFrom?.toISOString().slice(0, 10), '2026-12-01');
  assert.equal(dateTo?.toISOString().slice(0, 10), '2027-02-28');
});

test('parseContactDetails extracts name, email, and phone correctly', () => {
  const details = parseContactDetails('Jan Novák', '+420 777 123 456, jan.novak@firma.cz');
  assert.equal(details.firstName, 'Jan');
  assert.equal(details.lastName, 'Novák');
  assert.equal(details.email, 'jan.novak@firma.cz');
  assert.equal(details.phone, '+420 777 123 456');
});

test('parseGoogleSalesSheetCsv correctly parses rows and skips empty rows', () => {
  const csvSample = `OBDOBÍ,OBCHODNÍK,KLIENT,KONTAKTNÍ OSOBA,KONTAKT NA OSOBU,TYP ZAKÁZKY,POTVRZENÁ KAMPAŇ,OBJEDNÁVKA,TERMÍN KAMPANĚ OD,TERMÍN KAMPANĚ DO,PLÁN PRÁCE,SLOŽKA FTD,GRAFIKA OD KLIENTA,GRAFIKA DO TISKU,VYTIŠTĚNO,INSTALACE,NAHRANÁ FTD,FAKTURACE,ODESL. FTD,ODESL FAKT
leden 2026,MM,Komerční Banka,Petr Svoboda,777888999,CP,TRUE,PŘIJATÁ,1.1.2026,31.1.2026,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,FALSE,FALSE,FALSE,FALSE
únor 2026,MK,Auto Esa,Alena Černá,alena@autoesa.cz,PL,TRUE,OBJ-123,1.2.2026,28.2.2026,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,FALSE,FALSE
březen 2026,V,Lidl ČR,Ing. Novotný,,MT,FALSE,,1.3.2026,31.3.2026,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE
,,,,,,,,,,,,,,,,,,,
`;

  const rows = parseGoogleSalesSheetCsv(csvSample, 2026);
  assert.equal(rows.length, 3);

  // Row 1: MM - Komerční Banka
  assert.equal(rows[0].salespersonCode, 'MM');
  assert.equal(rows[0].salespersonName, 'Miroslav Mec');
  assert.equal(rows[0].clientName, 'Komerční Banka');
  assert.equal(rows[0].carrierTypeRaw, 'CP');
  assert.equal(rows[0].projectType, 'CITY_POSTER');
  assert.equal(rows[0].isCampaignConfirmed, true);
  assert.equal(rows[0].computedStatus, 'READY_FOR_PRODUCTION'); // vytisteno=true, instalace=false

  // Row 2: MK - Auto Esa (instalace=true, nahranaFtd=true) -> canonicalized to M (Marek Konečný)
  assert.equal(rows[1].salespersonCode, 'M');
  assert.equal(rows[1].salespersonName, 'Marek Konečný');
  assert.equal(rows[1].clientName, 'Auto Esa');
  assert.equal(rows[1].computedStatus, 'COMPLETED'); // nahranaFtd=true

  // Row 3: V - Lidl ČR (unconfirmed draft)
  assert.equal(rows[2].salespersonCode, 'V');
  assert.equal(rows[2].salespersonName, 'Vladimíra Konečná');
  assert.equal(rows[2].clientName, 'Lidl ČR');
  assert.equal(rows[2].projectType, 'TOWER');
  assert.equal(rows[2].isCampaignConfirmed, false);
  assert.equal(rows[2].computedStatus, 'DRAFT');
});

type MockClientRow = {
  id: string;
  organizationId: string;
  name: string;
  normalizedName: string;
  [key: string]: unknown;
};

type MockOrderRow = {
  id: string;
  organizationId: string;
  orderNumber: string;
  clientOrderCode?: string | null;
  assignedUserId?: string | null;
  status: string;
  projectType: string;
  title: string;
  internalNote?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  [key: string]: unknown;
};

test('syncGoogleSalesToCrm creates clients and CRM orders idempotently', async () => {
  const mockOrg = { id: 'org_123', name: 'SeePOINT s.r.o.', slug: 'seepoint' };
  const mockUser = { id: 'usr_mirek', name: 'Miroslav Mec', email: 'mirek.mec@seepoint.cz' };

  const existingClients: MockClientRow[] = [];
  const existingOrders: MockOrderRow[] = [];

  const mockClient = {
    organization: {
      findUnique: async () => mockOrg,
      update: async () => mockOrg,
    },
    user: {
      findMany: async () => [mockUser],
    },
    client: {
      findFirst: async ({ where }: { where: { organizationId: string; normalizedName: string } }) => {
        return (
          existingClients.find(
            (c) => c.organizationId === where.organizationId && c.normalizedName === where.normalizedName
          ) || null
        );
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `cli_${existingClients.length + 1}`, ...data } as MockClientRow;
        existingClients.push(row);
        return row;
      },
    },
    clientContact: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'cont_1', ...data }),
    },
    crmOrder: {
      findFirst: async ({ where }: { where: { organizationId: string; clientOrderCode?: string; title?: string } }) => {
        if (where.clientOrderCode) {
          return (
            existingOrders.find(
              (o) => o.organizationId === where.organizationId && o.clientOrderCode === where.clientOrderCode
            ) || null
          );
        }
        return null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `ord_${existingOrders.length + 1}`, ...data } as MockOrderRow;
        existingOrders.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const idx = existingOrders.findIndex((o) => o.id === where.id);
        if (idx !== -1) {
          existingOrders[idx] = { ...existingOrders[idx], ...data };
          return existingOrders[idx];
        }
        return data as MockOrderRow;
      },
    },
  };

  const csvContent = `OBDOBÍ,OBCHODNÍK,KLIENT,KONTAKTNÍ OSOBA,KONTAKT NA OSOBU,TYP ZAKÁZKY,POTVRZENÁ KAMPAŇ,OBJEDNÁVKA,TERMÍN KAMPANĚ OD,TERMÍN KAMPANĚ DO,PLÁN PRÁCE,SLOŽKA FTD,GRAFIKA OD KLIENTA,GRAFIKA DO TISKU,VYTIŠTĚNO,INSTALACE,NAHRANÁ FTD,FAKTURACE,ODESL. FTD,ODESL FAKT
jaro 2026,MM,Test Firma,Jan Novák,777123456,CP,TRUE,PŘIJATÁ,1.4.2026,30.4.2026,TRUE,TRUE,TRUE,TRUE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE
`;

  const result1 = await syncGoogleSalesToCrm(
    {
      organizationId: 'org_123',
      csvContent,
      defaultYear: 2026,
    },
    { tx: mockClient as unknown as Prisma.TransactionClient }
  );

  assert.equal(result1.success, true);
  assert.equal(result1.createdClientsCount, 1);
  assert.equal(result1.createdOrdersCount, 1);
  assert.equal(existingOrders.length, 1);
  assert.equal(existingOrders[0].assignedUserId, 'usr_mirek');

  // Second run with same content -> idempotent skip
  const result2 = await syncGoogleSalesToCrm(
    {
      organizationId: 'org_123',
      csvContent,
      defaultYear: 2026,
    },
    { tx: mockClient as unknown as Prisma.TransactionClient }
  );

  assert.equal(result2.success, true);
  assert.equal(result2.createdOrdersCount, 0);
  assert.equal(result2.skippedOrdersCount, 1);
});

test('getGoogleSalesSheetSummary unifies M and MK under canonical Marek Konečný (M / MK) with only 5 canonical cards', async () => {
  const mockOrders = [
    {
      id: 'ord_1',
      orderNumber: 'ZAK-2026-0001',
      title: 'Kampaň: Test 1',
      status: 'CONFIRMED',
      projectType: 'CITY_POSTER',
      dateFrom: new Date('2026-04-01'),
      dateTo: new Date('2026-04-30'),
      internalNote: JSON.stringify({
        salespersonCode: 'MK',
        salespersonName: 'Marek Konečný',
        carrierTypeLabel: 'City Poster (CP)',
        campaignConfirmed: true,
      }),
      client: { name: 'Klient A' },
      assignedUser: { id: 'usr_marek', name: 'Marek Konečný', email: 'marek.konecny@seepoint.cz' },
    },
    {
      id: 'ord_2',
      orderNumber: 'ZAK-2026-0002',
      title: 'Kampaň: Test 2',
      status: 'DRAFT',
      projectType: 'TOWER',
      dateFrom: new Date('2026-05-01'),
      dateTo: new Date('2026-05-31'),
      internalNote: JSON.stringify({
        salespersonCode: 'M',
        salespersonName: 'Marek Konečný',
        carrierTypeLabel: 'Tower (T)',
        campaignConfirmed: false,
      }),
      client: { name: 'Klient B' },
      assignedUser: { id: 'usr_marek', name: 'Marek Konečný', email: 'marek.konecny@seepoint.cz' },
    },
  ];

  const mockClient = {
    crmOrder: {
      findMany: async () => mockOrders,
    },
  };

  const summary = await getGoogleSalesSheetSummary('org_123', mockClient as unknown as Prisma.TransactionClient);

  // Exactly 5 canonical salespeople initialized
  assert.equal(Object.keys(summary.bySalesperson).length, 5);
  assert.deepEqual(Object.keys(summary.bySalesperson), ['MM', 'M', 'V', 'Z', 'S']);

  // Both orders (MK and M) merged under M
  const marekCard = summary.bySalesperson['M'];
  assert.ok(marekCard);
  assert.equal(marekCard.name, 'Marek Konečný');
  assert.equal(marekCard.displayCode, 'M / MK');
  assert.equal(marekCard.totalOrdersCount, 2);
  assert.equal(marekCard.confirmedCampaignsCount, 1);
  assert.equal(marekCard.pipelineCount, 1);
  assert.equal(marekCard.activeOrders.length, 2);

  // There is NO separate MK card
  assert.equal(summary.bySalesperson['MK'], undefined);
});

test('sanitizeOwnerEmailDigestSettings defaults enabled to true with Marek Konečný recipient for SeePoint', () => {
  // Generic org with no settings -> disabled by default
  const genericSettings = sanitizeOwnerEmailDigestSettings({}, false);
  assert.equal(genericSettings.enabled, false);
  assert.deepEqual(genericSettings.customRecipients, []);

  // SeePoint org with empty defaults -> auto-enabled with marek.konecny@seepoint.cz
  const seepointDefault = sanitizeOwnerEmailDigestSettings({}, true);
  assert.equal(seepointDefault.enabled, true);
  assert.equal(seepointDefault.sendHourLocal, 18);
  assert.equal(seepointDefault.skipWeekends, true);
  assert.equal(seepointDefault.includeAllAdminsAndOwners, true);
  assert.ok(seepointDefault.customRecipients.includes('marek.konecny@seepoint.cz'));

  // SeePoint org with explicit disable -> respects explicit false
  const seepointDisabled = sanitizeOwnerEmailDigestSettings({ enabled: false }, true);
  assert.equal(seepointDisabled.enabled, false);
  assert.ok(seepointDisabled.customRecipients.includes('marek.konecny@seepoint.cz'));
});
