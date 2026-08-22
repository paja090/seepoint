import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { createOpportunity } from '@/lib/opportunities/service';

export const runtime = 'nodejs';

/**
 * Scheduled Discovery Job Framework Endpoint
 * 
 * Flow:
 * 1. Discovery/Import (from RSS/Web Signals/APIs)
 * 2. Normalization
 * 3. Deduplication check
 * 4. Opportunity Scoring
 * 5. Saves in status 'NEW' for Human Approval
 */
export async function POST(request: Request) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const body = await request.json().catch(() => ({}));
    const rawSignals = Array.isArray(body.signals) ? body.signals : [];

    let importedCount = 0;
    let duplicateCount = 0;

    for (const signal of rawSignals) {
      if (!signal.companyName || !signal.title || !signal.city) continue;

      const result = await createOpportunity({
        companyName: signal.companyName,
        companyId: signal.companyId,
        website: signal.website,
        eventType: signal.eventType || 'NEW_BRANCH',
        title: signal.title,
        summary: signal.summary || signal.title,
        city: signal.city,
        region: signal.region || 'Moravskoslezský kraj',
        address: signal.address,
        eventDate: signal.eventDate,
        sourceUrl: signal.sourceUrl || 'https://seepoint.cz',
        sourceTitle: signal.sourceTitle || 'Automatický radarový import',
        suggestedMediaTypes: signal.suggestedMediaTypes,
      });

      if (result.created) {
        importedCount++;
      } else {
        duplicateCount++;
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      duplicateCount,
      totalProcessed: rawSignals.length,
    });
  } catch (error) {
    console.error('Scheduled discovery import error', error);
    return NextResponse.json({ error: 'Import příležitostí selhal.' }, { status: 500 });
  }
}
