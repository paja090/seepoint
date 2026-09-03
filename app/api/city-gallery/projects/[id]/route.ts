import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import {
  assertCityGalleryActivation,
  assertCityGalleryStatusTransition,
  CityGalleryValidationError,
  parseCityGalleryProjectStatus,
} from '@/lib/city-gallery-policy';
import { ConcurrencyError, runTransactionWithRetry } from '@/lib/transaction-retry';
import { tenantSingletonId } from '@/lib/tenant-singleton';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('cityGallery');
  if (isApiDenied(auth)) return auth;
  if (!auth.organizationId) return NextResponse.json({ error: 'Není vybraná aktivní organizace.' }, { status: 403 });
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) throw new CityGalleryValidationError('Data změny projektu nejsou platná.');
    const nextStatus = parseCityGalleryProjectStatus(body.status);
    const { id } = await params;
    const singletonId = tenantSingletonId('city-gallery-fleet', auth.organizationId);
    const project = await runTransactionWithRetry(async (tx) => {
      const current = await tx.cityGalleryProject.findFirst({
        where: { id, organizationId: auth.organizationId },
      });
      if (!current) throw new CityGalleryValidationError('Projekt Galerie venku nebyl nalezen.', 'NOT_FOUND');
      assertCityGalleryStatusTransition(current.status, nextStatus);
      if (nextStatus === 'ACTIVE') {
        assertCityGalleryActivation(current);
        if (current.status !== 'ACTIVE') {
          const [fleetConfig, activeProjects] = await Promise.all([
            tx.cityGalleryFleetConfig.findFirst({ where: { id: singletonId, organizationId: auth.organizationId } }),
            tx.cityGalleryProject.findMany({
              where: { organizationId: auth.organizationId, status: 'ACTIVE', id: { not: current.id } },
              select: { frameCount: true },
            }),
          ]);
          const available = (fleetConfig?.totalFrames ?? 24)
            - (fleetConfig?.maintenanceCount ?? 0)
            - activeProjects.reduce((sum, active) => sum + active.frameCount, 0);
          if (current.frameCount > available) {
            throw new CityGalleryValidationError(
              `Projekt potřebuje ${current.frameCount} nosičů, ale volných je pouze ${Math.max(0, available)}.`,
              'INSUFFICIENT_CAPACITY',
            );
          }
        }
      }
      return tx.cityGalleryProject.update({ where: { id: current.id }, data: { status: nextStatus } });
    });
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    if (error instanceof CityGalleryValidationError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'INVALID_STATUS_TRANSITION' ? 409 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    if (error instanceof ConcurrencyError) {
      return NextResponse.json({ error: error.message, code: 'CAPACITY_CONFLICT' }, { status: 409 });
    }
    console.error('Chyba při změně stavu projektu Galerie venku.', error);
    return NextResponse.json({ error: 'Chyba při změně stavu projektu Galerie venku.' }, { status: 500 });
  }
}
