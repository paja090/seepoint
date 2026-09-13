import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { runOccupancyAudit } from '@/lib/occupancy/intelligence-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || !canAccess(user.role, 'occupancy')) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  try {
    const summary = await runOccupancyAudit(user.organizationId, {
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      summary,
      message: `Audit obsazenosti dokončen. Zkontrolováno ${summary.checkedSurfaces} ploch a nalezeno ${summary.openInsights} podnětů k řešení.`,
    });
  } catch (error) {
    console.error('[Occupancy Intelligence Scan Error]:', error);
    return NextResponse.json(
      { error: 'Běh kontroly obsazenosti selhal.', details: error instanceof Error ? error.message : 'Neznámá chyba' },
      { status: 500 }
    );
  }
}
