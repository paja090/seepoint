import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Navigace demo data...');

  // 1. Find or create demo user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'demo.obchodnik@seepoint.cz',
        name: 'Pavel Obchodník',
        role: 'SALES',
      },
    });
  }

  // 2. Find existing client or create demo Client
  let client = await prisma.client.findFirst();
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: 'OC Central Park s.r.o.',
        normalizedName: 'oc central park s r o',
        ic: '12345678',
        dic: 'CZ12345678',
        email: 'info@centralpark.cz',
        phone: '+420 608 111 222',
        contactPerson: 'Ing. Martin Dvořák',
        city: 'Pardubice',
        street: 'Hlavní třída 145',
        zip: '53002',
      },
    });
  }

  // 3. Find existing AdvertisingCarrier or create demo Carriers
  let carrier1 = await prisma.advertisingCarrier.findFirst({ where: { code: 'SL-01-PCE' } });
  if (!carrier1) {
    carrier1 = await prisma.advertisingCarrier.create({
      data: {
        code: 'SL-01-PCE',
        name: 'Navigační sloup N1 - Hradecká',
        latitude: 50.0412,
        longitude: 15.7761,
        address: 'Hradecká / Křižovatka II',
        city: 'Pardubice',
        type: 'NAVIGATION',
      },
    });
  }

  let carrier2 = await prisma.advertisingCarrier.findFirst({ where: { code: 'SL-02-PCE' } });
  if (!carrier2) {
    carrier2 = await prisma.advertisingCarrier.create({
      data: {
        code: 'SL-02-PCE',
        name: 'Navigační nosič N2 - Poděbradská',
        latitude: 50.0351,
        longitude: 15.7820,
        address: 'Poděbradská kruhový objezd',
        city: 'Pardubice',
        type: 'NAVIGATION',
      },
    });
  }

  let surface1 = await prisma.advertisingSurface.findFirst({ where: { carrierId: carrier1.id } });
  if (!surface1) {
    surface1 = await prisma.advertisingSurface.create({
      data: {
        carrierId: carrier1.id,
        name: 'Pozice 1 - Horní cedule (Směr Pardubice centrum)',
        size: '120x40',
      },
    });
  }

  let surface2 = await prisma.advertisingSurface.findFirst({ where: { carrierId: carrier2.id } });
  if (!surface2) {
    surface2 = await prisma.advertisingSurface.create({
      data: {
        carrierId: carrier2.id,
        name: 'Pozice 2 - Střední cedule (Směr Hradec Králové)',
        size: '120x40',
      },
    });
  }

  // 4. Create CRM Order 1: OC Central Park - Navigační systém
  const orderNumber1 = `NAV-2026-${Math.floor(100 + Math.random() * 900)}`;
  const crmOrder1 = await prisma.crmOrder.create({
    data: {
      orderNumber: orderNumber1,
      title: 'Navigační systém OC Central Park Pardubice',
      clientId: client.id,
      assignedUserId: user.id,
      status: 'IN_REALIZATION',
      totalPrice: 72000,
    },
  });

  // Create NavigationOrder 1 (In Terén / Installation phase)
  const navOrder1 = await prisma.navigationOrder.create({
    data: {
      crmOrderId: crmOrder1.id,
      targetName: 'Obchodní centrum Central Park',
      targetAddress: 'Hlavní třída 145, Pardubice',
      targetLatitude: 50.0385,
      targetLongitude: 15.7792,
      status: 'PRIPRAVENO_K_INSTALACI',
      blockStatus: 'CEKA_NA_INSTALACI',
      rentStart: new Date('2026-03-01'),
      rentEnd: new Date('2027-02-28'),
    },
  });

  // Add Points
  const point1 = await prisma.navigationPoint.create({
    data: {
      navigationOrder: { connect: { id: navOrder1.id } },
      carrier: { connect: { id: carrier1.id } },
      surface: { connect: { id: surface1.id } },
      sortOrder: 1,
      latitude: 50.0412,
      longitude: 15.7761,
      label: 'Směrová tabule Hradecká (OC Central Park 800m)',
      navigationType: 'Směrová šipka s logem',
      unitPrice: 1500,
      subtotal: 18000,
      status: 'PLANNED',
    },
  });

  const point2 = await prisma.navigationPoint.create({
    data: {
      navigationOrder: { connect: { id: navOrder1.id } },
      carrier: { connect: { id: carrier2.id } },
      surface: { connect: { id: surface2.id } },
      sortOrder: 2,
      latitude: 50.0351,
      longitude: 15.7820,
      label: 'Směrová tabule Poděbradská (OC Central Park 400m)',
      navigationType: 'Směrová šipka s logem',
      unitPrice: 1500,
      subtotal: 18000,
      status: 'PLANNED',
    },
  });

  // Price Versioning
  await prisma.navigationPriceVersion.create({
    data: {
      navigationPointId: point1.id,
      validFrom: new Date('2026-03-01'),
      validTo: null,
      unitPrice: 1500,
      subtotal: 18000,
      reason: 'Původní smluvní cena zakázky',
      changedByUserId: user.id,
    },
  });

  // Add Billing Period
  await prisma.navigationBillingPeriod.create({
    data: {
      navigationOrderId: navOrder1.id,
      dateFrom: new Date('2026-03-01'),
      dateTo: new Date('2026-03-31'),
      amount: 3000,
      status: 'DRAFT',
    },
  });

  // CRM Task for Field Installation
  await prisma.crmTask.create({
    data: {
      clientId: client.id,
      crmOrderId: crmOrder1.id,
      assignedUserId: user.id,
      createdUserId: user.id,
      title: `Montáž 2ks navigačních cedulí: ${navOrder1.targetName}`,
      description: 'Zajistit výjezd montážní skupiny, osazení na sloupy SL-01 a SL-02 a pořízení fotodokumentace.',
      type: 'PLAN_REALIZATION',
      priority: 'HIGH',
      status: 'TODO',
      dueDate: new Date(Date.now() + 2 * 86400000),
    },
  });

  // 5. Create CRM Order 2: Auto Galerie Pardubice (Active / Billed)
  const orderNumber2 = `NAV-2026-${Math.floor(100 + Math.random() * 900)}`;
  const crmOrder2 = await prisma.crmOrder.create({
    data: {
      orderNumber: orderNumber2,
      title: 'Navigace autosalon Auto Galerie',
      clientId: client.id,
      assignedUserId: user.id,
      status: 'IN_REALIZATION',
      totalPrice: 48000,
    },
  });

  const navOrder2 = await prisma.navigationOrder.create({
    data: {
      crmOrderId: crmOrder2.id,
      targetName: 'Auto Galerie Pardubice - Prodej a servis',
      targetAddress: 'Dražkovická 890, Pardubice',
      targetLatitude: 50.0290,
      targetLongitude: 15.7650,
      status: 'INSTALACE',
      blockStatus: 'CEKA_NA_FOTOGRAFIE',
      rentStart: new Date('2026-01-01'),
      rentEnd: new Date('2027-12-31'),
    },
  });

  await prisma.navigationPoint.create({
    data: {
      navigationOrder: { connect: { id: navOrder2.id } },
      carrier: { connect: { id: carrier1.id } },
      sortOrder: 1,
      latitude: 50.0412,
      longitude: 15.7761,
      label: 'Navigace k autosalonu směr Chrudim',
      navigationType: 'Oboustranná cedule',
      unitPrice: 2000,
      subtotal: 24000,
      status: 'INSTALLED',
    },
  });

  await prisma.navigationBillingPeriod.create({
    data: {
      navigationOrderId: navOrder2.id,
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-03-31'),
      amount: 6000,
      invoicedAt: new Date('2026-01-05'),
      status: 'ISSUED',
    },
  });

  console.log('Demo data successfully created!');
  console.log(`Created orders: ${orderNumber1} (Připraveno k instalaci) and ${orderNumber2} (Instalace/Aktivní)`);
}

main()
  .catch((e) => {
    console.error('Error seeding demo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
