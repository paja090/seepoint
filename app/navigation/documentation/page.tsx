import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/AppShell';
import { NavigationDocumentationAdmin, type ReportRow } from './NavigationDocumentationAdmin';
import { ProjectSubNav } from '@/components/navigation/ProjectSubNav';

export const dynamic = 'force-dynamic';

const navSubNavItems = [
  { href: '/navigation', label: '📋 Projekty Navigace' },
  { href: '/navigation/contracts', label: '📋 Evidence smluv VO' },
  { href: '/navigation/contacts', label: '🏛️ Kontaktní osoby měst' },
  { href: '/navigation/documentation', label: '📷 Fotodokumentace & Reporty' },
];

export default async function NavigationDocumentationPage() {
  const user = await requirePageAccess('navigationDocumentation');

  const [clients, offers, initialReports] = await Promise.all([
    prisma.client.findMany({ where: { organizationId: user.organizationId, active: true }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' }, take: 250 }),
    prisma.offer.findMany({
      where: { organizationId: user.organizationId, offerType: 'NAVIGATION', archivedAt: null },
      select: { id: true, campaignName: true, title: true, clientId: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.navigationDocumentationReport.findMany({
      where: { organizationId: user.organizationId },
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
    tokenExpiresAt: r.tokenExpiresAt ? r.tokenExpiresAt.toISOString() : null,
    client: r.client,
    offer: r.offer,
    createdBy: r.createdBy,
    _count: r._count,
  }));

  return (
    <AppShell>
      <ProjectSubNav items={navSubNavItems} />
      <NavigationDocumentationAdmin
        clients={clients}
        offers={offers}
        initialReports={formattedReports}
      />
    </AppShell>
  );
}
