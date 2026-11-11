import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hasModuleAccess } from '@/lib/module-policy';
import { isModuleEnabled } from '@/lib/organization-modules';
import { runWithTenantContext, requireTenantContext } from '@/lib/tenant-context';
import {
  getDailyBriefingSettings,
  getLocalHour,
  getTomorrowDateStr,
  isWeekendDate,
  sendDailyBriefingsForOrganization,
} from '@/lib/work/daily-briefing';
import {
  isSeePointOrganization,
  syncGooglePlanToWorkOrders,
} from '@/lib/work/google-sheets-sync';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Automated Cron Endpoint for Next-Day Worker Daily Plan E-mails.
 *
 * Scheduled hourly in vercel.json ("0 * * * *").
 * Each active organization fires only during its configured local send hour
 * (default 17:00 Europe/Prague) and stays idempotent via EmailLog.
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
    return NextResponse.json({ error: 'Neautorizovaný přístup k rozesílači plánů.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const forceParam = url.searchParams.get('force') === 'true';
  const targetDateParam = url.searchParams.get('targetDate') || undefined;
  const isForceRun = !isCronAuthorized && forceParam;

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

  const now = new Date();
  const results: Array<{
    organizationId: string;
    organizationName: string;
    status: string;
    reason?: string;
    sentCount?: number;
    skippedAlreadySentCount?: number;
    recipientsCount?: number;
    targetDate?: string;
  }> = [];

  for (const org of organizations) {
    if (!isModuleEnabled(org, 'work')) {
      results.push({
        organizationId: org.id,
        organizationName: org.name,
        status: 'skipped',
        reason: 'module_disabled',
      });
      continue;
    }

    const orgResult = await runWithTenantContext(
      {
        organizationId: org.id,
        source: isCronAuthorized ? 'script' : 'session',
        userId: callerUserId,
      },
      async () => {
        requireTenantContext();
        const settings = await getDailyBriefingSettings(org.id);

        if (!isForceRun) {
          if (!settings.enabled) {
            return {
              organizationId: org.id,
              organizationName: org.name,
              status: 'skipped',
              reason: 'briefing_disabled',
            };
          }

          const localHour = getLocalHour(now, settings.timezone);
          if (localHour !== settings.sendHourLocal) {
            return {
              organizationId: org.id,
              organizationName: org.name,
              status: 'skipped',
              reason: `outside_hour_${localHour}_expected_${settings.sendHourLocal}`,
            };
          }
        }

        const targetDate = targetDateParam || getTomorrowDateStr(now, settings.timezone);

        if (!isForceRun && settings.skipWeekends && isWeekendDate(targetDate)) {
          return {
            organizationId: org.id,
            organizationName: org.name,
            status: 'skipped',
            reason: 'weekend_skipped',
            targetDate,
          };
        }

        // Keep SeePoint Google Sheets plan fresh right before dispatching tomorrow's plan
        if (isSeePointOrganization(org)) {
          try {
            await syncGooglePlanToWorkOrders({ organizationId: org.id });
          } catch (syncErr) {
            console.warn('[cron/daily-briefing] Pre-send Google Sheets sync failed:', syncErr);
          }
        }

        const summary = await sendDailyBriefingsForOrganization(org.id, {
          targetDate,
          force: isForceRun,
        });

        return {
          organizationId: org.id,
          organizationName: org.name,
          status: 'processed',
          targetDate: summary.targetDate,
          recipientsCount: summary.recipientsCount,
          sentCount: summary.sentCount,
          skippedAlreadySentCount: summary.skippedAlreadySentCount,
        };
      }
    );

    results.push(orgResult);
  }

  return NextResponse.json({
    ok: true,
    executedAt: now.toISOString(),
    results,
  });
}

export async function GET(request: Request) {
  return handleCronExecution(request);
}

export async function POST(request: Request) {
  return handleCronExecution(request);
}
