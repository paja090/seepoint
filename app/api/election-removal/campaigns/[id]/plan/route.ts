import { NextResponse } from 'next/server';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import {
  loadElectionPlanningResources,
  optimizeElectionRemovalRoutes,
  type PlanRoutesPayload,
} from '@/lib/election-removal/planning';

export const runtime = 'nodejs';

/**
 * GET /api/election-removal/campaigns/[id]/plan
 * Vrací dostupné zdroje pro plánování tras (body k demontáži, pracovníci, vozidla).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  const { id } = await params;

  try {
    const resources = await loadElectionPlanningResources(id);
    return NextResponse.json({ success: true, resources });
  } catch (error: unknown) {
    console.error('Chyba při načítání plánovacích zdrojů:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Nepodařilo se načíst zdroje pro plánování.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/election-removal/campaigns/[id]/plan
 * Spustí optimalizační plánovací engine pro body dané volební kampaně a zadané posádky.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  const { id } = await params;

  try {
    const payload = (await req.json()) as PlanRoutesPayload;

    if (!payload.date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
      return NextResponse.json(
        { error: 'Zadejte platné datum plánování ve formátu RRRR-MM-DD.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(payload.crews) || payload.crews.length === 0) {
      return NextResponse.json(
        { error: 'Zadejte alespoň jednu pracovní posádku.' },
        { status: 400 }
      );
    }

    const { input, result } = await optimizeElectionRemovalRoutes(id, payload);

    return NextResponse.json({
      success: true,
      planningInput: input,
      planningResult: result,
    });
  } catch (error: unknown) {
    console.error('Chyba při výpočtu plánu tras:', error);
    const message =
      error instanceof Error ? error.message : 'Nepodařilo se optimalizovat trasy.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
