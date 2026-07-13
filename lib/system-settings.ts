import { prisma } from './db';

export interface SystemSettingsInput {
  companyName?: string;
  companyId?: string | null;
  vatId?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  bankAccount?: string | null;
  iban?: string | null;
  swift?: string | null;
}

export async function getSystemSettings() {
  return await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      companyName: 'SeePoint s.r.o.',
    },
  });
}

export async function updateSystemSettings(data: SystemSettingsInput) {
  return await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {
      companyName: data.companyName,
      companyId: data.companyId,
      vatId: data.vatId,
      street: data.street,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country,
      bankAccount: data.bankAccount,
      iban: data.iban,
      swift: data.swift,
    },
    create: {
      id: 'default',
      companyName: data.companyName || 'SeePoint s.r.o.',
      companyId: data.companyId,
      vatId: data.vatId,
      street: data.street,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country,
      bankAccount: data.bankAccount,
      iban: data.iban,
      swift: data.swift,
    },
  });
}
