import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { plannerTransaction } from '@/lib/field-planning/service';

/**
 * PATCH /api/election-removal/points/status
 * Ruční označení bodů zakázky jako HOTOVO nebo PENDING z PC (dispečink / manažer).
 * Funguje i pro body již zařazené v naplánovaných trasách.
 */
export async function PATCH(req: Request) {
  const auth = await requireElectionRemovalAccess(true);
  if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });

  try {
    const body = await req.json();
    const pointIds = Array.isArray(body.pointIds) ? body.pointIds : (body.pointId ? [body.pointId] : []);
    const targetStatus = body.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING';

    if (!pointIds.length || pointIds.length > 500) {
      throw new Error('Vyberte 1 až 500 bodů pro změnu stavu.');
    }

    await plannerTransaction(async (tx) => {
      const points = await tx.electionRemovalPoint.findMany({
        where: { id: { in: pointIds }, organizationId: auth.organizationId },
        select: { id: true, campaignId: true, quantity: true },
      });

      if (!points.length) {
        throw new Error('Nebyly nalezeny žádné body.');
      }

      const campaignIds = Array.from(new Set(points.map((p) => p.campaignId)));

      if (targetStatus === 'COMPLETED') {
        const now = new Date();

        // 1. Označit body jako hotové
        await tx.electionRemovalPoint.updateMany({
          where: { id: { in: pointIds }, organizationId: auth.organizationId },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            completedByUserId: auth.user.id,
          },
        });

        // 2. Označit všechny kroky daných bodů jako hotové
        const steps = await tx.fieldWorkStep.findMany({
          where: { pointId: { in: pointIds }, organizationId: auth.organizationId },
          select: { id: true, quantity: true },
        });

        for (const step of steps) {
          await tx.fieldWorkStep.update({
            where: { id: step.id },
            data: {
              status: 'COMPLETED',
              completedQuantity: step.quantity,
              completedAt: now,
            },
          });
        }
      } else {
        // Vrácení bodu zpět k rozpracování / čekající
        await tx.electionRemovalPoint.updateMany({
          where: { id: { in: pointIds }, organizationId: auth.organizationId },
          data: {
            status: 'PENDING',
            completedAt: null,
            completedByUserId: null,
          },
        });

        // Vrátit kroky zpět podle toho, zda mají přiřazený výjezd
        const steps = await tx.fieldWorkStep.findMany({
          where: { pointId: { in: pointIds }, organizationId: auth.organizationId },
          select: { id: true, assignedFieldPlanId: true },
        });

        for (const step of steps) {
          await tx.fieldWorkStep.update({
            where: { id: step.id },
            data: {
              status: step.assignedFieldPlanId ? 'ASSIGNED' : 'PENDING',
              completedQuantity: 0,
              completedAt: null,
            },
          });
        }
      }

      // 3. Přepočítat completedPoints na dotčených kampaních
      for (const campaignId of campaignIds) {
        const completedCount = await tx.electionRemovalPoint.count({
          where: { campaignId, organizationId: auth.organizationId, status: 'COMPLETED' },
        });

        await tx.electionCampaign.update({
          where: { id: campaignId, organizationId: auth.organizationId },
          data: { completedPoints: completedCount },
        });
      }

      // 4. Auditní záznam
      for (const pt of points) {
        await tx.crmAuditLog.create({
          data: {
            organizationId: auth.organizationId,
            entityType: 'ElectionRemovalPoint',
            entityId: pt.id,
            userId: auth.user.id,
            userEmail: auth.user.email,
            action: targetStatus === 'COMPLETED' ? 'FIELD_TASK_MANUAL_COMPLETED' : 'FIELD_TASK_MANUAL_RESET',
            detailsJson: JSON.stringify({ manual: true, status: targetStatus }),
          },
        });
      }
    });

    return NextResponse.json({ success: true, count: pointIds.length, status: targetStatus });
  } catch (e) {
    console.error('Chyba při ruční změně stavu bodu:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Změna stavu selhala.' },
      { status: 409 }
    );
  }
}
