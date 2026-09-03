import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { CityGalleryValidationError, parseCityGalleryFleetInput } from '@/lib/city-gallery-policy';
import { ConcurrencyError, runTransactionWithRetry } from '@/lib/transaction-retry';
import { tenantSingletonId } from '@/lib/tenant-singleton';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireApiAccess('cityGallery');
  if (isApiDenied(auth)) return auth;
  if (!auth.organizationId) return NextResponse.json({ error: 'Není vybraná aktivní organizace.' }, { status: 403 });
  if (auth.role !== 'ADMIN' && auth.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Fond nosičů může upravovat pouze administrátor nebo manažer.' }, { status: 403 });
  }
  try {
    const input = parseCityGalleryFleetInput(await request.json().catch(() => null));
    const id = tenantSingletonId('city-gallery-fleet', auth.organizationId);
    const fleetConfig = await runTransactionWithRetry(async (tx) => {
      const activeProjects = await tx.cityGalleryProject.findMany({
        where: { organizationId: auth.organizationId, status: 'ACTIVE' },
        select: { frameCount: true },
      });
      const occupiedFrames = activeProjects.reduce((sum, project) => sum + project.frameCount, 0);
      if (occupiedFrames + input.maintenanceCount > input.totalFrames) {
        throw new CityGalleryValidationError(
          `Fond nelze snížit: ${occupiedFrames} nosičů je aktivních a ${input.maintenanceCount} je v údržbě.`,
          'INSUFFICIENT_CAPACITY',
        );
      }
      return tx.cityGalleryFleetConfig.upsert({
        where: { id },
        update: input,
        create: { id, organizationId: auth.organizationId!, ...input },
      });
    });
    return NextResponse.json({ ok: true, fleetConfig });
  } catch (error) {
    if (error instanceof CityGalleryValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    if (error instanceof ConcurrencyError) {
      return NextResponse.json({ error: error.message, code: 'CAPACITY_CONFLICT' }, { status: 409 });
    }
    console.error('Chyba při ukládání fondu nosičů.', error);
    return NextResponse.json({ error: 'Chyba při ukládání fondu nosičů.' }, { status: 500 });
  }
}
