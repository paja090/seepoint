import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { enterTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { resolvePointClientName } from '@/lib/election-removal/point-metadata';

/**
 * DELETE /api/fotodokumentace/albums/[id]
 * Smazání / archivace alba z přehledu fotodokumentace.
 * Podporuje jak terénní práce (FIELD_WORK), tak navigační reklamu VO (NAVIGATION).
 * Fotografie zůstávají bezpečně uloženy na disku i v DB, odstraňuje se pouze vazba alba / veřejný odkaz.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess('photoDocumentation');
  if (isApiDenied(user)) return user;
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json(
      { error: 'Smazání alba vyžaduje roli manažera nebo administrátora.' },
      { status: 403 }
    );
  }

  const organizationId = user.organizationId!;
  enterTenantContext({ organizationId, userId: user.id, source: 'session' });

  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source') || (decodedId.includes('::client::') ? 'FIELD_WORK' : null);
  const permanent = searchParams.get('permanent') === 'true';

  try {
    if (source === 'NAVIGATION') {
      const existingReport = await prisma.navigationDocumentationReport.findFirst({
        where: { id: decodedId, organizationId },
        select: { id: true, title: true },
      });

      if (!existingReport) {
        return NextResponse.json({ error: 'Album navigační dokumentace nebylo nalezeno.' }, { status: 404 });
      }

      if (permanent) {
        await prisma.$transaction(async (tx) => {
          await tx.navigationDocumentationItem.deleteMany({
            where: { reportId: decodedId, organizationId },
          });
          await tx.navigationReportAuditLog.deleteMany({
            where: { reportId: decodedId, organizationId },
          });
          await tx.navigationDocumentationReport.deleteMany({
            where: { id: decodedId, organizationId },
          });
        });
      } else {
        await prisma.navigationDocumentationReport.updateMany({
          where: { id: decodedId, organizationId },
          data: {
            status: 'ARCHIVED',
            publicTokenHash: null,
            tokenExpiresAt: new Date(),
          },
        });
      }

      await prisma.crmAuditLog.create({
        data: {
          organizationId,
          entityType: 'NavigationDocumentationReport',
          entityId: decodedId,
          userId: user.id,
          userEmail: user.email,
          action: 'ALBUM_DELETED',
          detailsJson: JSON.stringify({ source: 'NAVIGATION', permanent }),
        },
      });

      return NextResponse.json({ success: true, message: 'Album navigační reklamy bylo úspěšně odstraněno.' });
    }

    // Terénní práce (FIELD_WORK) nebo nerozpoznaný zdroj (výchozí kampaň)
    const [campaignId, rawClientKey] = decodedId.includes('::client::')
      ? decodedId.split('::client::')
      : [decodedId, searchParams.get('client')];

    const campaign = await prisma.electionCampaign.findFirst({
      where: { id: campaignId, organizationId },
      include: {
        points: {
          select: {
            id: true,
            label: true,
            description: true,
            layerName: true,
            photos: { select: { id: true } },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Kampaň nebo album nebylo nalezeno.' }, { status: 404 });
    }

    if (rawClientKey) {
      // Smazání klientského sub-alba v rámci kampaně s více klienty
      const targetClient = rawClientKey.trim();
      const clientPoints = campaign.points.filter(
        (p) => (resolvePointClientName(p, campaign.clientName) || '').trim() === targetClient
      );
      const clientPointIds = clientPoints.map((p) => p.id);

      if (clientPointIds.length > 0) {
        // Bezpečně odpojit fotky daného klienta od bodů kampaně
        await prisma.photo.updateMany({
          where: {
            organizationId,
            electionRemovalPointId: { in: clientPointIds },
          },
          data: {
            electionRemovalPointId: null,
            fieldWorkStepId: null,
          },
        });
      }

      // Zkontrolovat, zda v kampani ještě zbývají nějaké fotky u ostatních klientů
      const remainingPhotosCount = await prisma.photo.count({
        where: {
          organizationId,
          electionRemovalPoint: { campaignId },
        },
      });

      // Pokud již v kampani nezbývají žádné fotky, archivovat celou kampaň
      if (remainingPhotosCount === 0) {
        await prisma.electionCampaign.updateMany({
          where: { id: campaignId, organizationId },
          data: { status: 'ARCHIVED' },
        });
      }

      await prisma.crmAuditLog.create({
        data: {
          organizationId,
          entityType: 'ElectionCampaignAlbum',
          entityId: decodedId,
          userId: user.id,
          userEmail: user.email,
          action: 'CLIENT_ALBUM_DELETED',
          detailsJson: JSON.stringify({ campaignId, client: targetClient }),
        },
      });

      return NextResponse.json({ success: true, message: `Album pro klienta „${targetClient}“ bylo úspěšně odstraněno.` });
    }

    // Smazání celého alba kampaně
    if (permanent) {
      const pointIds = campaign.points.map((p) => p.id);
      await prisma.$transaction(async (tx) => {
        if (pointIds.length > 0) {
          await tx.photo.updateMany({
            where: {
              organizationId,
              electionRemovalPointId: { in: pointIds },
            },
            data: {
              electionRemovalPointId: null,
              fieldWorkStepId: null,
            },
          });
          await tx.fieldWorkStep.deleteMany({
            where: { pointId: { in: pointIds }, organizationId },
          });
          await tx.electionRemovalPoint.deleteMany({
            where: { id: { in: pointIds }, organizationId },
          });
        }
        await tx.fieldPlan.deleteMany({
          where: { electionCampaignId: campaignId, organizationId },
        });
        await tx.electionCampaign.deleteMany({
          where: { id: campaignId, organizationId },
        });
      });
    } else {
      await prisma.electionCampaign.updateMany({
        where: { id: campaignId, organizationId },
        data: { status: 'ARCHIVED' },
      });
    }

    await prisma.crmAuditLog.create({
      data: {
        organizationId,
        entityType: 'ElectionCampaign',
        entityId: campaignId,
        userId: user.id,
        userEmail: user.email,
        action: 'ALBUM_DELETED',
        detailsJson: JSON.stringify({ permanent }),
      },
    });

    return NextResponse.json({ success: true, message: 'Album terénní práce bylo úspěšně odstraněno.' });
  } catch (error) {
    console.error('[fotodokumentace/albums/delete] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepodařilo se smazat album.' },
      { status: 500 }
    );
  }
}
