import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { canAccess, AccessDenied } from '@/lib/rbac';
import { isModuleEnabled } from '@/lib/organization-modules';
import { prisma } from '@/lib/db';
import { runWithTenantContext } from '@/lib/tenant-context';
import { AppShell } from '@/components/AppShell';
import { getOrganizationOccupancyProfile } from '@/lib/occupancy/intelligence-profile';
import { OccupancyIntelligenceView } from '@/components/occupancy/OccupancyIntelligenceView';
import type { InsightItem } from '@/components/occupancy/OccupancyInsightDetailModal';

export const dynamic = 'force-dynamic';

export default async function OccupancyIntelligencePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!canAccess(user.role, 'aiOccupancy')) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return (
      <AppShell>
        <div className="card text-center p-8">
          <p className="text-slate-600 font-medium">Chybí kontext organizace.</p>
        </div>
      </AppShell>
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, plan: true, enabledModules: true },
  });

  if (!org || !isModuleEnabled(org, 'aiOccupancy')) {
    return (
      <AppShell>
        <div className="card text-center p-8 space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Modul AI Obsazenost není aktivován</h2>
          <p className="text-sm text-slate-600">
            Tento modul je dostupný pro plány s aktivní AI podporou nebo doplňkovým balíčkem AI Obsazenost.
          </p>
        </div>
      </AppShell>
    );
  }

  // Load profile and insights in tenant context
  const [profile, rawInsights] = await runWithTenantContext(
    { organizationId, userId: user.id, source: 'session' },
    async () => {
      const p = await getOrganizationOccupancyProfile(organizationId);
      const items = await prisma.occupancyInsight.findMany({
        where: { organizationId },
        orderBy: [{ status: 'asc' }, { severity: 'asc' }, { createdAt: 'desc' }],
        take: 200,
        include: {
          surface: {
            select: {
              id: true,
              name: true,
              mediaType: true,
              status: true,
            },
          },
          carrier: {
            select: {
              id: true,
              code: true,
              name: true,
              city: true,
              address: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          offer: {
            select: {
              id: true,
              title: true,
              campaignName: true,
            },
          },
        },
      });
      return [p, items];
    },
  );

  const initialInsights: InsightItem[] = rawInsights.map((i) => {
    const meta = (i.metadata || {}) as Record<string, unknown>;
    return {
      id: i.id,
      type: i.type,
      severity: i.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
      status: i.status as 'OPEN' | 'RESOLVED' | 'IGNORED',
      title: i.title,
      deterministicReason: i.deterministicReason,
      aiRecommendation: i.aiRecommendation,
      aiExplanation: i.aiExplanation,
      suggestedActionType: i.suggestedActionType,
      periodStart: meta.periodStart ? String(meta.periodStart) : null,
      periodEnd: meta.periodEnd ? String(meta.periodEnd) : null,
      differenceInDays: typeof meta.differenceInDays === 'number' ? meta.differenceInDays : null,
      opportunityValue: typeof meta.opportunityValue === 'number' ? meta.opportunityValue : null,
      technicalFacts: (meta.technicalFacts as Record<string, unknown> | undefined) || meta,
      metadata: meta,
      surfaceId: i.surfaceId,
      surface: i.surface,
      carrier: i.carrier,
      client: i.client,
      offer: i.offer,
      createdAt: i.createdAt.toISOString(),
      resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
    };
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6">
        <OccupancyIntelligenceView
          initialInsights={initialInsights}
          initialProfile={profile}
          organizationName={org.name}
        />
      </div>
    </AppShell>
  );
}
