import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { runDiscoveryForOrganization } from '@/lib/opportunities/discovery-runner';
import { getOrganizationRadarProfile } from '@/lib/opportunities/radar-profile';

import { hasModuleAccess } from '@/lib/module-policy';
import { isModuleEnabled } from '@/lib/organization-modules';
import { runWithTenantContext } from '@/lib/tenant-context';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Automated Cron Endpoint for AI Sales Radar
 * 
 * Invoked by Vercel Cron on schedule (e.g. weekdays at 06:00 UTC / 07:00 CET).
 * Authenticates via Bearer CRON_SECRET or an authenticated ADMIN/MANAGER session.
 */
async function handleCronExecution(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization');
  const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  let isAuthorized = isCronAuthorized;
  let callerInfo = 'cron-service';
  let callerOrganizationId: string | undefined;

  if (!isAuthorized) {
    const user = await getCurrentUser();
    if (user && ['ADMIN', 'MANAGER'].includes(user.role) && hasModuleAccess(user, 'salesRadar')) {
      isAuthorized = true;
      callerInfo = `user:${user.id}`;
      callerOrganizationId = user.organizationId;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Neautorizovaný přístup k plánovači.' },
      { status: 401 }
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
    let totalAdded = 0;
    let totalDuplicates = 0;
    let skippedCount = 0;

    for (const org of organizations) {
      try {
        const profile = isModuleEnabled(org, 'salesRadar')
          ? await runWithTenantContext({ organizationId: org.id, source: 'script' }, () => getOrganizationRadarProfile(org.id))
          : null;
        if (!profile || !profile.enabled) {
          skippedCount++;
          executionResults.push({
            organizationId: org.id,
            name: org.name,
            status: 'SKIPPED_DISABLED',
          });
          continue;
        }

        if (deadline - Date.now() < 100_000) {
          deferredCount++;
          executionResults.push({ organizationId: org.id, name: org.name, status: 'DEFERRED_TIME_BUDGET' });
          continue;
        }

        const result = await runDiscoveryForOrganization({
          organizationId: org.id,
          userId: 'cron-scheduler',
          triggerType: 'CRON',
          batchLimit: 15,
          timeBudgetMs: 100_000,
        });

        totalAdded += result.addedCount;
        totalDuplicates += result.duplicateCount;

        executionResults.push({
          organizationId: org.id,
          name: org.name,
          status: result.success ? 'COMPLETED' : 'PARTIAL_OR_FAILED',
          runId: result.runId,
          addedCount: result.addedCount,
          duplicateCount: result.duplicateCount,
          processed: result.processed,
        });
      } catch (orgErr) {
        console.error(`Cron radar error for organization ${org.id}:`, orgErr);
        executionResults.push({
          organizationId: org.id,
          name: org.name,
          status: 'FAILED',
          error: orgErr instanceof Error ? orgErr.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: deferredCount === 0 && executionResults.every((result) => result.status === 'COMPLETED' || result.status === 'SKIPPED_DISABLED'),
      mode: 'cron',
      caller: callerInfo,
      timestamp: new Date().toISOString(),
      organizationsScanned: organizations.length,
      organizationsActive: organizations.length - skippedCount,
      organizationsSkipped: skippedCount,
      organizationsDeferred: deferredCount,
      totalOpportunitiesCreated: totalAdded,
      totalDuplicatesCaught: totalDuplicates,
      results: executionResults,
    });
  } catch (error) {
    console.error('Fatal cron radar execution error:', error);
    return NextResponse.json(
      { error: 'Běh plánovače selhal.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleCronExecution(request);
}

export async function POST(request: Request) {
  return handleCronExecution(request);
}
