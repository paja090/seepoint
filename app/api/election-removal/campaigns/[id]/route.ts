import { plannerTransaction } from '@/lib/field-planning/service';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import { runWithTenantContext, enterTenantContext } from '@/lib/tenant-context';

export const runtime = 'nodejs';

/**
 * GET /api/election-removal/campaigns/[id]
 * Detail kampaně včetně všech bodů a souvisejících tras/plánů.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess(true);
  if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });

  const { id } = await params;

  try {
    const campaign = await runWithTenantContext(
      { organizationId: auth.organizationId, source: 'session' },
      async () => {
        return prisma.electionCampaign.findFirst({
          where: {
            id,
            organizationId: auth.organizationId,
          },
          include: {
            points: {
              orderBy: [{ layerName: 'asc' }, { label: 'asc' }],
            },
            fieldPlans: {
              select: {
                id: true,
                date: true,
                version: true,
                status: true,
                planningSummary: true,
              },
              orderBy: { date: 'asc' },
            },
          },
        });
      }
    );

    if (!campaign) {
      return NextResponse.json(
        { error: 'Kampaň nebyla nalezena.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error: unknown) {
    console.error('Chyba při načítání detailu volební kampaně:', error);
    return NextResponse.json(
      { error: 'Nepodařilo se načíst detail kampaně.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/election-removal/campaigns/[id]
 * Odstranění volební kampaně a všech jejích bodů.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireElectionRemovalAccess(true); if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  const { id } = await params;
  try {
    await plannerTransaction(async tx => {
      if (await tx.fieldPlan.count({ where: { organizationId: auth.organizationId, electionCampaignId: id, status: { in: ['APPROVED','ACTIVE'] } } })) throw new Error('Akce obsahuje aktivní výjezdy.');
      const changed = await tx.electionCampaign.updateMany({ where: { id, organizationId: auth.organizationId, status: { not: 'ARCHIVED' } }, data: { status: 'ARCHIVED' } });
      if (changed.count) await tx.crmAuditLog.create({ data: { organizationId: auth.organizationId, entityType: 'ElectionCampaign', entityId: id, userId: auth.user.id, userEmail: auth.user.email, action: 'FIELD_ACTION_ARCHIVED', detailsJson: '{}' } });
    });
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Archivace selhala.' }, { status: 409 }); }
}
