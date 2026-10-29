import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { runWithTenantContext } from '@/lib/tenant-context';

export async function POST(req: Request) {
  const user = await requireApiAccess('carriers');
  if (isApiDenied(user)) return user;

  try {
    const body = await req.json();
    const {
      label,
      latitude,
      longitude,
      parcelNumber,
      cadastralArea,
      cadastralAreaCode,
      landArea,
      landType,
      landOwnership,
      landownerName,
      landownerIco,
      landownerContact,
      landownerNote,
      monthlyRent,
      permitStatus,
      permitNote,
      permitValidUntil,
    } = body;

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'Zadejte platné GPS souřadnice pozemku.' }, { status: 400 });
    }

    const orgId = user.organizationId!;

    const result = await runWithTenantContext(
      { organizationId: orgId, userId: user.id, source: 'session' },
      async () => {
        // Find or create default scouting campaign
        let campaign = await prisma.electionCampaign.findFirst({
          where: {
            organizationId: orgId,
            name: 'Průzkum a povolování pozemků',
          },
        });

        if (!campaign) {
          campaign = await prisma.electionCampaign.create({
            data: {
              organizationId: orgId,
              name: 'Průzkum a povolování pozemků',
              description: 'Centrální evidence a vyjednávání pozemků pro umístění reklamních nosičů.',
              status: 'IN_PROGRESS',
            },
          });
        }

        const point = await prisma.electionRemovalPoint.create({
          data: {
            organizationId: orgId,
            campaignId: campaign.id,
            label: label || `Pozemek ${parcelNumber || ''} (${cadastralArea || 'ČÚZK'})`.trim(),
            latitude: Number(latitude),
            longitude: Number(longitude),
            address: cadastralArea || null,
            status: 'PENDING',
            operationType: 'OTHER',
            mediaType: 'OTHER',
            quantity: 1,
            // Cadastre fields
            parcelNumber: parcelNumber || null,
            cadastralArea: cadastralArea || null,
            cadastralAreaCode: cadastralAreaCode ? Number(cadastralAreaCode) : null,
            landArea: landArea ? Number(landArea) : null,
            landType: landType || null,
            landOwnership: landOwnership || 'UNKNOWN',
            landownerName: landownerName || null,
            landownerIco: landownerIco || null,
            landownerContact: landownerContact || null,
            landownerNote: landownerNote || null,
            monthlyRent: monthlyRent ? Number(monthlyRent) : null,
            permitStatus: permitStatus || 'SCOUTING',
            permitNote: permitNote || null,
            permitValidUntil: permitValidUntil ? new Date(permitValidUntil) : null,
          },
        });

        return point;
      }
    );

    return NextResponse.json({ success: true, point: result });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Uložení pozemku selhalo.' },
      { status: 500 }
    );
  }
}
