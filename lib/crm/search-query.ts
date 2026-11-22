import type { Prisma } from '@prisma/client';

/**
 * Shared CRM search query builders supporting unified search across:
 * - End client (name, tradingName, IČO, contacts, email, phone, city)
 * - Agency (agencyClient relation or free-text agencyName on orders, plus orders placed via an agency)
 * - Branch / Pobočka (ClientBranch name, code, street, city on client, order, realization, or navigation target)
 */

export function normalizeSearchTerm(raw?: string | null): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ');
}

export function buildClientSearchWhere(rawQuery: string): Prisma.ClientWhereInput {
  const q = normalizeSearchTerm(rawQuery);
  if (!q) return {};

  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { tradingName: { contains: q, mode: 'insensitive' } },
      { companyId: { contains: q, mode: 'insensitive' } },
      { dic: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { contactPerson: { contains: q, mode: 'insensitive' } },
      { billingCity: { contains: q, mode: 'insensitive' } },
      {
        contacts: {
          some: {
            active: true,
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
      {
        branches: {
          some: {
            active: true,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
              { street: { contains: q, mode: 'insensitive' } },
              { city: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
      {
        crmOrders: {
          some: {
            OR: [
              { orderNumber: { contains: q, mode: 'insensitive' } },
              { title: { contains: q, mode: 'insensitive' } },
              { clientOrderCode: { contains: q, mode: 'insensitive' } },
              { agencyName: { contains: q, mode: 'insensitive' } },
              {
                agencyClient: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { tradingName: { contains: q, mode: 'insensitive' } },
                    { companyId: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
              {
                branch: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { code: { contains: q, mode: 'insensitive' } },
                    { city: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          },
        },
      },
      {
        agencyCrmOrders: {
          some: {
            OR: [
              { orderNumber: { contains: q, mode: 'insensitive' } },
              { title: { contains: q, mode: 'insensitive' } },
              { clientOrderCode: { contains: q, mode: 'insensitive' } },
              {
                client: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { tradingName: { contains: q, mode: 'insensitive' } },
                    { companyId: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
              {
                branch: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { code: { contains: q, mode: 'insensitive' } },
                    { city: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          },
        },
      },
    ],
  };
}

export function buildCrmOrderSearchWhere(rawQuery: string): Prisma.CrmOrderWhereInput {
  const q = normalizeSearchTerm(rawQuery);
  if (!q) return {};

  return {
    OR: [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { title: { contains: q, mode: 'insensitive' } },
      { clientOrderCode: { contains: q, mode: 'insensitive' } },
      { agencyName: { contains: q, mode: 'insensitive' } },
      { note: { contains: q, mode: 'insensitive' } },
      {
        client: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { tradingName: { contains: q, mode: 'insensitive' } },
            { companyId: { contains: q, mode: 'insensitive' } },
            { contactPerson: { contains: q, mode: 'insensitive' } },
            { billingCity: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      {
        agencyClient: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { tradingName: { contains: q, mode: 'insensitive' } },
            { companyId: { contains: q, mode: 'insensitive' } },
            { contactPerson: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      {
        branch: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } },
            { street: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
      {
        realizations: {
          some: {
            OR: [
              {
                branch: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { code: { contains: q, mode: 'insensitive' } },
                    { street: { contains: q, mode: 'insensitive' } },
                    { city: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
              {
                carrier: {
                  OR: [
                    { code: { contains: q, mode: 'insensitive' } },
                    { name: { contains: q, mode: 'insensitive' } },
                    { city: { contains: q, mode: 'insensitive' } },
                    { address: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
              {
                surface: {
                  name: { contains: q, mode: 'insensitive' },
                },
              },
            ],
          },
        },
      },
      {
        navigationOrder: {
          targets: {
            some: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
                {
                  clientBranch: {
                    OR: [
                      { name: { contains: q, mode: 'insensitive' } },
                      { code: { contains: q, mode: 'insensitive' } },
                      { city: { contains: q, mode: 'insensitive' } },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    ],
  };
}

export function buildClientBranchSearchWhere(rawQuery: string): Prisma.ClientBranchWhereInput {
  const q = normalizeSearchTerm(rawQuery);
  if (!q) return {};

  return {
    active: true,
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
      { street: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      {
        client: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { tradingName: { contains: q, mode: 'insensitive' } },
            { companyId: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
    ],
  };
}
