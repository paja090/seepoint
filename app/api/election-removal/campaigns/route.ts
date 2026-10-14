import { plannerTransaction } from '@/lib/field-planning/service';
import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma, type ElectionRemovalMediaType } from '@prisma/client';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import {
  DEFAULT_MEDIA_SERVICE_MINUTES,
  calculateServiceMinutes,
  type ElectionRemovalOperationType,
} from '@/lib/election-removal/constants';
import { normalizeOperation } from '@/lib/election-removal/task-spec';

export const runtime = 'nodejs';

/**
 * GET /api/election-removal/campaigns
 * Seznam volebních demontážních kampaní pro přihlášený tenant.
 */
export async function GET() {
  const auth = await requireElectionRemovalAccess(true);
  if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });

  try {
    const campaigns = await prisma.electionCampaign.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            points: true,
            fieldPlans: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, campaigns });
  } catch (error: unknown) {
    console.error('Chyba při načítání volebních kampaní:', error);
    return NextResponse.json(
      { error: 'Nepodařilo se načíst volební kampaně.' },
      { status: 500 }
    );
  }
}

interface CreatePointPayload {
  name: string;
  description?: string;
  layerName?: string;
  mediaType: ElectionRemovalMediaType;
  latitude: number;
  longitude: number;
  quantity?: number;
  serviceMinutes?: number;
}

interface CreateCampaignPayload {
  clientName?: string;
  name: string;
  description?: string;
  targetDate?: string | null;
  kmlFileName?: string | null;
  mediaDefaults?: Prisma.InputJsonValue;
  points: CreatePointPayload[];
}

/**
 * POST /api/election-removal/campaigns
 * Vytvoření nové volební kampaně a import bodů z KML po revizi manažera.
 */
export async function POST(req: Request) {
  const auth = await requireElectionRemovalAccess(true);
  if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });

  try {
    const body = (await req.json()) as CreateCampaignPayload;

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Název kampaně je povinný.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.points) || body.points.length > 200) {
      return NextResponse.json(
        { error: 'Kampaň musí obsahovat alespoň jeden bod demontáže.' },
        { status: 400 }
      );
    }

    // Filter and validate points
    const validPoints = body.points.filter((pt) => {
      return (
        typeof pt.latitude === 'number' &&
        typeof pt.longitude === 'number' &&
        !Number.isNaN(pt.latitude) &&
        !Number.isNaN(pt.longitude) &&
        pt.latitude >= -90 &&
        pt.latitude <= 90 &&
        pt.longitude >= -180 &&
        pt.longitude <= 180
      );
    });

    if (validPoints.length !== body.points.length) {
      return NextResponse.json(
        { error: 'Žádný z předaných bodů nemá platné GPS souřadnice.' },
        { status: 400 }
      );
    }

    const campaign = await plannerTransaction(async (tx) => {
      const createdCampaign = await tx.electionCampaign.create({
        data: {
          organizationId: auth.organizationId,
          name: body.name.trim(),
          clientName: body.clientName?.trim() || null,
          description: body.description?.trim() || null,
          targetDate: body.targetDate ? new Date(body.targetDate) : null,
          kmlFileName: body.kmlFileName || null,
          mediaDefaults: body.mediaDefaults
            ? (body.mediaDefaults as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          totalPoints: validPoints.length,
          completedPoints: 0,
          status: 'DRAFT',
        },
      });

      // Prepare point creation
      // Strictly maintain default quantity = 1, each placemark = independent record
      const pointsToCreate = validPoints.map((pt) => {
        const safeQuantity = Math.max(1, Math.floor(pt.quantity || 1));
        const baseMinutes =
          pt.serviceMinutes ??
          DEFAULT_MEDIA_SERVICE_MINUTES[pt.mediaType] ??
          10;
        const { totalMinutes } = calculateServiceMinutes(
          pt.mediaType,
          safeQuantity,
          { [pt.mediaType]: baseMinutes }
        );

        const opType = (pt as unknown as { operationType?: ElectionRemovalOperationType }).operationType;
        const relocDest = (pt as unknown as { relocationDestination?: string }).relocationDestination;
        const finalDescription = pt.description?.trim() || null;


        return {
          organizationId: auth.organizationId,
          campaignId: createdCampaign.id,
          label: pt.name?.trim() || 'Bod demontáže',
          description: finalDescription,
          destinationName: relocDest?.trim() || null,
          operationType: opType ? normalizeOperation(opType) : null,
          reviewRequired: true,
          layerName: pt.layerName?.trim() || null,
          mediaType: pt.mediaType,
          latitude: pt.latitude,
          longitude: pt.longitude,
          quantity: safeQuantity,
          baseServiceMinutes: baseMinutes,
          serviceMinutes: totalMinutes,
          status: 'PENDING' as const,
        };
      });

      if (pointsToCreate.length) await tx.electionRemovalPoint.createMany({
        data: pointsToCreate,
      });

      await tx.crmAuditLog.create({ data: { organizationId: auth.organizationId, entityType: 'ElectionCampaign', entityId: createdCampaign.id,
        userId: auth.user.id, userEmail: auth.user.email, action: 'FIELD_ACTION_CREATED',
        detailsJson: JSON.stringify({ name: createdCampaign.name, importedPoints: pointsToCreate.length }) } });
      return createdCampaign;
    });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      campaign,
    });
  } catch (error: unknown) {
    console.error('Chyba při zakládání volební kampaně:', error);
    const message =
      error instanceof Error ? error.message : 'Chyba při ukládání kampaně.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
