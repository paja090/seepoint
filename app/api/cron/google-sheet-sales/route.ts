import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hasModuleAccess } from '@/lib/module-policy';
import { isModuleEnabled } from '@/lib/organization-modules';
import { runWithTenantContext, requireTenantContext } from '@/lib/tenant-context';
import {
  syncGoogleSalesToCrm,
  DEFAULT_GOOGLE_SALES_SHEET_CSV_URL,
} from '@/lib/sales/google-sales-sync';
import { isSeePointOrganization } from '@/lib/work/google-sheets-sync';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Automated Cron Endpoint for synchronizing SeePOINT s.r.o.'s central Google Sheet for salespeople.
 * Runs 1x daily (scheduled at 05:00 UTC in vercel.json) to ingest sales campaigns, clients,
 * and checklist milestones into CRM and owner reports.
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
    if (
      user &&
      ['ADMIN', 'MANAGER'].includes(user.role) &&
      (hasModuleAccess(user, 'crm') || hasModuleAccess(user, 'planner') || hasModuleAccess(user, 'work'))
    ) {
      isAuthorized = true;
      callerUserId = user.id;
      callerOrganizationId = user.organizationId;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Neautorizovaný přístup k synchronizaci obchodníků.' }, { status: 401 });
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
    createdOrdersCount?: number;
    updatedOrdersCount?: number;
    skippedOrdersCount?: number;
    createdClientsCount?: number;
    status: string;
    error?: string;
  }> = [];

  for (const org of organizations) {
    if (!isSeePointOrganization(org) || (!isModuleEnabled(org, 'crm') && !isModuleEnabled(org, 'planner'))) {
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
          const syncResult = await syncGoogleSalesToCrm({
            organizationId: org.id,
            sheetUrl: DEFAULT_GOOGLE_SALES_SHEET_CSV_URL,
          });
          console.log(
            `[cron/google-sheet-sales] org=${org.id} parsed=${syncResult.totalParsed} created=${syncResult.createdOrdersCount} updated=${syncResult.updatedOrdersCount} skipped=${syncResult.skippedOrdersCount}`
          );
          return {
            organizationId: org.id,
            status: 'synced',
            totalParsed: syncResult.totalParsed,
            createdOrdersCount: syncResult.createdOrdersCount,
            updatedOrdersCount: syncResult.updatedOrdersCount,
            skippedOrdersCount: syncResult.skippedOrdersCount,
            createdClientsCount: syncResult.createdClientsCount,
          };
        } catch (err) {
          console.error(`[cron/google-sheet-sales] Sync failed for ${org.id}:`, err);
          return {
            organizationId: org.id,
            status: 'failed',
            error: err instanceof Error ? err.message : 'Synchronizace zakázek obchodníků selhala',
          };
        }
      }
    );

    results.push(res);
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    results,
  });
}

export async function GET(request: Request) {
  return handleCronExecution(request);
}

export async function POST(request: Request) {
  return handleCronExecution(request);
}
