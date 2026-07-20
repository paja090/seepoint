import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/AppShell';
import { NavigationDocumentationAdmin, type ReportRow } from './NavigationDocumentationAdmin';

export const dynamic = 'force-dynamic';

export default async function NavigationDocumentationPage() {
  await requirePageAccess('navigationDocumentation');

  const [clients, offers, initialReports] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }),
    prisma.offer.findMany({
      where: { offerType: 'NAVIGATION', archivedAt: null },
      select: { id: true, campaignName: true, title: true, clientId: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.navigationDocumentationReport.findMany({
      include: {
        client: { select: { id: true, name: true, email: true } },
        offer: { select: { id: true, campaignName: true, title: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const formattedReports: ReportRow[] = initialReports.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    offerId: r.offerId,
    title: r.title,
    description: r.description,
    quarter: r.quarter,
    year: r.year,
    status: r.status,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    publicTokenHash: r.publicTokenHash,
    tokenExpiresAt: r.tokenExpiresAt ? r.tokenExpiresAt.toISOString() : null,
    client: r.client,
    offer: r.offer,
    createdBy: r.createdBy,
    _count: r._count,
  }));

  return (
    <AppShell>
      <NavigationDocumentationAdmin
        clients={clients}
        offers={offers}
        initialReports={formattedReports}
      />
    </AppShell>
  );
}
