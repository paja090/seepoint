import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { normalizeClientName } from '@/lib/crm/domain';
import { Prisma } from '@prisma/client';
import { OpportunityValidationError } from '@/lib/opportunities/policy';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    let clientId = typeof body.clientId === 'string' ? body.clientId : undefined;
    if (clientId && clientId.length > 80) throw new OpportunityValidationError('Neplatný identifikátor klienta.');

    const result = await prisma.$transaction(async (tx) => {
      const opportunity = await tx.salesOpportunity.findFirst({ where: { id, organizationId: user.organizationId } });
      if (!opportunity) throw new OpportunityValidationError('Příležitost nebyla nalezena.', 404);

      if (opportunity.clientId) {
        const updated = await tx.salesOpportunity.findFirstOrThrow({
          where: { id, organizationId: user.organizationId },
          include: { client: true },
        });
        return { updated, createdClient: false };
      }

      let createdClient = false;
      if (clientId) {
        const existing = await tx.client.count({ where: { id: clientId, organizationId: user.organizationId, active: true } });
        if (!existing) throw new OpportunityValidationError('Vybraný klient v aktivní organizaci neexistuje.', 404);
      } else {
        const normalizedName = normalizeClientName(opportunity.companyName);
        const existing = await tx.client.findFirst({
          where: {
            organizationId: user.organizationId,
            active: true,
            OR: [
              { normalizedName },
              ...(opportunity.companyId ? [{ companyId: opportunity.companyId }] : []),
            ],
          },
          select: { id: true },
        });
        if (existing) {
          clientId = existing.id;
        } else {
          let assignedUserId = opportunity.assignedToUserId || user.id;
          const activeAssignee = await tx.organizationMember.count({
            where: { organizationId: user.organizationId, userId: assignedUserId, isActive: true },
          });
          if (!activeAssignee) assignedUserId = user.id;
          const newClient = await tx.client.create({
            data: {
              organizationId: user.organizationId,
              name: opportunity.companyName,
              normalizedName,
              companyId: opportunity.companyId || null,
              website: opportunity.website || null,
              status: 'LEAD',
              clientType: 'DIRECT_CLIENT',
              pricingSegment: 'COMMERCIAL',
              assignedUserId,
              note: `Vytvořeno ručním potvrzením z Obchodního radaru. Událost: ${opportunity.title}`,
            },
          });
          clientId = newClient.id;
          createdClient = true;
        }
      }

      await tx.salesOpportunity.updateMany({
        where: { id, organizationId: user.organizationId },
        data: {
          clientId,
          ...(opportunity.status === 'NEW' ? { status: 'REVIEWED' as const } : {}),
        },
      });
      await tx.crmAuditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          userEmail: user.email,
          action: createdClient ? 'CREATE_CLIENT_FROM_OPPORTUNITY' : 'LINK_OPPORTUNITY_TO_CLIENT',
          entityType: 'SalesOpportunity',
          entityId: id,
          detailsJson: JSON.stringify({ clientId, createdClient }),
        },
      });
      const updated = await tx.salesOpportunity.findFirstOrThrow({
        where: { id, organizationId: user.organizationId },
        include: { client: true },
      });
      return { updated, createdClient };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const updated = result.updated;
    return NextResponse.json({ item: updated, clientId: updated.clientId, createdClient: result.createdClient });
  } catch (error) {
    if (error instanceof OpportunityValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      return NextResponse.json({ error: 'Příležitost mezitím změnil jiný uživatel. Obnovte stránku a zkuste to znovu.' }, { status: 409 });
    }
    console.error('Failed to link opportunity to CRM client', error);
    return NextResponse.json({ error: 'Propojení s CRM se nepodařilo.' }, { status: 500 });
  }
}
