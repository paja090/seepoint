import { uploadInstallationPhotos } from '@/lib/navigation/installation-photo-upload';
import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { attachPointInstallationPhotos, NavigationServiceError } from '@/lib/navigation/navigation-service';
import { PhotoValidationError } from '@/lib/photo-validation';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireApiAccess('navigationProjects');
  if (isApiDenied(authResult)) return authResult;
  const limited = await enforcePhotoUploadRateLimit(req, authResult);
  if (limited) return limited;
  const organizationId = authResult.organizationId || authResult.membership?.organizationId;
  if (!organizationId) return NextResponse.json({ error: 'Nebyla nalezena organizace pro uložení fotografie.' }, { status: 400 });
  enterTenantContext({ organizationId, userId: authResult.id, source: 'session' });

  try {
    const navigationOrderId = (await params).id;
    const form = await req.formData();
    const navigationPointId = String(form.get('navigationPointId') ?? '');
    if (!navigationPointId) return NextResponse.json({ error: 'Chybí navigační bod.' }, { status: 400 });

    const result = await uploadInstallationPhotos(form, organizationId, navigationOrderId, navigationPointId, photos =>
      attachPointInstallationPhotos(navigationOrderId, navigationPointId, photos, { userId: authResult.id, userName: authResult.name || authResult.email }));
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    if (err instanceof PhotoValidationError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    if (err instanceof NavigationServiceError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === 'NOT_FOUND' ? 404 : 400 });
    console.error('[navigation/photo] Uložení montážní fotografie selhalo', err);
    return NextResponse.json({ error: 'Fotografii realizace se nepodařilo uložit.' }, { status: 502 });
  }
}
