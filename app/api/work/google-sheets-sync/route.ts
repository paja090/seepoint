import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import {
  syncGooglePlanToWorkOrders,
  DEFAULT_GOOGLE_PLAN_SHEET_CSV_URL,
  isSeePointOrganization,
} from '@/lib/work/google-sheets-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await requireApiAccess(['work', 'tasks']);
    if (isApiDenied(user)) return user;
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Uživatel nemá aktivní organizaci.' }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, name: true, slug: true },
    });
    const isSeePoint = isSeePointOrganization(org);

    return NextResponse.json({
      ok: true,
      isSeePoint,
      defaultCsvUrl: isSeePoint ? DEFAULT_GOOGLE_PLAN_SHEET_CSV_URL : null,
      organizationId: user.organizationId,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Chyba při zjišťování stavu synchronizace.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiAccess(['work', 'tasks']);
    if (isApiDenied(user)) return user;
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Uživatel nemá aktivní organizaci.' }, { status: 403 });
    }

    const organizationId = user.organizationId;
    enterTenantContext({ organizationId, userId: user.id, source: 'session' });

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });
    const isSeePoint = isSeePointOrganization(org);

    let body: { csvUrl?: string; csvContent?: string; defaultYear?: number } = {};
    try {
      body = (await request.json().catch(() => ({}))) as typeof body;
    } catch {
      body = {};
    }

    const targetCsvUrl = body.csvUrl?.trim();
    if (!targetCsvUrl && !isSeePoint) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Tato centrální Google Tabulka plánu práce je určena výhradně pro agenturu SeePOINT s.r.o. a nelze ji importovat do jiné agentury.',
        },
        { status: 403 }
      );
    }

    const result = await syncGooglePlanToWorkOrders({
      organizationId,
      csvUrl: targetCsvUrl || undefined,
      csvContent: body.csvContent,
      defaultYear: body.defaultYear || 2026,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      message: `Synchronizace dokončena: ${result.createdCount} vytvořeno, ${result.updatedCount} aktualizováno ze ${result.totalParsed} řádků.`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[api/work/google-sheets-sync] error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Nastala chyba při synchronizaci plánu práce z Google Tabulky.',
      },
      { status: 500 }
    );
  }
}
