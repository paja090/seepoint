import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { enterTenantContext } from '@/lib/tenant-context';
import { plannerTransaction } from '@/lib/field-planning/service';
import { parseTaskSpec, taskSteps, type Operation } from '@/lib/election-removal/task-spec';

export const runtime = 'nodejs';

interface DuplicateCampaignPayload {
  name: string;
  clientName?: string | null;
  targetDate?: string | null;
  description?: string | null;
  targetOperation?: Operation | 'KEEP';
  selectedPointIds?: string[];
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess(true);
  if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });

  const { id } = await params;

  try {
    const body = (await req.json()) as DuplicateCampaignPayload;
    const newName = body.name?.trim();
    if (!newName) {
      return NextResponse.json({ error: 'Název nové zakázky je povinný.' }, { status: 400 });
    }

    const sourceCampaign = await prisma.electionCampaign.findFirst({
      where: { id, organizationId: auth.organizationId },
      include: {
        points: {
          where: body.selectedPointIds?.length
            ? { id: { in: body.selectedPointIds } }
            : undefined,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!sourceCampaign) {
      return NextResponse.json({ error: 'Původní zakázka nebyla nalezena.' }, { status: 404 });
    }

    if (sourceCampaign.points.length === 0) {
      return NextResponse.json({ error: 'Původní zakázka neobsahuje žádné body k duplikaci.' }, { status: 400 });
    }

    const targetOp = body.targetOperation || 'KEEP';

    const newCampaign = await plannerTransaction(async (tx) => {
      const createdCampaign = await tx.electionCampaign.create({
        data: {
          organizationId: auth.organizationId,
          name: newName,
          clientName: body.clientName?.trim() || sourceCampaign.clientName,
          description: body.description !== undefined ? body.description?.trim() || null : sourceCampaign.description,
          targetDate: body.targetDate ? new Date(body.targetDate) : sourceCampaign.targetDate,
          totalPoints: sourceCampaign.points.length,
          completedPoints: 0,
          status: 'DRAFT',
        },
      });

      for (const p of sourceCampaign.points) {
        let opType = targetOp === 'KEEP' ? (p.operationType || 'INSPECTION') : targetOp;
        let matDisp = p.materialDisposition || 'LEAVE';
        let destName = p.destinationName;
        let destLat = p.destinationLatitude;
        let destLng = p.destinationLongitude;
        let reviewRequired = false;

        if (targetOp.startsWith('INSTALL')) {
          opType = targetOp;
          matDisp = 'LEAVE';
          destName = null;
          destLat = null;
          destLng = null;
        } else if (targetOp.startsWith('REMOVE')) {
          opType = targetOp;
          matDisp = 'WAREHOUSE';
        } else if (targetOp === 'RELOCATION') {
          opType = 'RELOCATION';
          matDisp = 'TRANSFER';
          if (!destLat || !destLng) reviewRequired = true;
        }

        const pointSpec = {
          label: p.label,
          description: p.description || '',
          mediaType: p.mediaType,
          objectType: p.objectType || p.mediaType,
          latitude: p.latitude,
          longitude: p.longitude,
          gpsConfirmed: true,
          quantity: p.quantity,
          operationType: opType,
          materialDisposition: matDisp,
          materialInstructions: p.materialInstructions || '',
          destinationName: destName || (matDisp === 'WAREHOUSE' ? 'Sklad' : ''),
          destinationLatitude: destLat,
          destinationLongitude: destLng,
          destinationGpsConfirmed: Boolean(destLat && destLng),
          carrierId: p.carrierId,
          surfaceId: p.surfaceId,
          referenceUrl: p.referenceUrl,
          contact: p.contact || '',
          accessInstructions: p.accessInstructions || '',
          serviceMinutes: p.serviceMinutes,
          loadSlots: p.loadSlots ?? 0,
          requiredWorkers: p.requiredWorkers,
          requiredPositions: p.requiredPositions,
          requiredEquipment: p.requiredEquipment,
        };

        const createdPoint = await tx.electionRemovalPoint.create({
          data: {
            organizationId: auth.organizationId,
            campaignId: createdCampaign.id,
            label: p.label,
            description: p.description,
            mediaType: p.mediaType,
            objectType: p.objectType,
            latitude: p.latitude,
            longitude: p.longitude,
            quantity: p.quantity,
            baseServiceMinutes: p.baseServiceMinutes,
            serviceMinutes: p.serviceMinutes,
            operationType: opType,
            materialDisposition: matDisp,
            materialInstructions: p.materialInstructions,
            destinationName: destName,
            destinationLatitude: destLat,
            destinationLongitude: destLng,
            carrierId: p.carrierId,
            surfaceId: p.surfaceId,
            referenceUrl: p.referenceUrl,
            contact: p.contact,
            accessInstructions: p.accessInstructions,
            requiredWorkers: p.requiredWorkers,
            requiredPositions: p.requiredPositions,
            requiredEquipment: p.requiredEquipment,
            loadSlots: p.loadSlots,
            reviewRequired,
            status: 'PENDING',
          },
        });

        // Generate execution steps so the duplicated campaign is immediately ready for route planning
        try {
          const spec = parseTaskSpec(pointSpec);
          const steps = taskSteps(spec);
          for (const step of steps) {
            await tx.fieldWorkStep.create({
              data: {
                organizationId: auth.organizationId,
                pointId: createdPoint.id,
                sequence: step.sequence,
                kind: step.kind,
                label: step.label,
                latitude: step.latitude,
                longitude: step.longitude,
                serviceMinutes: step.serviceMinutes,
                quantity: step.quantity,
                completedQuantity: 0,
                status: 'PENDING',
                loadDelta: step.loadDelta,
                photoType: step.photoType,
                version: 0,
              },
            });
          }
        } catch {
          // If taskSpec fails strict validation (e.g. missing destination GPS on relocation), mark as reviewRequired
          await tx.electionRemovalPoint.update({
            where: { id: createdPoint.id },
            data: { reviewRequired: true },
          });
        }
      }

      await tx.crmAuditLog.create({
        data: {
          organizationId: auth.organizationId,
          entityType: 'ElectionCampaign',
          entityId: createdCampaign.id,
          userId: auth.user.id,
          userEmail: auth.user.email,
          action: 'FIELD_ACTION_DUPLICATED',
          detailsJson: JSON.stringify({
            sourceCampaignId: sourceCampaign.id,
            sourceName: sourceCampaign.name,
            targetOperation: targetOp,
            duplicatedPointsCount: sourceCampaign.points.length,
          }),
        },
      });

      return createdCampaign;
    });

    return NextResponse.json({
      success: true,
      campaignId: newCampaign.id,
      campaign: newCampaign,
    });
  } catch (error: unknown) {
    console.error('Chyba při duplikaci zakázky:', error);
    const message = error instanceof Error ? error.message : 'Chyba při duplikaci zakázky.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
