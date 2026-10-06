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
} from '@/lib/election-removal/constants';

export const runtime = 'nodejs';

/**
 * GET /api/election-removal/campaigns
 * Seznam volebních demontážních kampaní pro přihlášený tenant.
 */
export async function GET() {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

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
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  try {
    const body = (await req.json()) as CreateCampaignPayload;

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Název kampaně je povinný.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.points) || body.points.length === 0) {
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

    if (validPoints.length === 0) {
      return NextResponse.json(
        { error: 'Žádný z předaných bodů nemá platné GPS souřadnice.' },
        { status: 400 }
      );
    }

    const campaign = await prisma.$transaction(async (tx) => {
      const createdCampaign = await tx.electionCampaign.create({
        data: {
          organizationId: auth.organizationId,
          name: body.name.trim(),
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

        return {
          organizationId: auth.organizationId,
          campaignId: createdCampaign.id,
          label: pt.name?.trim() || 'Bod demontáže',
          description: pt.description?.trim() || null,
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

      await tx.electionRemovalPoint.createMany({
        data: pointsToCreate,
      });

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
