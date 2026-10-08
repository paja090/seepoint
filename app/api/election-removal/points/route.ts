import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import {
  calculateServiceMinutes,
  type ElectionRemovalMediaType,
  type ElectionRemovalOperationType,
} from '@/lib/election-removal/constants';
import { setPointOperationTypeInDescription } from '@/lib/election-removal/kml-parser';

export const runtime = 'nodejs';

/**
 * POST /api/election-removal/points
 * Přidání nového bodu (např. dalšího stanoviště k přesunu nebo svozu) do existující volební kampaně.
 */
export async function POST(req: Request) {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  try {
    const body = await req.json();
    const {
      campaignId,
      label,
      mediaType = 'ACKO',
      latitude,
      longitude,
      operationType = 'FULL_REMOVAL',
      relocationDestination,
      locality,
      fullAddress,
      note,
      quantity = 1,
      layerName,
    } = body as {
      campaignId: string;
      label: string;
      mediaType?: ElectionRemovalMediaType;
      latitude: number;
      longitude: number;
      operationType?: ElectionRemovalOperationType;
      relocationDestination?: string | null;
      locality?: string | null;
      fullAddress?: string | null;
      note?: string | null;
      quantity?: number;
      layerName?: string | null;
    };

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Identifikátor kampaně (campaignId) je povinný.' },
        { status: 400 }
      );
    }

    if (!label || label.trim().length === 0) {
      return NextResponse.json(
        { error: 'Název nebo označení bodu je povinné.' },
        { status: 400 }
      );
    }

    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      return NextResponse.json(
        { error: 'Zadejte platné GPS souřadnice (zeměpisná šířka a délka).' },
        { status: 400 }
      );
    }

    const campaign = await prisma.electionCampaign.findFirst({
      where: { id: campaignId, organizationId: auth.organizationId },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Volební kampaň nebyla nalezena.' },
        { status: 404 }
      );
    }

    // Compose description
    const descParts: string[] = [];
    if (locality?.trim()) descParts.push(`Lokalita: ${locality.trim()}`);
    if (fullAddress?.trim()) descParts.push(`Ulice: ${fullAddress.trim()}`);
    if (note?.trim()) descParts.push(`Poznámka: ${note.trim()}`);
    const rawDesc = descParts.join('\n');

    const formattedDescription = setPointOperationTypeInDescription(
      rawDesc,
      operationType,
      relocationDestination
    );

    const safeQty = Math.max(1, Math.floor(quantity || 1));
    const { baseMinutes, totalMinutes } = calculateServiceMinutes(
      mediaType,
      safeQty,
      null,
      operationType
    );

    const point = await prisma.$transaction(async (tx) => {
      const createdPoint = await tx.electionRemovalPoint.create({
        data: {
          organizationId: auth.organizationId,
          campaignId,
          label: label.trim(),
          description: formattedDescription,
          layerName: layerName?.trim() || 'Ručně přidané body',
          mediaType,
          latitude,
          longitude,
          quantity: safeQty,
          baseServiceMinutes: baseMinutes,
          serviceMinutes: totalMinutes,
          status: 'PENDING',
        },
      });

      const totalCount = await tx.electionRemovalPoint.count({
        where: { campaignId, organizationId: auth.organizationId },
      });

      await tx.electionCampaign.update({
        where: { id: campaignId },
        data: { totalPoints: totalCount },
      });

      return createdPoint;
    });

    return NextResponse.json({
      success: true,
      point,
    });
  } catch (error: unknown) {
    console.error('Chyba při zakládání bodu demontáže:', error);
    const message =
      error instanceof Error ? error.message : 'Nepodařilo se přidat bod demontáže.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
