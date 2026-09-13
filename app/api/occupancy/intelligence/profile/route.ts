import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import {
  getOrganizationOccupancyProfile,
  saveOrganizationOccupancyProfile,
} from '@/lib/occupancy/intelligence-profile';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || !canAccess(user.role, 'occupancy')) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  try {
    const profile = await getOrganizationOccupancyProfile(user.organizationId);
    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Occupancy Intelligence Profile GET Error]:', error);
    return NextResponse.json({ error: 'Načtení profilu selhalo.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || (!['ADMIN', 'MANAGER', 'SALES'].includes(user.role) && !canAccess(user.role, 'aiOccupancy'))) {
    return NextResponse.json({ error: 'Úpravu profilu může provádět pouze administrátor nebo manažer.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updated = await saveOrganizationOccupancyProfile(user.organizationId, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[Occupancy Intelligence Profile PUT Error]:', error);
    return NextResponse.json({ error: 'Uložení profilu selhalo.' }, { status: 500 });
  }
}
