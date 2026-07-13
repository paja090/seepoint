import { prisma } from './db';
import { Prisma } from '@prisma/client';

export async function getSystemSettings() {
  return await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      companyName: 'SeePoint s.r.o.',
      companyId: '12345678',
      vatId: 'CZ12345678',
      street: 'Mezibranská 1367/21',
      city: 'Praha',
      postalCode: '110 00',
      country: 'CZ',
    },
  });
}

export async function updateSystemSettings(data: Omit<Prisma.SystemSettingsUpdateInput, 'id'>) {
  const { id: _, ...cleanData } = data as any;
  return await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: cleanData,
    create: {
      id: 'default',
      companyName: (cleanData.companyName as string) || 'SeePoint s.r.o.',
      companyId: (cleanData.companyId as string) || '12345678',
      vatId: (cleanData.vatId as string) || 'CZ12345678',
      street: (cleanData.street as string) || 'Mezibranská 1367/21',
      city: (cleanData.city as string) || 'Praha',
      postalCode: (cleanData.postalCode as string) || '110 00',
      country: (cleanData.country as string) || 'CZ',
    },
  });
}
