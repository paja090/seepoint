import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { cleanExpiredOccupancies } from '@/lib/occupancy/intelligence-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || !canAccess(user.role, 'occupancy')) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  try {
    const result = await cleanExpiredOccupancies(user.organizationId, user);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Occupancy Intelligence Clean Expired Error]:', error);
    return NextResponse.json(
      {
        error: 'Uzavření prošlých kampaní selhalo.',
        details: error instanceof Error ? error.message : 'Neznámá chyba',
      },
      { status: 500 }
    );
  }
}
