import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import {
  syncGoogleSalesToCrm,
  getGoogleSalesSheetSummary,
  DEFAULT_GOOGLE_SALES_SHEET_CSV_URL,
} from '@/lib/sales/google-sales-sync';
import { isSeePointOrganization } from '@/lib/work/google-sheets-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await requireApiAccess(['clients', 'work', 'tasks', 'planner']);
    if (isApiDenied(user)) return user;
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Uživatel nemá aktivní organizaci.' }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, name: true, slug: true, plannerDefaults: true },
    });
    const isSeePoint = isSeePointOrganization(org);

    const summary = await getGoogleSalesSheetSummary(user.organizationId);

    return NextResponse.json({
      ok: true,
      isSeePoint,
      defaultCsvUrl: isSeePoint ? DEFAULT_GOOGLE_SALES_SHEET_CSV_URL : null,
      organizationId: user.organizationId,
      summary,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { ok: false, error: err.message || 'Chyba při zjišťování stavu zakázek obchodníků.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiAccess(['clients', 'work', 'tasks', 'planner']);
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

    let body: { sheetUrl?: string; csvContent?: string; defaultYear?: number } = {};
    try {
      body = (await request.json().catch(() => ({}))) as typeof body;
    } catch {
      body = {};
    }

    const targetSheetUrl = body.sheetUrl?.trim();
    if (!targetSheetUrl && !isSeePoint) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Tato centrální Google Tabulka obchodníků je určena výhradně pro agenturu SeePOINT s.r.o. a nelze ji importovat do jiné agentury.',
        },
        { status: 403 }
      );
    }

    const result = await syncGoogleSalesToCrm({
      organizationId,
      sheetUrl: targetSheetUrl || undefined,
      csvContent: body.csvContent,
      defaultYear: body.defaultYear || 2026,
    });

    const summary = await getGoogleSalesSheetSummary(organizationId);

    return NextResponse.json({
      ok: true,
      ...result,
      summary,
      message: `Synchronizace obchodníků dokončena: ${result.createdOrdersCount} nových zakázek, ${result.updatedOrdersCount} aktualizováno, ${result.createdClientsCount} nových klientů ze ${result.totalParsed} řádků tabulky.`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[api/sales/google-sheets/sync] error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Nastala chyba při synchronizaci zakázek obchodníků z Google Tabulky.',
      },
      { status: 500 }
    );
  }
}
