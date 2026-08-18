import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireApiAccess('navigationDocumentation');
  if (isApiDenied(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId')?.trim();

  if (!clientId) {
    return NextResponse.json([]);
  }

  const citiesSet = new Set<string>();

  // 1. Extract cities from NavigationPoints for this client
  const points = await prisma.navigationPoint.findMany({
    where: {
      OR: [
        { navigationOrder: { crmOrder: { clientId } } },
        { navigationOffer: { offer: { clientId } } },
      ],
      status: { notIn: ['REMOVED', 'CANCELLED'] },
    },
    select: {
      address: true,
      carrier: {
        select: {
          city: true,
          address: true,
        },
      },
    },
  });

  for (const pt of points) {
    if (pt.carrier?.city) {
      citiesSet.add(pt.carrier.city.trim());
    }
    if (pt.address) {
      const parts = pt.address.split(/[,·-]/);
      if (parts.length > 0 && parts[0].trim().length > 2) {
        citiesSet.add(parts[0].trim());
      }
    }
  }

  // 2. Extract cities from AdvertisingCarriers occupied by this client
  const carriers = await prisma.advertisingCarrier.findMany({
    where: {
      archivedAt: null,
      surfaces: {
        some: {
          OR: [
            { currentClientId: clientId },
            { occupancies: { some: { clientId } } },
          ],
        },
      },
    },
    select: {
      city: true,
      address: true,
    },
  });

  for (const c of carriers) {
    if (c.city) {
      citiesSet.add(c.city.trim());
    }
  }

  const sortedCities = Array.from(citiesSet)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'cs-CZ'));

  return NextResponse.json(sortedCities);
}
