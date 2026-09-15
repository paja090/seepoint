import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { executeStop } from '@/lib/field-planning/execution';
import { uploadInstallationPhotos } from '@/lib/navigation/installation-photo-upload';
import { enforcePhotoUploadRateLimit } from '@/lib/rate-limit';
import { PhotoValidationError } from '@/lib/photo-validation';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const user = await requireApiAccess('myTasks', 'workRoute'); if (isApiDenied(user)) return user;
  const limited = await enforcePhotoUploadRateLimit(request, user); if (limited) return limited;
  const organizationId = user.organizationId!;
  enterTenantContext({ organizationId, userId: user.id, source: 'session' });
  try {
    const form = await request.formData();
    const input = { planId: String(form.get('planId') ?? ''), workOrderId: String(form.get('workOrderId') ?? ''), jobId: String(form.get('jobId') ?? ''), action: 'inspect' };
    // Check ownership before accepting bytes; repeat inside the installation transaction.
    const verified = await executeStop(input, user);
    if ('workOrderItemId' in verified && verified.workOrderItemId) return NextResponse.json(await uploadInstallationPhotos(form, organizationId, input.workOrderId, verified.workOrderItemId, photos => executeStop({ ...input, action: 'photo' }, user, undefined, photos)));
    if (!('navigationPointId' in verified) || !verified.navigationPointId || !verified.navigationOrderId) throw new Error('Bod není dostupný.');
    const result = await uploadInstallationPhotos(form, organizationId, verified.navigationOrderId, verified.navigationPointId,
      photos => executeStop({ ...input, action: 'photo' }, user, undefined, photos));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Nahrání selhalo.' },
      { status: error instanceof PhotoValidationError ? error.status : error instanceof Error && error.message.startsWith('FORBIDDEN') ? 403 : 409 });
  }
}
