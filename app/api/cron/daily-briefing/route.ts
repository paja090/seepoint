import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hasModuleAccess } from '@/lib/module-policy';
import { isModuleEnabled } from '@/lib/organization-modules';
import { runWithTenantContext, requireTenantContext } from '@/lib/tenant-context';
import { dayInZone } from '@/lib/field-planning/profile';
import {
  getDailyBriefingSettings,
  getManagerDigestSettings,
  getLocalHour,
  getTomorrowDateStr,
  isWeekendDate,
  sendDailyBriefingsForOrganization,
  sendManagerMorningDigestForOrganization,
} from '@/lib/work/daily-briefing';
import {
  isSeePointOrganization,
  syncGooglePlanToWorkOrders,
} from '@/lib/work/google-sheets-sync';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Automated Cron Endpoint for:
 * 1) Combined Next-Day Worker Daily Plan + Today Check-out E-mails (default 17:00 Prague)
 * 2) Morning Manager Recap Digest of yesterday's open/rescheduled/completed tasks (default 07:00 Prague)
 *
 * Scheduled hourly in vercel.json ("0 * * * *") and stays idempotent via EmailLog.
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
  const typeParam = url.searchParams.get('type') || undefined;
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
    managerDigest?: {
      auditedDate: string;
      sentCount: number;
      skippedAlreadySentCount: number;
      skippedEmpty: boolean;
    };
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
        const [settings, managerSettings] = await Promise.all([
          getDailyBriefingSettings(org.id),
          getManagerDigestSettings(org.id),
        ]);

        const targetDate = targetDateParam || getTomorrowDateStr(now, settings.timezone);
        const workerLocalHour = getLocalHour(now, settings.timezone);
        const managerLocalHour = getLocalHour(now, managerSettings.timezone);
        const managerTodayDate = dayInZone(now, managerSettings.timezone);

        const shouldRunWorkers = isForceRun
          ? typeParam !== 'manager'
          : settings.enabled &&
            workerLocalHour === settings.sendHourLocal &&
            !(settings.skipWeekends && isWeekendDate(targetDate));

        const shouldRunManager = isForceRun
          ? typeParam === 'manager'
          : managerSettings.enabled &&
            managerLocalHour === managerSettings.sendHourLocal &&
            !(managerSettings.skipWeekends && isWeekendDate(managerTodayDate));

        if (!shouldRunWorkers && !shouldRunManager) {
          return {
            organizationId: org.id,
            organizationName: org.name,
            status: 'skipped',
            reason: !settings.enabled && !managerSettings.enabled
              ? 'briefing_disabled'
              : `outside_hour_${workerLocalHour}_expected_${settings.sendHourLocal}`,
          };
        }

        // Keep SeePoint Google Sheets plan fresh right before dispatching briefings or manager recap
        if (isSeePointOrganization(org)) {
          try {
            await syncGooglePlanToWorkOrders({ organizationId: org.id });
          } catch (syncErr) {
            console.warn('[cron/daily-briefing] Pre-send Google Sheets sync failed:', syncErr);
          }
        }

        const workerSummary = shouldRunWorkers
          ? await sendDailyBriefingsForOrganization(org.id, {
              targetDate,
              force: isForceRun,
            })
          : null;

        const managerSummary = shouldRunManager
          ? await sendManagerMorningDigestForOrganization(org.id, {
              force: isForceRun,
            })
          : undefined;

        return {
          organizationId: org.id,
          organizationName: org.name,
          status: 'processed',
          ...(workerSummary
            ? {
                targetDate: workerSummary.targetDate,
                recipientsCount: workerSummary.recipientsCount,
                sentCount: workerSummary.sentCount,
                skippedAlreadySentCount: workerSummary.skippedAlreadySentCount,
              }
            : {}),
          ...(managerSummary
            ? {
                managerDigest: {
                  auditedDate: managerSummary.auditedDate,
                  sentCount: managerSummary.sentCount,
                  skippedAlreadySentCount: managerSummary.skippedAlreadySentCount,
                  skippedEmpty: managerSummary.skippedEmpty,
                },
              }
            : {}),
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
