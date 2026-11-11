import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hasModuleAccess } from '@/lib/module-policy';
import { isModuleEnabled } from '@/lib/organization-modules';
import { runWithTenantContext, requireTenantContext } from '@/lib/tenant-context';
import {
  isSeePointOrganization,
  syncGooglePlanToWorkOrders,
} from '@/lib/work/google-sheets-sync';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Automated Cron Endpoint for synchronizing SeePOINT s.r.o.'s central Google Sheet work plan.
 * Scheduled every 15 minutes in vercel.json so changes, hyperlinks, and green completion colors
 * reflect automatically without manual clicks.
 */
async function handleCronExecution(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization');
  const isCronAuthorized = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  let isAuthorized = isCronAuthorized;
  let callerUserId: string | undefined;
  let callerOrganizationId: string | undefined;

  if (!isAuthorized) {
    const user = await getCurrentUser();
    if (user && ['ADMIN', 'MANAGER'].includes(user.role) && hasModuleAccess(user, 'work')) {
      isAuthorized = true;
      callerUserId = user.id;
      callerOrganizationId = user.organizationId;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
  }

  const organizations = await prisma.organization.findMany({
    where: {
      isActive: true,
      ...(isCronAuthorized ? {} : { id: callerOrganizationId }),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      enabledModules: true,
    },
  });

  const results: Array<{
    organizationId: string;
    totalParsed?: number;
    createdCount?: number;
    updatedCount?: number;
    skippedCount?: number;
    cleanedCount?: number;
    status: string;
    error?: string;
  }> = [];

  for (const org of organizations) {
    if (!isSeePointOrganization(org) || !isModuleEnabled(org, 'work')) {
      continue;
    }

    const res = await runWithTenantContext(
      {
        organizationId: org.id,
        source: isCronAuthorized ? 'script' : 'session',
        userId: callerUserId,
      },
      async () => {
        requireTenantContext();
        try {
          const syncResult = await syncGooglePlanToWorkOrders({ organizationId: org.id });
          console.log(
            `[cron/google-sheet-plan] org=${org.id} parsed=${syncResult.totalParsed} created=${syncResult.createdCount} updated=${syncResult.updatedCount} cleaned=${syncResult.cleanedCount ?? 0} skipped=${syncResult.skippedCount}`
          );
          return {
            organizationId: org.id,
            status: 'synced',
            totalParsed: syncResult.totalParsed,
            createdCount: syncResult.createdCount,
            updatedCount: syncResult.updatedCount,
            skippedCount: syncResult.skippedCount,
            cleanedCount: syncResult.cleanedCount ?? 0,
          };
        } catch (err) {
          console.error(`[cron/google-sheet-plan] Sync failed for ${org.id}:`, err);
          return {
            organizationId: org.id,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Synchronizace selhala',
          };
        }
      }
    );

    results.push(res);
  }

  return NextResponse.json({
    ok: true,
    executedAt: new Date().toISOString(),
    results,
  });
}

export async function GET(request: Request) {
  return handleCronExecution(request);
}

export async function POST(request: Request) {
  return handleCronExecution(request);
}
