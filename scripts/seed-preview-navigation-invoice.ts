import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db.ts';
import { enterTenantContext } from '../lib/tenant-context.ts';

const organizationId = process.env.ORGANIZATION_ID ?? 'org_seepoint_default';
const recipientEmail = process.env.PREVIEW_INVOICE_RECIPIENT?.trim().toLowerCase();

if (process.env.VERCEL_ENV !== 'preview' || process.env.ALLOW_PREVIEW_TEST_DATA !== '1') {
  throw new Error('Tento skript lze spustit jen s VERCEL_ENV=preview a ALLOW_PREVIEW_TEST_DATA=1.');
}
if (!recipientEmail) throw new Error('PREVIEW_INVOICE_RECIPIENT je povinný.');

enterTenantContext({ organizationId, source: 'script' });

async function main() {
  const client = await prisma.client.upsert({
    where: {
      organizationId_normalizedName: {
        organizationId,
        normalizedName: 'preview test fakturace navigace',
      },
    },
    update: {
      email: recipientEmail,
      billingStreet: 'Testovací 1',
      billingCity: 'Ostrava',
      billingZip: '702 00',
      billingCountry: 'CZ',
      note: 'Pouze automatizovaný Preview test. Nepoužívat v Production.',
    },
    create: {
      name: 'PREVIEW TEST – fakturace navigace',
      normalizedName: 'preview test fakturace navigace',
      email: recipientEmail,
      billingStreet: 'Testovací 1',
      billingCity: 'Ostrava',
      billingZip: '702 00',
      billingCountry: 'CZ',
      source: 'OTHER',
      note: 'Pouze automatizovaný Preview test. Nepoužívat v Production.',
    },
  });

  const crmOrder = await prisma.crmOrder.upsert({
    where: {
      organizationId_orderNumber: {
        organizationId,
        orderNumber: 'TEST-NAV-2026-001',
      },
    },
    update: {
      clientId: client.id,
      title: 'PREVIEW TEST – navigační faktura',
      projectType: 'NAVIGATION',
      status: 'ACTIVE',
      totalPrice: new Prisma.Decimal('1000'),
      internalNote: 'Izolovaný Preview E2E test fakturace.',
    },
    create: {
      orderNumber: 'TEST-NAV-2026-001',
      clientId: client.id,
      title: 'PREVIEW TEST – navigační faktura',
      projectType: 'NAVIGATION',
      status: 'ACTIVE',
      totalPrice: new Prisma.Decimal('1000'),
      internalNote: 'Izolovaný Preview E2E test fakturace.',
    },
  });

  const navigationOrder = await prisma.navigationOrder.upsert({
    where: { crmOrderId: crmOrder.id },
    update: {
      status: 'PRIPRAVENO_K_FAKTURACI',
      blockStatus: null,
      rentStart: new Date('2026-08-01T00:00:00.000Z'),
      rentEnd: new Date('2026-08-31T23:59:59.000Z'),
      targetName: 'PREVIEW TEST cíl',
      targetAddress: 'Testovací 1, Ostrava',
      targetLatitude: 49.835,
      targetLongitude: 18.292,
    },
    create: {
      crmOrderId: crmOrder.id,
      status: 'PRIPRAVENO_K_FAKTURACI',
      rentStart: new Date('2026-08-01T00:00:00.000Z'),
      rentEnd: new Date('2026-08-31T23:59:59.000Z'),
      targetName: 'PREVIEW TEST cíl',
      targetAddress: 'Testovací 1, Ostrava',
      targetLatitude: 49.835,
      targetLongitude: 18.292,
      targetNote: 'Izolovaný Preview E2E test fakturace.',
    },
  });

  const existingPoint = await prisma.navigationPoint.findFirst({
    where: { navigationOrderId: navigationOrder.id, label: 'PREVIEW TEST navigační bod' },
  });
  const pointData = {
    latitude: 49.835,
    longitude: 18.292,
    address: 'Testovací 1, Ostrava',
    label: 'PREVIEW TEST navigační bod',
    navigationType: 'Navigační systém – test',
    quantity: new Prisma.Decimal('1'),
    unitPrice: new Prisma.Decimal('1000'),
    subtotal: new Prisma.Decimal('1000'),
    status: 'INSTALLED' as const,
    clientNote: 'Pouze Preview test.',
  };
  if (existingPoint) {
    await prisma.navigationPoint.update({ where: { id: existingPoint.id }, data: pointData });
  } else {
    await prisma.navigationPoint.create({
      data: { ...pointData, navigationOrderId: navigationOrder.id },
    });
  }

  console.log(JSON.stringify({
    success: true,
    navigationOrderId: navigationOrder.id,
    orderNumber: crmOrder.orderNumber,
    status: navigationOrder.status,
  }));
}

main().finally(async () => prisma.$disconnect());
