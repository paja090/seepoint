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
import {
  normalizeOperation,
  operations,
  type Operation,
} from '@/lib/election-removal/task-spec';

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
  objectType?: string | null;
  latitude: number;
  longitude: number;
  quantity?: number;
  serviceMinutes?: number;
  operationType?: ElectionRemovalOperationType | Operation;
  relocationDestination?: string;
  reviewRequired?: boolean;
  carrierId?: string | null;
  surfaceId?: string | null;
  materialDisposition?: string | null;
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
 * Vytvoření nové volební kampaně a import bodů z KML nebo ze systému po revizi manažera.
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

    if (!Array.isArray(body.points) || body.points.length > 500) {
      return NextResponse.json(
        { error: 'Kampaň může obsahovat maximálně 500 bodů.' },
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
      for (const pt of validPoints) {
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

        const isPreconfirmed = pt.reviewRequired === false;
        const normalizedOp: Operation | null = pt.operationType
          ? normalizeOperation(pt.operationType)
          : isPreconfirmed
            ? 'INSPECTION'
            : null;
        const finalDescription = pt.description?.trim() || null;
        const label = pt.name?.trim() || 'Bod terénní akce';

        const createdPoint = await tx.electionRemovalPoint.create({
          data: {
            organizationId: auth.organizationId,
            campaignId: createdCampaign.id,
            label,
            description: finalDescription,
            destinationName: pt.relocationDestination?.trim() || null,
            operationType: normalizedOp,
            reviewRequired: isPreconfirmed ? false : true,
            objectType: pt.objectType?.trim() || (isPreconfirmed ? pt.mediaType : null),
            materialDisposition: isPreconfirmed ? (pt.materialDisposition || 'LEAVE') : null,
            carrierId: pt.carrierId?.trim() || null,
            surfaceId: pt.surfaceId?.trim() || null,
            layerName: pt.layerName?.trim() || null,
            mediaType: pt.mediaType,
            latitude: pt.latitude,
            longitude: pt.longitude,
            quantity: safeQuantity,
            baseServiceMinutes: baseMinutes,
            serviceMinutes: totalMinutes,
            status: 'PENDING' as const,
          },
        });

        if (isPreconfirmed && normalizedOp) {
          const stepPhotoType = ['REMOVE_OBJECT', 'REMOVE_AD'].includes(normalizedOp)
            ? ('AFTER_DEINSTALLATION' as const)
            : ['INSTALL_OBJECT', 'INSTALL_AD', 'REPLACE_AD'].includes(normalizedOp)
              ? ('AFTER_INSTALLATION' as const)
              : ('CONTROL' as const);

          await tx.fieldWorkStep.create({
            data: {
              organizationId: auth.organizationId,
              pointId: createdPoint.id,
              sequence: 1,
              kind: 'WORK',
              label: `${operations[normalizedOp]} — ${label}`,
              latitude: pt.latitude,
              longitude: pt.longitude,
              serviceMinutes: totalMinutes,
              quantity: safeQuantity,
              loadDelta: 0,
              photoType: stepPhotoType,
            },
          });
        }
      }

      await tx.crmAuditLog.create({ data: { organizationId: auth.organizationId, entityType: 'ElectionCampaign', entityId: createdCampaign.id,
        userId: auth.user.id, userEmail: auth.user.email, action: 'FIELD_ACTION_CREATED',
        detailsJson: JSON.stringify({ name: createdCampaign.name, importedPoints: validPoints.length }) } });
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
