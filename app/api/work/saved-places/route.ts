import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import {
  getOrganizationSavedPlaces,
  upsertOrganizationSavedPlace,
  deleteOrganizationSavedPlace,
} from '@/lib/saved-places-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireApiAccess('work');
    if (isApiDenied(user)) return user;
    const organizationId = user.organizationId!;
    enterTenantContext({ organizationId, userId: user.id, source: 'session' });

    const places = await getOrganizationSavedPlaces(organizationId);
    return NextResponse.json({ ok: true, places });
  } catch (error) {
    console.error('[api/work/saved-places GET] Error:', error);
    return NextResponse.json({ error: 'Nepodařilo se načíst uložená místa.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiAccess('work');
    if (isApiDenied(user)) return user;
    const organizationId = user.organizationId!;
    enterTenantContext({ organizationId, userId: user.id, source: 'session' });

    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      address?: string;
      latitude?: number | null;
      longitude?: number | null;
      contactName?: string;
      contactPhone?: string;
      openingHours?: string;
      website?: string;
      accessNote?: string;
    };

    const places = await upsertOrganizationSavedPlace(organizationId, {
      id: body.id,
      name: body.name || '',
      address: body.address || '',
      latitude: typeof body.latitude === 'number' && Number.isFinite(body.latitude) ? body.latitude : null,
      longitude: typeof body.longitude === 'number' && Number.isFinite(body.longitude) ? body.longitude : null,
      contactName: body.contactName,
      contactPhone: body.contactPhone,
      openingHours: body.openingHours,
      website: body.website,
      accessNote: body.accessNote,
    });

    return NextResponse.json({ ok: true, places });
  } catch (error) {
    console.error('[api/work/saved-places POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepodařilo se uložit místo.' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireApiAccess('work');
    if (isApiDenied(user)) return user;
    const organizationId = user.organizationId!;
    enterTenantContext({ organizationId, userId: user.id, source: 'session' });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    if (!id) {
      return NextResponse.json({ error: 'Chybí ID místa.' }, { status: 400 });
    }

    const places = await deleteOrganizationSavedPlace(organizationId, id);
    return NextResponse.json({ ok: true, places });
  } catch (error) {
    console.error('[api/work/saved-places DELETE] Error:', error);
    return NextResponse.json({ error: 'Nepodařilo se odstranit uložené místo.' }, { status: 500 });
  }
}
