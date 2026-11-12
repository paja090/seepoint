/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
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
  parseGooglePlanXlsx,
  syncGooglePlanToWorkOrders,
  resolveSyncedScheduledAt,
  isSeePointOrganization,
  isGreenRgbHex,
  unwrapExcelValueToString,
  extractExcelCellHyperlink,
} from '../lib/work/google-sheets-sync.ts';
import {
  extractWorkOrderConstraintFlags,
  isOrderDoneWithoutFtdFlag,
  isOrderReadyForInvoicing,
} from '../lib/work.ts';

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
  const w1 = parseWorkersList('MM, Marek, Karel');
  assert.deepEqual(w1, ['Miroslav Mec', 'Marek Konečný', 'Karel']);

  const w2 = parseWorkersList('Sonik, ONDRA  Krašik');
  assert.deepEqual(w2, ['Marek Šlapnička', 'Ondra Krašik']);
});

test('Google Sheets Sync: parseGooglePlanCsv parses real sample rows correctly and skips month separators', () => {
  const sampleCsv = [
    'FTD odeslána,FAKT,Datum,Den,Zadal,Pracovník dílna,Předáno klukům,Klient,Zadání,Kontakt na klienta/ osobu na místě,Datum zahájení,Datum ukončení,Typ nosiče,KS,Práce,Odkaz,Odkaz na FTD',
    'BEZ,BEZ,,sobota,,Vlaďka,FALSE,,L  E  D  E  N,,,,,,,,',
    'ANO,BEZ,4.1.,neděle,V,Pavel,FALSE,Promed optic,Deinstalace 1 ks - Hlavní třída - Poruba,,4.1.2026,4.1.2026,Nav,1,deinstalace,,04 01 Promed optic',
    ',,10.11.,úterý,MM,Sonik,FALSE,OVA JIH,Deinstalace 6 ks MT Ova Jih,,9.11.2026,9.11.2026,MT,6,deinstalace,23 10 Ova Jih,',
    'ANO,ANO,10.11.,úterý,V,Sonik,TRUE,DPO,"Deinstalace 3 ks MT https://maps.google.com",,10.11.2026,10.11.2026,MT,3,deinstalace,,10 11 DPO',
  ].join('\n');

  const tasks = parseGooglePlanCsv(sampleCsv, 2026, new Date(Date.UTC(2026, 10, 10, 0, 0, 0)));
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
  assert.equal(tasks[1].requestedBy, 'Miroslav Mec');
  assert.equal(tasks[1].quantity, 6);
  assert.equal(tasks[1].isFtdSent, false);
  assert.equal(tasks[1].isHandedOver, false);
  assert.equal(tasks[1].status, 'PLANNED');
  assert.equal(tasks[1].mediaLabel, 'MiniTower (MT)');
  assert.deepEqual(tasks[1].workers, ['Marek Šlapnička']);

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
      referenceDate: new Date(Date.UTC(2026, 10, 10, 0, 0, 0)),
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
      referenceDate: new Date(Date.UTC(2026, 10, 10, 0, 0, 0)),
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

test('Google Sheets Sync: keeps future invoiced tasks open (PLANNED/HANDED_OVER) while closing past tasks', () => {
  const sampleCsv = [
    'FTD odeslána,FAKT,Datum,Den,Zadal,Pracovník dílna,Předáno klukům,Klient,Zadání,Kontakt na klienta/ osobu na místě,Datum zahájení,Datum ukončení,Typ nosiče,KS,Práce,Odkaz,Odkaz na FTD',
    'BEZ,BEZ,15.1.,středa,V,Pavel,TRUE,Minulý klient,Oprava nosiče v lednu,,15.1.2026,15.1.2026,CG,1,oprava,,',
    'BEZ,BEZ,15.1.,středa,V,Pavel,FALSE,Starý nezaškrtnutý,Starý úkol bez předání,,15.1.2026,15.1.2026,CG,1,oprava,,',
    ',ANO,20.11.,pátek,M,Sonik,FALSE,Budoucí vyfakturovaný,Už vyfakturováno dopředu,,20.11.2026,20.11.2026,MT,2,montáž,,',
    ',,20.11.,pátek,M,Sonik,TRUE,Budoucí předaný,Předáno posádce na příští týden,,20.11.2026,20.11.2026,MT,2,montáž,,',
    ',,20.11.,pátek,M,Sonik,FALSE,Budoucí otevřený,Plánovaný úkol na příští týden,,20.11.2026,20.11.2026,MT,2,montáž,,',
  ].join('\n');

  // Reference date: 10.11.2026
  const tasks = parseGooglePlanCsv(sampleCsv, 2026, new Date(Date.UTC(2026, 10, 10, 0, 0, 0)));
  assert.equal(tasks.length, 5);

  // 1. Past task (15.1.) with Predano=TRUE -> DONE
  assert.equal(tasks[0].clientName, 'Minulý klient');
  assert.equal(tasks[0].status, 'DONE');

  // 2. Past task (15.1.) with Predano=FALSE -> DONE (historical past tasks are completed)
  assert.equal(tasks[1].clientName, 'Starý nezaškrtnutý');
  assert.equal(tasks[1].status, 'DONE');

  // 3. Future task (20.11.) with FAKT=ANO -> invoiced=true, but MUST NOT close early as DONE!
  assert.equal(tasks[2].clientName, 'Budoucí vyfakturovaný');
  assert.equal(tasks[2].isInvoiced, true);
  assert.equal(tasks[2].status, 'PLANNED');

  // 4. Future task (20.11.) with Predano=TRUE -> HANDED_OVER
  assert.equal(tasks[3].clientName, 'Budoucí předaný');
  assert.equal(tasks[3].status, 'HANDED_OVER');

  // 5. Future task (20.11.) with Predano=FALSE -> PLANNED
  assert.equal(tasks[4].clientName, 'Budoucí otevřený');
  assert.equal(tasks[4].status, 'PLANNED');
});

test('Google Sheets Sync: isGreenRgbHex identifies Sheet green fills and rejects white, gray, red, yellow, cyan', () => {
  assert.equal(isGreenRgbHex('FF00FF00'), true);
  assert.equal(isGreenRgbHex('FFD4EDBC'), true);
  assert.equal(isGreenRgbHex('FFD9EAD3'), true);
  assert.equal(isGreenRgbHex('#6AA84F'), true);
  assert.equal(isGreenRgbHex('FF38761D'), true);

  assert.equal(isGreenRgbHex('FFFFFFFF'), false);
  assert.equal(isGreenRgbHex('FFEFEFEF'), false);
  assert.equal(isGreenRgbHex('FF00FFFF'), false); // cyan
  assert.equal(isGreenRgbHex('FFFFFF00'), false); // yellow
  assert.equal(isGreenRgbHex('FFFF0000'), false); // red
  assert.equal(isGreenRgbHex('FFF995D6'), false); // pink
  assert.equal(isGreenRgbHex(null), false);
});

test('Google Sheets Sync: unwrapExcelValueToString and extractExcelCellHyperlink handle nested richText+hyperlink', () => {
  const richHyperlinkVal = {
    text: {
      richText: [
        { text: 'Deinstalace 3 ks MT  ' },
        { text: 'https://maps.example/abc' },
      ],
    },
    hyperlink: 'https://maps.example/abc',
  };
  assert.equal(
    unwrapExcelValueToString(richHyperlinkVal),
    'Deinstalace 3 ks MT  https://maps.example/abc'
  );
  assert.equal(extractExcelCellHyperlink(richHyperlinkVal), 'https://maps.example/abc');
  assert.equal(
    unwrapExcelValueToString(new Date(Date.UTC(2026, 10, 12, 0, 0, 0))),
    '12.11.2026'
  );
});

test('Google Sheets Sync: parseGooglePlanXlsx detects green worker cell as DONE and preserves Drive hyperlinks', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Plan práce 2026');

  ws.addRow([
    'FTD odeslána',
    'FAKT',
    'Datum',
    'Den',
    'Zadal',
    'Pracovník dílna',
    'Předáno klukům',
    'Klient',
    'Zadání',
    'Kontakt na klienta/ osobu na místě',
    'Datum zahájení',
    'Datum ukončení',
    'Typ nosiče',
    'KS',
    'Práce',
    'Odkaz',
    'Odkaz na FTD',
  ]);

  // Row 2: Green fill on worker cell for tomorrow -> DONE + embedded FTD Drive link
  const r2 = ws.addRow([
    'NE',
    'NE',
    new Date(Date.UTC(2026, 10, 12, 0, 0, 0)),
    'čtvrtek',
    'M',
    'Mirek',
    'TRUE',
    'MOaP',
    'CP - reinstalace 5 ks',
    '',
    new Date(Date.UTC(2026, 10, 12, 0, 0, 0)),
    new Date(Date.UTC(2026, 10, 12, 0, 0, 0)),
    'CP',
    5,
    'reinstalace',
    'Podklady PDF',
    '09 11 MOaP Andělé CP',
  ]);
  r2.getCell(6).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF00FF00' },
  };
  r2.getCell(16).value = {
    text: 'Podklady PDF',
    hyperlink: 'https://drive.google.com/drive/folders/ref123',
  };
  r2.getCell(17).value = {
    text: '09 11 MOaP Andělé CP',
    hyperlink: 'https://drive.google.com/drive/folders/ftd456',
  };

  // Row 3: White background on worker cell for future task -> PLANNED
  const r3 = ws.addRow([
    'NE',
    'NE',
    new Date(Date.UTC(2026, 10, 15, 0, 0, 0)),
    'neděle',
    'V',
    'Pavel',
    'FALSE',
    'Aréna',
    'Billboard - Megakoncert',
    '',
    new Date(Date.UTC(2026, 10, 15, 0, 0, 0)),
    new Date(Date.UTC(2026, 10, 15, 0, 0, 0)),
    'BB',
    1,
    'reinstalace',
    '',
    '15 11 Billboard Megakoncert',
  ]);
  r3.getCell(6).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' },
  };

  // Row 4: Green background on FAKT (col 2) for future task, white on worker cell -> MUST remain PLANNED
  const r4 = ws.addRow([
    'NE',
    'ANO',
    new Date(Date.UTC(2026, 10, 18, 0, 0, 0)),
    'středa',
    'MM',
    'Sonik',
    'FALSE',
    'Předfakturováno',
    'Polep výlohy příští týden',
    '',
    new Date(Date.UTC(2026, 10, 18, 0, 0, 0)),
    new Date(Date.UTC(2026, 10, 18, 0, 0, 0)),
    'MT',
    2,
    'instalace',
    '',
    '',
  ]);
  r4.getCell(2).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF00FF00' },
  };
  r4.getCell(6).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' },
  };

  const buffer = await wb.xlsx.writeBuffer();
  const tasks = await parseGooglePlanXlsx(
    buffer,
    2026,
    new Date(Date.UTC(2026, 10, 11, 0, 0, 0))
  );

  assert.equal(tasks.length, 3);

  assert.equal(tasks[0].clientName, 'MOaP');
  assert.equal(tasks[0].status, 'DONE');
  assert.equal(tasks[0].isCompletedByColor, true);
  assert.equal(tasks[0].ftdUrl, 'https://drive.google.com/drive/folders/ftd456');
  assert.equal(tasks[0].referenceUrl, 'https://drive.google.com/drive/folders/ref123');

  assert.equal(tasks[1].clientName, 'Aréna');
  assert.equal(tasks[1].status, 'PLANNED');
  assert.equal(tasks[1].isCompletedByColor, false);
  assert.equal(tasks[1].ftdUrl, '15 11 Billboard Megakoncert');

  assert.equal(tasks[2].clientName, 'Předfakturováno');
  assert.equal(tasks[2].requestedBy, 'Miroslav Mec');
  assert.deepEqual(tasks[2].workers, ['Marek Šlapnička']);
  assert.equal(tasks[2].isInvoiced, true);
  assert.equal(tasks[2].isCompletedByColor, false);
  assert.equal(tasks[2].status, 'PLANNED');
});

test('Google Sheets Sync: recognizes FAKT=BEZ and FTD=BEZ and excludes BEZ from invoicing queue', () => {
  const sampleCsv = [
    'FTD odeslána,FAKT,Datum,Den,Zadal,Pracovník dílna,Předáno klukům,Klient,Zadání,Kontakt na klienta/ osobu na místě,Datum zahájení,Datum ukončení,Typ nosiče,KS,Práce,Odkaz,Odkaz na FTD',
    'ANO,BEZ,5.11.,čtvrtek,Z,Mirek,TRUE,GV,Nafotit náměstí,,5.11.2026,5.11.2026,MT,1,kontrola,,https://drive.google.com/drive/folders/gv1',
    'ANO,,11.11.,středa,Z,Mirek,TRUE,Kultura Jih,Instalace Jih,,11.11.2026,11.11.2026,MT,2,instalace,,https://drive.google.com/drive/folders/kj1',
    'BEZ,BEZ,18.11.,středa,V,Pavel,FALSE,Kamery,Servis kamer,,18.11.2026,18.11.2026,,,jiné,,',
  ].join('\n');

  const tasks = parseGooglePlanCsv(sampleCsv, 2026, new Date(Date.UTC(2026, 10, 11, 0, 0, 0)));
  assert.equal(tasks.length, 3);

  // 1. GV: FTD=ANO, FAKT=BEZ -> DONE & invoiceExempt, NOT ready for invoicing
  assert.equal(tasks[0].isFtdSent, true);
  assert.equal(tasks[0].isInvoiced, false);
  assert.equal(tasks[0].isInvoiceExempt, true);
  assert.equal(tasks[0].status, 'DONE');
  assert.equal(
    isOrderReadyForInvoicing({
      status: tasks[0].status,
      ftdSent: tasks[0].isFtdSent,
      invoiced: tasks[0].isInvoiced,
      invoiceExempt: tasks[0].isInvoiceExempt,
    }),
    false
  );

  // 2. Kultura Jih: FTD=ANO, FAKT blank -> ready for invoicing
  assert.equal(tasks[1].isFtdSent, true);
  assert.equal(tasks[1].isInvoiced, false);
  assert.equal(tasks[1].isInvoiceExempt, false);
  assert.equal(
    isOrderReadyForInvoicing({
      status: tasks[1].status,
      ftdSent: tasks[1].isFtdSent,
      invoiced: tasks[1].isInvoiced,
      invoiceExempt: tasks[1].isInvoiceExempt,
    }),
    true
  );

  // 3. Future Kamery: FTD=BEZ, FAKT=BEZ -> remains PLANNED (not auto-closed early)
  assert.equal(tasks[2].isFtdSkipped, true);
  assert.equal(tasks[2].isInvoiceExempt, true);
  assert.equal(tasks[2].status, 'PLANNED');

  // Helper checks
  assert.deepEqual(extractWorkOrderConstraintFlags({ invoiceExempt: true, ftdSkipped: true }), {
    invoiceExempt: true,
    ftdSkipped: true,
    completedBySheetColor: false,
  });
  assert.equal(
    isOrderDoneWithoutFtdFlag({ status: 'DONE', ftdSent: false, invoiced: false, invoiceExempt: false }),
    true
  );
  assert.equal(
    isOrderDoneWithoutFtdFlag({ status: 'DONE', ftdSent: false, invoiced: false, invoiceExempt: true }),
    false
  );
});

test('Google Sheets Sync: preserves manual invoicing and invoiceExempt state across subsequent cron runs', async () => {
  const sampleCsv = [
    'FTD odeslána,FAKT,Datum,Den,Zadal,Pracovník dílna,Předáno klukům,Klient,Zadání,Kontakt na klienta/ osobu na místě,Datum zahájení,Datum ukončení,Typ nosiče,KS,Práce,Odkaz,Odkaz na FTD',
    'ANO,,11.11.,středa,Z,Mirek,TRUE,Kultura Jih,Instalace Jih,,11.11.2026,11.11.2026,MT,2,instalace,,https://drive.google.com/drive/folders/kj1',
  ].join('\n');

  const existingOrder: any = {
    id: 'wo-1',
    title: 'Kultura Jih – Instalace Jih',
    description: 'Instalace Jih',
    clientName: 'Kultura Jih',
    scheduledAt: new Date(Date.UTC(2026, 10, 11, 0, 0, 0)),
    status: 'DONE',
    priority: 'NORMAL',
    ftdSent: true,
    invoiced: true,
    ftdUrl: 'https://drive.google.com/drive/folders/kj1',
    referenceUrl: null,
    planningConstraints: {
      source: 'GOOGLE_SHEETS_PLAN',
      sheetKey: 'gsheet_2026-11-11_kultura_jih_instalacejih',
      sheetRow: 2,
      completedBySheetColor: false,
      manualInvoiced: true,
      invoiceExempt: false,
      ftdSkipped: false,
    },
    assignments: [{ workerName: 'Mirek' }],
  };

  let updateCalls = 0;
  const mockTx = {
    workOrder: {
      findMany: async () => [existingOrder],
      update: async () => {
        updateCalls++;
        return existingOrder;
      },
    },
    workAssignment: { findMany: async () => [], deleteMany: async () => {}, createMany: async () => {} },
    workTask: { findMany: async () => [], create: async () => ({}), update: async () => ({}), delete: async () => {} },
    employee: { findMany: async () => [], findFirst: async () => null },
  };

  const res = await syncGooglePlanToWorkOrders(
    {
      organizationId: 'org-1',
      csvContent: sampleCsv,
      defaultYear: 2026,
      referenceDate: new Date(Date.UTC(2026, 10, 11, 0, 0, 0)),
    },
    { tx: mockTx as any }
  );

  // Even though Google Sheet still has blank FAKT, manual invoiced=true is preserved and row is skipped cleanly!
  assert.equal(updateCalls, 0);
  assert.equal(res.skippedCount, 1);
  assert.equal(existingOrder.invoiced, true);
});

test('Google Sheets Sync: edits on same row/date/client update in place and clean stale open sheet duplicates without touching manual orders', async () => {
  const sampleCsv = [
    'FTD odeslána,FAKT,Datum,Den,Zadal,Pracovník dílna,Předáno klukům,Klient,Zadání,Kontakt na klienta/ osobu na místě,Datum zahájení,Datum ukončení,Typ nosiče,KS,Práce,Odkaz,Odkaz na FTD',
    ',,13.11.,pátek,Z,Mirek,FALSE,MAPPA,bannery přiveze NORD - instalace,,13.11.2026,13.11.2026,MT,2,instalace,,',
  ].join('\n');

  const existingOrders: any[] = [
    {
      id: 'wo-edited-same-row',
      title: 'MAPPA – PODLE TISKU - instalace',
      description: 'PODLE TISKU - instalace',
      clientName: 'MAPPA',
      scheduledAt: new Date(Date.UTC(2026, 10, 13, 7, 0, 0)),
      status: 'PLANNED',
      priority: 'NORMAL',
      ftdSent: false,
      invoiced: false,
      ftdUrl: null,
      referenceUrl: null,
      crmOrderId: null,
      navigationOrderId: null,
      planningConstraints: {
        source: 'GOOGLE_SHEETS_PLAN',
        sheetKey: 'gsheet_2026-11-13_mappa_podletiskuinstalace',
        sheetRow: 2,
        completedBySheetColor: false,
      },
      assignments: [{ workerName: 'Mirek', acknowledgedAt: null }],
      _count: { workEntries: 0, warehouseMovements: 0 },
    },
    {
      id: 'wo-orphan-dup',
      title: 'Kultura Jih – smazaný řádek',
      description: 'smazaný řádek',
      clientName: 'Kultura Jih',
      scheduledAt: new Date(Date.UTC(2026, 10, 13, 7, 0, 0)),
      status: 'PLANNED',
      priority: 'NORMAL',
      ftdSent: false,
      invoiced: false,
      ftdUrl: null,
      referenceUrl: null,
      crmOrderId: null,
      navigationOrderId: null,
      planningConstraints: {
        source: 'GOOGLE_SHEETS_PLAN',
        sheetKey: 'gsheet_2026-11-13_kultura_smazany',
        sheetRow: 853,
      },
      assignments: [{ workerName: 'Mirek', acknowledgedAt: null }],
      _count: { workEntries: 0, warehouseMovements: 0 },
    },
    {
      id: 'wo-manual-keep',
      title: 'Ruční zakázka mimo tabulku',
      description: 'Ručně vytvořeno',
      clientName: 'Klient X',
      scheduledAt: new Date(Date.UTC(2026, 10, 13, 7, 0, 0)),
      status: 'PLANNED',
      priority: 'HIGH',
      ftdSent: false,
      invoiced: false,
      ftdUrl: null,
      referenceUrl: null,
      crmOrderId: null,
      navigationOrderId: null,
      planningConstraints: null,
      assignments: [],
      _count: { workEntries: 0, warehouseMovements: 0 },
    },
  ];

  const deletedIds: string[] = [];
  let createdCount = 0;

  const mockTx = {
    workOrder: {
      findMany: async () => existingOrders,
      findUnique: async ({ where }: any) => {
        const found = existingOrders.find((o) => o.id === where.id);
        return found ? { ...found, assignments: [], items: [] } : null;
      },
      create: async () => {
        createdCount++;
        return { id: 'created-unexpected', scheduledAt: new Date(), status: 'PLANNED', title: '', clientName: '' };
      },
      update: async ({ where, data }: any) => {
        const idx = existingOrders.findIndex((o) => o.id === where.id);
        if (idx !== -1) existingOrders[idx] = { ...existingOrders[idx], ...data };
        return existingOrders[idx];
      },
      delete: async ({ where }: any) => {
        deletedIds.push(where.id);
        return { id: where.id };
      },
    },
    workAssignment: { findMany: async () => [], deleteMany: async () => {}, createMany: async () => {} },
    workTask: { findMany: async () => [], create: async () => ({}), update: async () => ({}), delete: async () => {}, deleteMany: async () => {} },
    workOrderItem: { deleteMany: async () => {} },
    workOrderRate: { deleteMany: async () => {} },
    employee: { findMany: async () => [], findFirst: async () => null },
  };

  const res = await syncGooglePlanToWorkOrders(
    {
      organizationId: 'org-1',
      csvContent: sampleCsv,
      defaultYear: 2026,
      referenceDate: new Date(Date.UTC(2026, 10, 11, 0, 0, 0)),
      reconcileRemovedRows: true,
    },
    { tx: mockTx as any }
  );

  // Updated edited MAPPA row in place instead of creating duplicate
  assert.equal(createdCount, 0);
  assert.equal(res.createdCount, 0);
  assert.equal(res.updatedCount, 1);
  assert.match(existingOrders[0].title, /bannery přiveze NORD/);

  // Removed stale orphan from Google Sheet, kept manual order untouched
  assert.deepEqual(deletedIds, ['wo-orphan-dup']);
  assert.equal(res.cleanedCount, 1);
  assert.equal(existingOrders[2].status, 'PLANNED');
});

test('Google Sheets Sync: resolveSyncedScheduledAt preserves email/manual reschedule until Sheet row date changes', () => {
  const rescheduledAt = new Date('2026-11-13T07:00:00.000Z');
  const unchangedSheetDate = new Date('2026-11-12T00:00:00.000Z');
  const lockedPc = {
    source: 'GOOGLE_SHEETS_PLAN',
    manualScheduledDateIso: '2026-11-13',
    sheetScheduledDateAtReschedule: '2026-11-12',
  };

  // Next 15-min sheet sync with unchanged sheet date must keep 2026-11-13
  const kept = resolveSyncedScheduledAt(rescheduledAt, lockedPc, unchangedSheetDate);
  assert.equal(kept.preservedManualReschedule, true);
  assert.equal(kept.scheduledAt.toISOString(), rescheduledAt.toISOString());

  // When dispatcher edits date in Google Sheet to 2026-11-15, new sheet date applies
  const newSheetDate = new Date('2026-11-15T00:00:00.000Z');
  const overridden = resolveSyncedScheduledAt(rescheduledAt, lockedPc, newSheetDate);
  assert.equal(overridden.preservedManualReschedule, false);
  assert.equal(overridden.scheduledAt.toISOString(), newSheetDate.toISOString());
});

test('Google Sheets Sync: reopens future orders mistakenly closed solely by advance invoicing', async () => {
  const sampleCsv = [
    'FTD odeslána,FAKT,Datum,Den,Zadal,Pracovník dílna,Předáno klukům,Klient,Zadání,Kontakt na klienta/ osobu na místě,Datum zahájení,Datum ukončení,Typ nosiče,KS,Práce,Odkaz,Odkaz na FTD',
    ',ANO,20.11.,pátek,M,Sonik,FALSE,Budoucí vyfakturovaný,Instalace baneru,,20.11.2026,20.11.2026,MT,2,instalace,,',
  ].join('\n');

  const existingOrder: any = {
    id: 'wo-premature-done',
    title: 'Budoucí vyfakturovaný – Instalace baneru',
    description: 'Instalace baneru',
    clientName: 'Budoucí vyfakturovaný',
    scheduledAt: new Date(Date.UTC(2026, 10, 20, 0, 0, 0)),
    status: 'DONE',
    priority: 'NORMAL',
    ftdSent: false,
    invoiced: true,
    ftdUrl: null,
    referenceUrl: null,
    crmOrderId: null,
    navigationOrderId: null,
    planningConstraints: {
      source: 'GOOGLE_SHEETS_PLAN',
      sheetKey: 'gsheet_2026-11-20_budouc__vyfakturovan__instalacebaneru',
      sheetRow: 2,
      completedBySheetColor: false,
    },
    assignments: [{ workerName: 'Marek Šlapnička', acknowledgedAt: null }],
    _count: { workEntries: 0, warehouseMovements: 0 },
  };

  const mockTx = {
    workOrder: {
      findMany: async () => [existingOrder],
      findUnique: async () => ({ ...existingOrder, assignments: existingOrder.assignments, items: [] }),
      update: async ({ data }: any) => {
        Object.assign(existingOrder, data);
        return existingOrder;
      },
    },
    workAssignment: { findMany: async () => [], deleteMany: async () => {}, createMany: async () => {} },
    workTask: { findMany: async () => [], create: async () => ({}), update: async () => ({}), delete: async () => {} },
    employee: { findMany: async () => [], findFirst: async () => null },
  };

  const res = await syncGooglePlanToWorkOrders(
    {
      organizationId: 'org-seepoint',
      csvContent: sampleCsv,
      defaultYear: 2026,
      referenceDate: new Date(Date.UTC(2026, 10, 12, 0, 0, 0)),
    },
    { tx: mockTx as any }
  );

  assert.equal(res.updatedCount, 1);
  assert.equal(existingOrder.status, 'PLANNED');
  assert.equal(existingOrder.invoiced, true);
});
