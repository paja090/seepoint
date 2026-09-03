import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { CityGalleryValidationError, parseCityGalleryProjectInput } from '@/lib/city-gallery-policy';
import { ConcurrencyError, runTransactionWithRetry } from '@/lib/transaction-retry';
import { prisma } from '@/lib/db';
import { tenantSingletonId } from '@/lib/tenant-singleton';

export const dynamic = 'force-dynamic';

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof CityGalleryValidationError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
  }
  if (error instanceof ConcurrencyError) {
    return NextResponse.json({ error: error.message, code: 'CAPACITY_CONFLICT' }, { status: 409 });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  const auth = await requireApiAccess('cityGallery');
  if (isApiDenied(auth)) return auth;
  if (!auth.organizationId) return NextResponse.json({ error: 'Není vybraná aktivní organizace.' }, { status: 403 });
  try {
    const [projects, fleetConfig] = await Promise.all([
      prisma.cityGalleryProject.findMany({
        where: { organizationId: auth.organizationId },
        include: { _count: { select: { offers: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.cityGalleryFleetConfig.findFirst({
        where: { id: tenantSingletonId('city-gallery-fleet', auth.organizationId), organizationId: auth.organizationId },
      }),
    ]);
    const totalFleet = fleetConfig?.totalFrames ?? 24;
    const maintenanceCount = fleetConfig?.maintenanceCount ?? 0;
    const occupiedFrames = projects
      .filter((project) => project.status === 'ACTIVE')
      .reduce((sum, project) => sum + project.frameCount, 0);
    return NextResponse.json({
      fleet: {
        totalFleet,
        occupiedFrames,
        availableFrames: Math.max(0, totalFleet - occupiedFrames - maintenanceCount),
        maintenanceCount,
      },
      projects,
    });
  } catch (error) {
    return errorResponse(error, 'Chyba při načítání projektů Galerie venku.');
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAccess('cityGallery');
  if (isApiDenied(auth)) return auth;
  if (!auth.organizationId) return NextResponse.json({ error: 'Není vybraná aktivní organizace.' }, { status: 403 });
  try {
    const input = parseCityGalleryProjectInput(await request.json().catch(() => null));
    const singletonId = tenantSingletonId('city-gallery-fleet', auth.organizationId);
    const project = await runTransactionWithRetry(async (tx) => {
      const [fleetConfig, activeProjects] = await Promise.all([
        tx.cityGalleryFleetConfig.findFirst({ where: { id: singletonId, organizationId: auth.organizationId } }),
        tx.cityGalleryProject.findMany({
          where: { organizationId: auth.organizationId, status: 'ACTIVE' },
          select: { frameCount: true },
        }),
      ]);
      const totalFleet = fleetConfig?.totalFrames ?? 24;
      const occupiedFrames = activeProjects.reduce((sum, active) => sum + active.frameCount, 0);
      const availableFrames = totalFleet - occupiedFrames - (fleetConfig?.maintenanceCount ?? 0);
      if (input.status === 'ACTIVE' && input.frameCount > availableFrames) {
        throw new CityGalleryValidationError(
          `Nedostatek volných nosičů. Požadováno ${input.frameCount} ks, k dispozici ${Math.max(0, availableFrames)} ks.`,
          'INSUFFICIENT_CAPACITY',
        );
      }
      return tx.cityGalleryProject.create({ data: { ...input, organizationId: auth.organizationId! } });
    });
    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Chyba při vytváření projektu Galerie venku.');
  }
}
