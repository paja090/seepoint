import { prisma } from '../lib/db';
import { enterTenantContext } from '../lib/tenant-context';

enterTenantContext({ organizationId: process.env.ORGANIZATION_ID ?? 'org_seepoint_default', source: 'script' });

export async function runNavigationAuditReport() {
  const navigationCarriers = await prisma.advertisingCarrier.findMany({
    where: { type: 'NAVIGATION' },
    select: { id: true, _count: { select: { surfaces: true } } },
  });

  const carriersWithoutSurfaces = navigationCarriers.filter((c) => c._count.surfaces === 0).length;
  const carriersWithOneSurface = navigationCarriers.filter((c) => c._count.surfaces === 1).length;
  const carriersWithMultiSurfaces = navigationCarriers.filter((c) => c._count.surfaces > 1).length;

  const [
    navigationCarriersCount,
    otherCarriersWithNavSignsCount,
    surfacesWithoutClient,
    surfacesWithClientNoOccupancy,
    surfacesOccupiedNoClient,
    surfacesWithMultiActiveOccupancies,
    surfacesWithoutDirection,
    surfacesWithoutDestination,
    surfacesWithoutDistance,
    carriersWithoutStructureCode,
    carriersWithUnknownMounting,
  ] = await Promise.all([
    prisma.advertisingCarrier.count({ where: { type: 'NAVIGATION' } }),
    prisma.advertisingCarrier.count({
      where: {
        type: 'OTHER',
        surfaces: { some: { mediaType: 'NAVIGATION_SIGN' } },
      },
    }),
    prisma.advertisingSurface.count({
      where: { mediaType: 'NAVIGATION_SIGN', currentClientId: null },
    }),
    prisma.advertisingSurface.count({
      where: {
        mediaType: 'NAVIGATION_SIGN',
        currentClientId: { not: null },
        occupancies: { none: { status: { in: ['OCCUPIED', 'RESERVED'] } } },
      },
    }),
    prisma.advertisingSurface.count({
      where: {
        mediaType: 'NAVIGATION_SIGN',
        status: 'OCCUPIED',
        currentClientId: null,
      },
    }),
    prisma.advertisingSurface.count({
      where: {
        mediaType: 'NAVIGATION_SIGN',
        occupancies: { some: { status: 'OCCUPIED' } },
      },
    }),
    prisma.advertisingSurface.count({
      where: {
        mediaType: 'NAVIGATION_SIGN',
        OR: [{ directionDescription: null }, { directionDescription: '' }],
      },
    }),
    prisma.advertisingSurface.count({
      where: {
        mediaType: 'NAVIGATION_SIGN',
        OR: [{ destinationName: null }, { destinationName: '' }],
      },
    }),
    prisma.advertisingSurface.count({
      where: {
        mediaType: 'NAVIGATION_SIGN',
        distanceMeters: null,
      },
    }),
    prisma.advertisingCarrier.count({
      where: {
        type: 'NAVIGATION',
        OR: [{ structureCode: null }, { structureCode: '' }],
      },
    }),
    prisma.advertisingCarrier.count({
      where: {
        type: 'NAVIGATION',
        mountingType: 'UNKNOWN',
      },
    }),
  ]);

  return {
    navigationCarriersCount,
    otherCarriersWithNavSignsCount,
    carriersWithoutSurfaces,
    carriersWithOneSurface,
    carriersWithMultiSurfaces,
    surfacesWithoutClient,
    surfacesWithClientNoOccupancy,
    surfacesOccupiedNoClient,
    surfacesWithMultiActiveOccupancies,
    surfacesWithoutDirection,
    surfacesWithoutDestination,
    surfacesWithoutDistance,
    carriersWithoutStructureCode,
    carriersWithUnknownMounting,
  };
}

if (require.main === module) {
  runNavigationAuditReport()
    .then((report) => {
      console.log('--- READ-ONLY AUDIT REPORT NAVIGACÍ ---');
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((err) => {
      console.error('Audit failed:', err);
    });
}
