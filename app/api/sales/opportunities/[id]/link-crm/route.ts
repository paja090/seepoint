import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { getOpportunityById, linkOpportunityToClient } from '@/lib/opportunities/service';
import { prisma } from '@/lib/db';
import { normalizeClientName } from '@/lib/crm/domain';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const { id } = await params;
    const opportunity = await getOpportunityById(id);
    if (!opportunity) {
      return NextResponse.json({ error: 'Příležitost nebyla nalezena.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    let clientId = typeof body.clientId === 'string' ? body.clientId : undefined;

    // If no existing clientId provided, create a new lead in CRM
    if (!clientId) {
      const newClient = await prisma.client.create({
        data: {
          name: opportunity.companyName,
          normalizedName: normalizeClientName(opportunity.companyName),
          companyId: opportunity.companyId || null,
          website: opportunity.website || opportunity.sourceUrl || null,
          status: 'LEAD',
          clientType: 'DIRECT_CLIENT',
          pricingSegment: 'COMMERCIAL',
          assignedUserId: opportunity.assignedToUserId || user.id,
          note: `Vytvořeno z AI Obchodního radaru. Událost: ${opportunity.title}`,
        },
      });
      clientId = newClient.id;
    }

    const updated = await linkOpportunityToClient(id, clientId);
    return NextResponse.json({ item: updated, clientId });
  } catch (error) {
    console.error('Failed to link opportunity to CRM client', error);
    return NextResponse.json({ error: 'Propojení s CRM se nepodařilo.' }, { status: 500 });
  }
}
