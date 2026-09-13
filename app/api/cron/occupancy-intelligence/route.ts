import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hasModuleAccess } from '@/lib/module-policy';
import { isModuleEnabled } from '@/lib/organization-modules';
import { runWithTenantContext } from '@/lib/tenant-context';
import { getOrganizationOccupancyProfile } from '@/lib/occupancy/intelligence-profile';
import { runOccupancyAudit } from '@/lib/occupancy/intelligence-service';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Automated Cron Endpoint for AI Occupancy Intelligence
 *
 * Invoked by scheduler on schedule (e.g. daily at 05:00 UTC / 06:00 CET).
 * Authenticates via Bearer CRON_SECRET or an authenticated ADMIN/MANAGER session.
 */
export async function GET(request: Request) {
  return handleCronExecution(request);
}

export async function POST(request: Request) {
  return handleCronExecution(request);
}

async function handleCronExecution(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization');
  const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  let isAuthorized = isCronAuthorized;
  let callerInfo = 'cron-service';
  let callerOrganizationId: string | undefined;

  if (!isAuthorized) {
    const user = await getCurrentUser();
    if (user && ['ADMIN', 'MANAGER'].includes(user.role) && hasModuleAccess(user, 'aiOccupancy')) {
      isAuthorized = true;
      callerInfo = `user:${user.id}`;
      callerOrganizationId = user.organizationId;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Neautorizovaný přístup k plánovači obsazenosti.' },
      { status: 401 },
    );
  }

  try {
    const organizations = await prisma.organization.findMany({
      where: { isActive: true, ...(isCronAuthorized ? {} : { id: callerOrganizationId }) },
      select: { id: true, name: true, plan: true, enabledModules: true },
    });

    const executionResults = [];
    const deadline = Date.now() + 270_000;
    let deferredCount = 0;
    let totalCreated = 0;
    let totalAutoResolved = 0;
    let skippedCount = 0;

    for (const org of organizations) {
      try {
        if (!isModuleEnabled(org, 'aiOccupancy')) {
          skippedCount++;
          executionResults.push({
            organizationId: org.id,
            name: org.name,
            status: 'SKIPPED_MODULE_DISABLED',
          });
          continue;
        }

        const profile = await runWithTenantContext(
          { organizationId: org.id, source: 'script' },
          () => getOrganizationOccupancyProfile(org.id),
        );

        if (!profile || !profile.automaticChecksEnabled) {
          skippedCount++;
          executionResults.push({
            organizationId: org.id,
            name: org.name,
            status: 'SKIPPED_AUTO_CHECKS_DISABLED',
          });
          continue;
        }

        if (deadline - Date.now() < 30_000) {
          deferredCount++;
          executionResults.push({
            organizationId: org.id,
            name: org.name,
            status: 'DEFERRED_TIME_BUDGET',
          });
          continue;
        }

        const auditResult = await runWithTenantContext(
          { organizationId: org.id, source: 'script' },
          () => runOccupancyAudit(org.id, { userId: 'cron-scheduler' }),
        );

        totalCreated += auditResult.newInsights;
        totalAutoResolved += auditResult.autoResolvedInsights;

        executionResults.push({
          organizationId: org.id,
          name: org.name,
          status: 'COMPLETED',
          activeFindings: auditResult.openInsights,
          createdCount: auditResult.newInsights,
          autoResolvedCount: auditResult.autoResolvedInsights,
        });
      } catch (orgErr) {
        console.error(`Cron occupancy audit error for organization ${org.id}:`, orgErr);
        executionResults.push({
          organizationId: org.id,
          name: org.name,
          status: 'FAILED',
          error: orgErr instanceof Error ? orgErr.message : String(orgErr),
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      caller: callerInfo,
      summary: {
        totalOrganizations: organizations.length,
        executed: executionResults.filter((r) => r.status === 'COMPLETED').length,
        skipped: skippedCount,
        deferred: deferredCount,
        totalCreated,
        totalAutoResolved,
      },
      results: executionResults,
    });
  } catch (error) {
    console.error('Occupancy cron runner error:', error);
    return NextResponse.json(
      { error: 'Chyba při spouštění plánovače obsazenosti.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
