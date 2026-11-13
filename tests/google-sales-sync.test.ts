import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KNOWN_SALESPEOPLE,
  resolveSalesProjectType,
  parseCampaignDates,
  parseContactDetails,
  parseGoogleSalesSheetCsv,
  syncGoogleSalesToCrm,
} from '../lib/sales/google-sales-sync';

test('KNOWN_SALESPEOPLE recognizes all key SeePoint salespeople codes', () => {
  assert.equal(KNOWN_SALESPEOPLE['mm'].name, 'Miroslav Mec');
  assert.equal(KNOWN_SALESPEOPLE['m'].name, 'Marek Konečný');
  assert.equal(KNOWN_SALESPEOPLE['mk'].name, 'Marek Konečný');
  assert.equal(KNOWN_SALESPEOPLE['v'].name, 'Vladimíra Konečná');
  assert.equal(KNOWN_SALESPEOPLE['vk'].name, 'Vladimíra Konečná');
  assert.equal(KNOWN_SALESPEOPLE['z'].name, 'Zuzana Vavrečková');
  assert.equal(KNOWN_SALESPEOPLE['zv'].name, 'Zuzana Vavrečková');
  assert.equal(KNOWN_SALESPEOPLE['s'].name, 'Silva');
  assert.equal(KNOWN_SALESPEOPLE['silva'].name, 'Silva');
  assert.equal(KNOWN_SALESPEOPLE['lv'].name, 'Lenka Valíčková');
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

  // Row 2: MK - Auto Esa (instalace=true, nahranaFtd=true)
  assert.equal(rows[1].salespersonCode, 'MK');
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

test('syncGoogleSalesToCrm creates clients and CRM orders idempotently', async () => {
  const mockOrg = { id: 'org_123', name: 'SeePOINT s.r.o.', slug: 'seepoint' };
  const mockUser = { id: 'usr_mirek', name: 'Miroslav Mec', email: 'mirek.mec@seepoint.cz' };

  const existingClients: any[] = [];
  const existingOrders: any[] = [];

  const mockClient: any = {
    organization: {
      findUnique: async () => mockOrg,
      update: async () => mockOrg,
    },
    user: {
      findMany: async () => [mockUser],
    },
    client: {
      findFirst: async ({ where }: any) => {
        return (
          existingClients.find(
            (c) => c.organizationId === where.organizationId && c.normalizedName === where.normalizedName
          ) || null
        );
      },
      create: async ({ data }: any) => {
        const row = { id: `cli_${existingClients.length + 1}`, ...data };
        existingClients.push(row);
        return row;
      },
    },
    clientContact: {
      findFirst: async () => null,
      create: async ({ data }: any) => ({ id: 'cont_1', ...data }),
    },
    crmOrder: {
      findFirst: async ({ where }: any) => {
        if (where.clientOrderCode) {
          return (
            existingOrders.find(
              (o) => o.organizationId === where.organizationId && o.clientOrderCode === where.clientOrderCode
            ) || null
          );
        }
        return null;
      },
      create: async ({ data }: any) => {
        const row = { id: `ord_${existingOrders.length + 1}`, ...data };
        existingOrders.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const idx = existingOrders.findIndex((o) => o.id === where.id);
        if (idx !== -1) {
          existingOrders[idx] = { ...existingOrders[idx], ...data };
          return existingOrders[idx];
        }
        return data;
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
    { tx: mockClient }
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
    { tx: mockClient }
  );

  assert.equal(result2.success, true);
  assert.equal(result2.createdOrdersCount, 0);
  assert.equal(result2.skippedOrdersCount, 1);
});
