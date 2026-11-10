/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseCsvRows,
  parseDateString,
  parseQuantity,
  parseWorkType,
  parsePriority,
  parseMediaLabel,
  parseContactDetails,
  parseWorkersList,
  parseGooglePlanCsv,
  syncGooglePlanToWorkOrders,
  isSeePointOrganization,
} from '../lib/work/google-sheets-sync.ts';

test('Google Sheets Sync: parseCsvRows handles commas and newlines in quoted cells', () => {
  const csv = [
    'Header 1,Header 2,Header 3',
    'Value 1,"Value 2, with comma",Value 3',
    'Value 4,"Value 5\nwith newline and ""quotes""",Value 6',
  ].join('\n');

  const rows = parseCsvRows(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][1], 'Value 2, with comma');
  assert.equal(rows[2][1], 'Value 5\nwith newline and "quotes"');
});

test('Google Sheets Sync: parseDateString correctly handles short and full Czech dates', () => {
  const d1 = parseDateString('4.1.', 2026);
  assert.ok(d1);
  assert.equal(d1.getUTCFullYear(), 2026);
  assert.equal(d1.getUTCMonth(), 0); // January
  assert.equal(d1.getUTCDate(), 4);

  const d2 = parseDateString('10.11.', 2026);
  assert.ok(d2);
  assert.equal(d2.getUTCFullYear(), 2026);
  assert.equal(d2.getUTCMonth(), 10); // November
  assert.equal(d2.getUTCDate(), 10);

  const d3 = parseDateString('15.4.2026');
  assert.ok(d3);
  assert.equal(d3.getUTCFullYear(), 2026);
  assert.equal(d3.getUTCMonth(), 3); // April
  assert.equal(d3.getUTCDate(), 15);

  assert.equal(parseDateString(''), null);
  assert.equal(parseDateString('invalid'), null);
});

test('Google Sheets Sync: parseQuantity correctly parses complex quantity strings', () => {
  assert.equal(parseQuantity('6'), 6);
  assert.equal(parseQuantity('12+12'), 24);
  assert.equal(parseQuantity('5 plachet'), 5);
  assert.equal(parseQuantity('2/2'), 2);
  assert.equal(parseQuantity(''), null);
  assert.equal(parseQuantity(null), null);
});

test('Google Sheets Sync: parseWorkType identifies correct work category', () => {
  assert.equal(parseWorkType('deinstalace', 'Deinstalace 6 ks MT'), 'DEINSTALLATION');
  assert.equal(parseWorkType('instalace', 'Instalace polepu'), 'INSTALLATION');
  assert.equal(parseWorkType('reinstalace', 'CP reinstalace 4 ks'), 'REINSTALLATION');
  assert.equal(parseWorkType('výměna', 'výměna bannerů'), 'REINSTALLATION');
  assert.equal(parseWorkType('převoz', 'převoz ze skladu'), 'TRANSPORT');
  assert.equal(parseWorkType('oprava', 'Oprava toweru'), 'REPAIR');
  assert.equal(parseWorkType('kontrola', 'kontrola všech towerů'), 'CHECK');
  assert.equal(parseWorkType('', 'Zajet pro bedýnky'), 'OTHER');
});

test('Google Sheets Sync: parsePriority detects urgent cues in zadani', () => {
  assert.equal(parsePriority('Běžná výměna lavičky'), 'NORMAL');
  assert.equal(parsePriority('RÁNO instalace Masarykovo náměstí !!!'), 'HIGH');
  assert.equal(parsePriority('POZOR: schody, musí být 2 lidi'), 'HIGH');
});

test('Google Sheets Sync: parseMediaLabel translates shorthand codes to clear labels', () => {
  assert.equal(parseMediaLabel('MT'), 'MiniTower (MT)');
  assert.equal(parseMediaLabel('Nav'), 'Navigace & Směrovky (Nav)');
  assert.equal(parseMediaLabel('PL'), 'Promo Lavička (PL)');
  assert.equal(parseMediaLabel('CP'), 'City Poster (CP)');
  assert.equal(parseMediaLabel('CG'), 'City Gallery (CG)');
  assert.equal(parseMediaLabel('BLB'), 'Billboard (BLB)');
  assert.equal(parseMediaLabel('PH'), 'Promohorizont (PH)');
  assert.equal(parseMediaLabel('T'), 'Tower (T)');
});

test('Google Sheets Sync: parseContactDetails extracts name and telephone numbers', () => {
  const c1 = parseContactDetails('p. Pavlíková 737043230');
  assert.equal(c1.phone, '737043230');
  assert.equal(c1.name, 'p. Pavlíková');

  const c2 = parseContactDetails('Dita Zvalená 604 228 547');
  assert.equal(c2.phone, '604 228 547');
  assert.equal(c2.name, 'Dita Zvalená');
});

test('Google Sheets Sync: parseWorkersList splits and normalizes multiple worker names', () => {
  const w1 = parseWorkersList('Mirek, Marek, Karel');
  assert.deepEqual(w1, ['Mirek', 'Marek', 'Karel']);

  const w2 = parseWorkersList('Sonik, ONDRA  Krašik');
  assert.deepEqual(w2, ['Sonik', 'Ondra Krašik']);
});

test('Google Sheets Sync: parseGooglePlanCsv parses real sample rows correctly and skips month separators', () => {
  const sampleCsv = [
    'FTD odeslána,FAKT,Datum,Den,Zadal,Pracovník dílna,Předáno klukům,Klient,Zadání,Kontakt na klienta/ osobu na místě,Datum zahájení,Datum ukončení,Typ nosiče,KS,Práce,Odkaz,Odkaz na FTD',
    'BEZ,BEZ,,sobota,,Vlaďka,FALSE,,L  E  D  E  N,,,,,,,,',
    'ANO,BEZ,4.1.,neděle,V,Pavel,FALSE,Promed optic,Deinstalace 1 ks - Hlavní třída - Poruba,,4.1.2026,4.1.2026,Nav,1,deinstalace,,04 01 Promed optic',
    ',,10.11.,úterý,M,Sonik,FALSE,OVA JIH,Deinstalace 6 ks MT Ova Jih,,9.11.2026,9.11.2026,MT,6,deinstalace,23 10 Ova Jih,',
    'ANO,ANO,10.11.,úterý,V,Sonik,TRUE,DPO,"Deinstalace 3 ks MT https://maps.google.com",,10.11.2026,10.11.2026,MT,3,deinstalace,,10 11 DPO',
  ].join('\n');

  const tasks = parseGooglePlanCsv(sampleCsv, 2026);
  assert.equal(tasks.length, 3); // skips "L E D E N" row

  // First task (Promed optic)
  assert.equal(tasks[0].clientName, 'Promed optic');
  assert.equal(tasks[0].isFtdSent, true);
  assert.equal(tasks[0].status, 'DONE');
  assert.equal(tasks[0].quantity, 1);
  assert.equal(tasks[0].workType, 'DEINSTALLATION');
  assert.deepEqual(tasks[0].workers, ['Pavel']);

  // Second task (OVA JIH)
  assert.equal(tasks[1].clientName, 'OVA JIH');
  assert.equal(tasks[1].quantity, 6);
  assert.equal(tasks[1].isFtdSent, false);
  assert.equal(tasks[1].isHandedOver, false);
  assert.equal(tasks[1].status, 'PLANNED');
  assert.equal(tasks[1].mediaLabel, 'MiniTower (MT)');
  assert.deepEqual(tasks[1].workers, ['Sonik']);

  // Third task (DPO)
  assert.equal(tasks[2].clientName, 'DPO');
  assert.equal(tasks[2].quantity, 3);
  assert.equal(tasks[2].isHandedOver, true);
  assert.equal(tasks[2].isInvoiced, true);
  assert.equal(tasks[2].isFtdSent, true);
  assert.equal(tasks[2].status, 'DONE');
});

test('Google Sheets Sync: syncGooglePlanToWorkOrders creates new orders and updates on subsequent runs (idempotency)', async () => {
  const sampleCsv = [
    'FTD odeslána,FAKT,Datum,Den,Zadal,Pracovník dílna,Předáno klukům,Klient,Zadání,Kontakt na klienta/ osobu na místě,Datum zahájení,Datum ukončení,Typ nosiče,KS,Práce,Odkaz,Odkaz na FTD',
    ',,10.11.,úterý,M,Sonik,FALSE,OVA JIH,Deinstalace 6 ks MT Ova Jih,,9.11.2026,9.11.2026,MT,6,deinstalace,23 10 Ova Jih,',
  ].join('\n');

  const mockDbOrders: any[] = [];
  const mockDbAssignments: any[] = [];

  const mockTx = {
    workOrder: {
      findMany: async () => mockDbOrders,
      findUnique: async ({ where }: any) => {
        const order = mockDbOrders.find((o) => o.id === where.id);
        if (!order) return null;
        return {
          ...order,
          assignments: mockDbAssignments.filter((a) => a.workOrderId === order.id),
          items: [],
        };
      },
      create: async ({ data }: any) => {
        const id = `order-${mockDbOrders.length + 1}`;
        const newOrder = {
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        mockDbOrders.push(newOrder);
        if (data.assignments?.create) {
          for (const a of data.assignments.create) {
            mockDbAssignments.push({
              id: `assign-${mockDbAssignments.length + 1}`,
              workOrderId: id,
              ...a,
            });
          }
        }
        return newOrder;
      },
      update: async ({ where, data }: any) => {
        const idx = mockDbOrders.findIndex((o) => o.id === where.id);
        if (idx !== -1) {
          mockDbOrders[idx] = { ...mockDbOrders[idx], ...data, updatedAt: new Date() };
          return mockDbOrders[idx];
        }
        return null;
      },
    },
    workAssignment: {
      deleteMany: async ({ where }: any) => {
        const len = mockDbAssignments.length;
        for (let i = len - 1; i >= 0; i--) {
          if (mockDbAssignments[i].workOrderId === where.workOrderId) {
            mockDbAssignments.splice(i, 1);
          }
        }
      },
      createMany: async ({ data }: any) => {
        for (const item of data) {
          mockDbAssignments.push({ id: `assign-${mockDbAssignments.length + 1}`, ...item });
        }
      },
    },
    workTask: {
      findMany: async () => [],
      create: async () => ({ id: 'mock-task-1' }),
      update: async () => ({ id: 'mock-task-1' }),
      delete: async () => {},
    },
    employee: {
      findMany: async () => [
        { id: 'emp-sonik', firstName: 'Sonik', lastName: 'Montér', isActive: true },
      ],
      findFirst: async () => null,
    },
  };

  // 1. First run creates 1 new order
  const result1 = await syncGooglePlanToWorkOrders(
    {
      organizationId: 'org-test-1',
      csvContent: sampleCsv,
      defaultYear: 2026,
    },
    { tx: mockTx as any }
  );

  assert.equal(result1.createdCount, 1);
  assert.equal(result1.updatedCount, 0);
  assert.equal(mockDbOrders.length, 1);
  assert.equal(mockDbOrders[0].clientName, 'OVA JIH');
  assert.equal(mockDbOrders[0].status, 'PLANNED');

  // 2. Second run with updated FTD odeslána = ANO (should update existing, not duplicate!)
  const updatedCsv = [
    'FTD odeslána,FAKT,Datum,Den,Zadal,Pracovník dílna,Předáno klukům,Klient,Zadání,Kontakt na klienta/ osobu na místě,Datum zahájení,Datum ukončení,Typ nosiče,KS,Práce,Odkaz,Odkaz na FTD',
    'ANO,ANO,10.11.,úterý,M,Sonik,TRUE,OVA JIH,Deinstalace 6 ks MT Ova Jih,,9.11.2026,9.11.2026,MT,6,deinstalace,23 10 Ova Jih,',
  ].join('\n');

  const result2 = await syncGooglePlanToWorkOrders(
    {
      organizationId: 'org-test-1',
      csvContent: updatedCsv,
      defaultYear: 2026,
    },
    { tx: mockTx as any }
  );

  assert.equal(result2.createdCount, 0);
  assert.equal(result2.updatedCount, 1);
  assert.equal(mockDbOrders.length, 1); // No duplicates!
  assert.equal(mockDbOrders[0].ftdSent, true);
  assert.equal(mockDbOrders[0].status, 'DONE');
});

test('Google Sheets Sync: isSeePointOrganization accurately distinguishes SeePoint from other tenants', () => {
  assert.equal(isSeePointOrganization({ id: 'org_seepoint_default', name: 'SeePoint', slug: 'seepoint' }), true);
  assert.equal(isSeePointOrganization({ id: 'custom_id_1', name: 'SeePOINT s.r.o.', slug: 'sp-main' }), true);
  assert.equal(isSeePointOrganization({ id: 'custom_id_2', name: 'Agentura XYZ', slug: 'seepoint' }), true);

  assert.equal(isSeePointOrganization({ id: 'cmui330fi0005l404dx9noytp', name: 'QX promotion', slug: 'qx-promotion' }), false);
  assert.equal(isSeePointOrganization({ id: 'cmt5os0640005jh0447xjz86r', name: 'Agentura B – izolace', slug: 'agentura-b-test' }), false);
  assert.equal(isSeePointOrganization(null), false);
  assert.equal(isSeePointOrganization(undefined), false);
});

test('Google Sheets Sync: syncGooglePlanToWorkOrders rejects non-SeePoint agency when syncing default sheet', async () => {
  const mockTx = {
    organization: {
      findUnique: async () => ({
        id: 'org-qx-promo',
        name: 'QX promotion',
        slug: 'qx-promotion',
      }),
    },
    workOrder: {
      findMany: async () => [],
    },
  };

  await assert.rejects(
    async () => {
      await syncGooglePlanToWorkOrders(
        {
          organizationId: 'org-qx-promo',
          csvContent: 'FTD odeslána,FAKT,Datum,Den,Zadal,Pracovník dílna,Předáno klukům,Klient,Zadání,Kontakt na klienta/ osobu na místě,Datum zahájení,Datum ukončení,Typ nosiče,KS,Práce,Odkaz,Odkaz na FTD\n,,10.11.,úterý,M,Sonik,FALSE,OVA JIH,Test zadání,,,,,,,,',
        },
        { tx: mockTx as any }
      );
    },
    {
      message: 'Tato centrální Google Tabulka plánu práce je určena výhradně pro agenturu SeePOINT s.r.o. a nelze ji importovat do jiné agentury.',
    }
  );
});
