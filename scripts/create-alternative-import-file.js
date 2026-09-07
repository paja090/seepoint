const ExcelJS = require('exceljs');
const path = require('path');

async function createAlternativeFile() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SeePoint Test Engine';
  workbook.created = new Date();

  // -------------------------------------------------------------
  // List 1: Přehled billboardů a ploch (CARRIERS)
  // Používá odlišné názvy: Kód plochy, Lokalita, Obec, Ulice a č.p.,
  // Kategorie nosiče, Velikost (š x v), Světlo, Zeměpisná šířka,
  // Zeměpisná délka, Cena bez DPH, Doplňující info
  // -------------------------------------------------------------
  const sheet1 = workbook.addWorksheet('Přehled billboardů a ploch', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet1.columns = [
    { header: 'Kód plochy', key: 'code', width: 16 },
    { header: 'Lokalita', key: 'name', width: 44 },
    { header: 'Obec', key: 'city', width: 18 },
    { header: 'Ulice a č.p.', key: 'street', width: 28 },
    { header: 'Kategorie nosiče', key: 'type', width: 22 },
    { header: 'Velikost (š x v)', key: 'dimensions', width: 16 },
    { header: 'Světlo', key: 'lighting', width: 14 },
    { header: 'Zeměpisná šířka', key: 'latitude', width: 18 },
    { header: 'Zeměpisná délka', key: 'longitude', width: 18 },
    { header: 'Cena bez DPH', key: 'price', width: 18 },
    { header: 'Doplňující info', key: 'note', width: 44 },
  ];

  const carriersData = [
    {
      code: 'CLV-HK-01',
      name: 'Hradec Králové - Gočárova třída u hl. nádraží',
      city: 'Hradec Králové',
      street: 'Gočárova 1225',
      type: 'Citylight (CLV)',
      dimensions: '1,185 x 1,75 m',
      lighting: 'Ano',
      latitude: 50.210412,
      longitude: 15.825124,
      price: 7200,
      note: 'Vysoká frekvence pěších a studentů UHK, u přestupního uzlu',
    },
    {
      code: 'BB-PCE-02',
      name: 'Pardubice - Palackého třída směr centrum',
      city: 'Pardubice',
      street: 'Palackého třída 45',
      type: 'Billboard 5.1x2.4',
      dimensions: '5,1 x 2,4 m',
      lighting: 'Ano',
      latitude: 50.038512,
      longitude: 15.779124,
      price: 9400,
      note: 'Hlavní dopravní tepna Pardubic, výborná viditelnost z křižovatky',
    },
    {
      code: 'LED-ZLN-01',
      name: 'Zlín - Náměstí Práce, OD Prior',
      city: 'Zlín',
      street: 'Dlouhá 504',
      type: 'LED obrazovka',
      dimensions: '4,0 x 3,0 m',
      lighting: 'Ano',
      latitude: 49.224156,
      longitude: 17.666412,
      price: 35000,
      note: 'Digitální LED obrazovka v samotném centru Baťova Zlína',
    },
    {
      code: 'PH-JIH-01',
      name: 'Jihlava - Vrchlického, přemostění komunikace',
      city: 'Jihlava',
      street: 'Vrchlického 18',
      type: 'Promohorizont',
      dimensions: '6,0 x 3,0 m',
      lighting: 'Ano',
      latitude: 49.396123,
      longitude: 15.588412,
      price: 18000,
      note: 'Čelní mostní konstrukce nad výpadovkou směr D1',
    },
    {
      code: 'BB-KV-01',
      name: 'Karlovy Vary - Chebská, vjezd od Sokolova',
      city: 'Karlovy Vary',
      street: 'Chebská 82',
      type: 'Billboard 5.1x2.4',
      dimensions: '5,1 x 2,4 m',
      lighting: 'Ne',
      latitude: 50.228412,
      longitude: 12.871124,
      price: 8900,
      note: 'Vjezdová komunikace do lázeňského města',
    },
    {
      code: 'BG-UST-01',
      name: 'Ústí nad Labem - Masarykova u Spolchemie',
      city: 'Ústí nad Labem',
      street: 'Masarykova 94',
      type: 'Bigboard 9.6x3.6',
      dimensions: '9,6 x 3,6 m',
      lighting: 'Ano',
      latitude: 50.660124,
      longitude: 14.032124,
      price: 27500,
      note: 'Dominantní osvětlený Bigboard na hlavní spojnici do centra',
    },
    {
      code: 'CP-KLA-01',
      name: 'Kladno - Kladenská u OC Oáza',
      city: 'Kladno',
      street: 'Kladenská 12',
      type: 'City Poster',
      dimensions: '1,2 x 1,8 m',
      lighting: 'Ne',
      latitude: 50.142123,
      longitude: 14.105124,
      price: 4500,
      note: 'Vstup do nákupního areálu a autobusová zastávka',
    },
    {
      code: 'BB-OPA-01',
      name: 'Opava - Těšínská směr Ostrava',
      city: 'Opava',
      street: 'Těšínská 30',
      type: 'Billboard 5.1x2.4',
      dimensions: '5,1 x 2,4 m',
      lighting: 'Ano',
      latitude: 49.938124,
      longitude: 17.902124,
      price: 9100,
      note: 'Tranzitní tah I/11 Opava - Ostrava, dlouhý nájezd',
    },
  ];

  sheet1.addRows(carriersData);

  // -------------------------------------------------------------
  // List 2: Partneři a odběratelé (CLIENTS)
  // Hlavičky: Název firmy, IČO, Kontaktní osoba, E-mail, Telefon, Sídlo, Poznámka
  // -------------------------------------------------------------
  const sheet2 = workbook.addWorksheet('Partneři a odběratelé', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet2.columns = [
    { header: 'Název firmy', key: 'name', width: 34 },
    { header: 'IČO', key: 'ico', width: 14 },
    { header: 'Kontaktní osoba', key: 'contactPerson', width: 24 },
    { header: 'E-mail', key: 'email', width: 28 },
    { header: 'Telefon', key: 'phone', width: 18 },
    { header: 'Sídlo', key: 'city', width: 22 },
    { header: 'Poznámka', key: 'note', width: 32 },
  ];

  const clientsData = [
    {
      name: 'Pernštejn Developers s.r.o.',
      ico: '28719284',
      contactPerson: 'David Kříž',
      email: 'kriz@pernstejn-dev.cz',
      phone: '+420 777 222 333',
      city: 'Pardubice',
      note: 'Rezidenční projekty v Pardubicích a Hradci',
    },
    {
      name: 'Baťa Tech Innovation a.s.',
      ico: '49182736',
      contactPerson: 'Monika Malá',
      email: 'mala@batatech.cz',
      phone: '+420 603 999 888',
      city: 'Zlín',
      note: 'Dlouhodobý inzerent na LED obrazovkách',
    },
    {
      name: 'Lázně Vřídlo Karlovy Vary s.r.o.',
      ico: '19283746',
      contactPerson: 'Jana Procházková',
      email: 'prochazkova@vridlo-kv.cz',
      phone: '+420 725 444 111',
      city: 'Karlovy Vary',
      note: 'Pravidelné lázeňské a festivalové kampaně',
    },
    {
      name: 'Severočeské Energetické Závody a.s.',
      ico: '25481920',
      contactPerson: 'Ing. Petr Sýkora',
      email: 'sykora@sez-usti.cz',
      phone: '+420 608 123 789',
      city: 'Ústí nad Labem',
      note: 'Bigboardy a promohorizonty na severu Čech',
    },
  ];

  sheet2.addRows(clientsData);

  // -------------------------------------------------------------
  // List 3: Ceník pronájmu 2026 (PRICES)
  // Hlavičky: Formát, Kód, Základní měsíční nájem (Kč), Výroba a montáž (Kč), Tisk banneru (Kč)
  // -------------------------------------------------------------
  const sheet3 = workbook.addWorksheet('Ceník pronájmu 2026', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet3.columns = [
    { header: 'Formát', key: 'name', width: 28 },
    { header: 'Kód', key: 'code', width: 16 },
    { header: 'Základní měsíční nájem (Kč)', key: 'rentalPrice', width: 26 },
    { header: 'Výroba a montáž (Kč)', key: 'productionPrice', width: 22 },
    { header: 'Tisk banneru (Kč)', key: 'printPrice', width: 20 },
  ];

  const pricesData = [
    {
      name: 'Citylight vitrína CLV',
      code: 'FORMAT-CLV',
      rentalPrice: 7200,
      productionPrice: 650,
      printPrice: 850,
    },
    {
      name: 'Standardní billboard 5,1x2,4',
      code: 'FORMAT-BB',
      rentalPrice: 9400,
      productionPrice: 1200,
      printPrice: 1400,
    },
    {
      name: 'Digitální LED obrazovka',
      code: 'FORMAT-LED',
      rentalPrice: 35000,
      productionPrice: 0,
      printPrice: 0,
    },
    {
      name: 'Dálniční a městský Bigboard',
      code: 'FORMAT-BIG',
      rentalPrice: 27500,
      productionPrice: 2800,
      printPrice: 3900,
    },
  ];

  sheet3.addRows(pricesData);

  // -------------------------------------------------------------
  // List 4: Rezervace a kampaně 2026 (OCCUPANCY)
  // Hlavičky: Kód plochy, Inzerent, Název kampaně, Platnost od, Platnost do, Stav
  // -------------------------------------------------------------
  const sheet4 = workbook.addWorksheet('Rezervace a kampaně 2026', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet4.columns = [
    { header: 'Kód plochy', key: 'carrierCode', width: 16 },
    { header: 'Inzerent', key: 'clientName', width: 32 },
    { header: 'Název kampaně', key: 'campaignName', width: 32 },
    { header: 'Platnost od', key: 'dateFrom', width: 16 },
    { header: 'Platnost do', key: 'dateTo', width: 16 },
    { header: 'Stav', key: 'status', width: 18 },
  ];

  const occupancyData = [
    {
      carrierCode: 'CLV-HK-01',
      clientName: 'Pernštejn Developers s.r.o.',
      campaignName: 'Nové byty u Labe Hradec',
      dateFrom: '2026-04-01',
      dateTo: '2026-05-31',
      status: 'Potvrzeno',
    },
    {
      carrierCode: 'LED-ZLN-01',
      clientName: 'Baťa Tech Innovation a.s.',
      campaignName: 'Smart Factory Expo 2026',
      dateFrom: '2026-05-01',
      dateTo: '2026-06-30',
      status: 'Rezervováno',
    },
    {
      carrierCode: 'BB-KV-01',
      clientName: 'Lázně Vřídlo Karlovy Vary s.r.o.',
      campaignName: 'Zahájení lázeňské sezóny',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      status: 'Potvrzeno',
    },
  ];

  sheet4.addRows(occupancyData);

  // Styling
  for (const sheet of workbook.worksheets) {
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      row.height = 22;
      row.alignment = { vertical: 'middle' };
      if (r % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
    }
  }

  const publicPath = path.join(__dirname, '..', 'public', 'seepoint-alternativni-vzor-ooh.xlsx');
  const rootPath = path.join(__dirname, '..', 'seepoint-alternativni-vzor-ooh.xlsx');

  await workbook.xlsx.writeFile(publicPath);
  await workbook.xlsx.writeFile(rootPath);

  console.log('SUCCESS: Generated at ' + publicPath);
}

createAlternativeFile().catch(console.error);
