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
 * Odstranění nebo archivace volební kampaně / terénní práce.
 * Fotografie zůstávají vždy bezpečně zachovány na disku i v databázi.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireElectionRemovalAccess(true);
  if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get('permanent') === 'true';

  try {
    await plannerTransaction(async (tx) => {
      // 1. Zrušit aktivní, schválené a rozpracované výjezdy vázané na tuto kampaň
      await tx.fieldPlan.updateMany({
        where: {
          organizationId: auth.organizationId,
          electionCampaignId: id,
          status: { in: ['DRAFT', 'APPROVED', 'ACTIVE'] },
        },
        data: { status: 'CANCELLED' },
      });

      if (permanent) {
        // Získat ID všech bodů kampaně pro bezpečné odpojení fotek
        const campaignPoints = await tx.electionRemovalPoint.findMany({
          where: { campaignId: id, organizationId: auth.organizationId },
          select: { id: true },
        });
        const pointIds = campaignPoints.map((p) => p.id);

        if (pointIds.length > 0) {
          // Zjistit kroky pro odpojení fotek vázaných na kroky
          const campaignSteps = await tx.fieldWorkStep.findMany({
            where: { pointId: { in: pointIds }, organizationId: auth.organizationId },
            select: { id: true },
          });
          const stepIds = campaignSteps.map((s) => s.id);

          // Bezpečně odpojit vazbu fotek na kampaň a kroky:
          // Soubory na disku / disku Google a záznamy Photo zůstávají zachovány!
          await tx.photo.updateMany({
            where: {
              organizationId: auth.organizationId,
              OR: [
                { electionRemovalPointId: { in: pointIds } },
                ...(stepIds.length > 0 ? [{ fieldWorkStepId: { in: stepIds } }] : []),
              ],
            },
            data: {
              electionRemovalPointId: null,
              fieldWorkStepId: null,
            },
          });

          // Smazat kroky
          await tx.fieldWorkStep.deleteMany({
            where: { pointId: { in: pointIds }, organizationId: auth.organizationId },
          });

          // Smazat body kampaně
          await tx.electionRemovalPoint.deleteMany({
            where: { id: { in: pointIds }, organizationId: auth.organizationId },
          });
        }

        // Smazat plány výjezdů vázané na kampaň
        await tx.fieldPlan.deleteMany({
          where: { electionCampaignId: id, organizationId: auth.organizationId },
        });

        // Smazat samotnou kampaň
        const deleted = await tx.electionCampaign.deleteMany({
          where: { id, organizationId: auth.organizationId },
        });

        if (deleted.count) {
          await tx.crmAuditLog.create({
            data: {
              organizationId: auth.organizationId,
              entityType: 'ElectionCampaign',
              entityId: id,
              userId: auth.user.id,
              userEmail: auth.user.email,
              action: 'FIELD_ACTION_DELETED',
              detailsJson: JSON.stringify({ permanent: true }),
            },
          });
        }
      } else {
        // Standardní archivace
        const changed = await tx.electionCampaign.updateMany({
          where: { id, organizationId: auth.organizationId, status: { not: 'ARCHIVED' } },
          data: { status: 'ARCHIVED' },
        });

        if (changed.count) {
          await tx.crmAuditLog.create({
            data: {
              organizationId: auth.organizationId,
              entityType: 'ElectionCampaign',
              entityId: id,
              userId: auth.user.id,
              userEmail: auth.user.email,
              action: 'FIELD_ACTION_ARCHIVED',
              detailsJson: '{}',
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true, permanent });
  } catch (e) {
    console.error('Chyba při mazání / archivaci kampaně:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Smazání akce selhalo.' },
      { status: 409 }
    );
  }
}

