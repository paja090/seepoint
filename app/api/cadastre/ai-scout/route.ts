import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getTenantContext, enterTenantContext } from '@/lib/tenant-context';
import {
  scoutAdvertisingLocationsAi,
  analyzePlotAdvertisingPotentialAi,
} from '@/lib/cadastre/ai-land-scout';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Neautorizovaný přístup' }, { status: 401 });
    }

    const tenant = getTenantContext();
    const orgId = user.organizationId || tenant?.organizationId;
    if (orgId) {
      enterTenantContext({
        organizationId: orgId,
        userId: user.id,
        source: 'session',
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'scout') {
      const { cityOrArea, preferredFocus } = body;
      if (!cityOrArea || typeof cityOrArea !== 'string') {
        return NextResponse.json({ error: 'Zadejte město nebo oblast.' }, { status: 400 });
      }

      const locations = await scoutAdvertisingLocationsAi(cityOrArea, preferredFocus);
      return NextResponse.json({ success: true, locations });
    }

    if (action === 'analyze') {
      const { plot } = body;
      if (!plot || typeof plot.latitude !== 'number' || typeof plot.longitude !== 'number') {
        return NextResponse.json({ error: 'Chybí parametry pozemku s GPS souřadnicemi.' }, { status: 400 });
      }

      const analysis = await analyzePlotAdvertisingPotentialAi(plot);
      return NextResponse.json({ success: true, analysis });
    }

    return NextResponse.json({ error: 'Neznámá akce' }, { status: 400 });
  } catch (error) {
    console.error('[API/cadastre/ai-scout] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chyba AI radaru pozemků' },
      { status: 500 }
    );
  }
}
