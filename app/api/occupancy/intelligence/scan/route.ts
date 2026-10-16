import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { runOccupancyAudit } from '@/lib/occupancy/intelligence-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.organizationId || !canAccess(user.role, 'occupancy')) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  try {
    let enrichWithAi = false;
    try {
      const body = await request.json();
      enrichWithAi = Boolean(body?.enrichWithAi);
    } catch {
      // Body is optional
    }

    const summary = await runOccupancyAudit(user.organizationId, {
      userId: user.id,
      enrichWithAi,
    });

    const enhancedSummary = {
      ...summary,
      surfacesCount: summary.checkedSurfaces,
      createdCount: summary.newInsights,
      autoResolvedCount: summary.autoResolvedInsights,
    };

    const collisionText = summary.critical > 0 ? `${summary.critical} kritických kolizí` : 'žádné kolize';
    const message = `Audit obsazenosti dokončen: zkontrolováno ${summary.checkedSurfaces} ploch a ${summary.checkedOccupancies} záznamů obsazenosti. Nalezeno ${summary.openInsights} podnětů k řešení (${collisionText}, ${summary.high} neshod stavu).`;

    return NextResponse.json({
      success: true,
      summary: enhancedSummary,
      message,
    });
  } catch (error) {
    console.error('[Occupancy Intelligence Scan Error]:', error);
    return NextResponse.json(
      { error: 'Běh kontroly obsazenosti selhal.', details: error instanceof Error ? error.message : 'Neznámá chyba' },
      { status: 500 }
    );
  }
}
