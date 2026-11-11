import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOrganizationRole } from '@/lib/organization';
import { getAppOrigin } from '@/lib/app-url';
import {
  getDailyBriefingSettings,
  saveDailyBriefingSettings,
  loadDailyBriefingsForOrganization,
  sendDailyBriefingsForOrganization,
} from '@/lib/work/daily-briefing';
import {
  isSeePointOrganization,
  syncGooglePlanToWorkOrders,
} from '@/lib/work/google-sheets-sync';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { organizationId } = await requireOrganizationRole('ADMIN', 'MANAGER');
    const baseUrl = getAppOrigin(request);
    const settings = await getDailyBriefingSettings(organizationId);

    const [preview, recentLogs] = await Promise.all([
      loadDailyBriefingsForOrganization(organizationId, { baseUrl }),
      prisma.emailLog.findMany({
        where: {
          organizationId,
          template: 'worker-daily-briefing',
        },
        orderBy: { sentAt: 'desc' },
        take: 25,
        select: {
          id: true,
          recipient: true,
          subject: true,
          status: true,
          sentAt: true,
          metadata: true,
        },
      }),
    ]);

    return NextResponse.json({
      settings,
      preview: {
        targetDate: preview.targetDate,
        targetDateLabel: preview.targetDateLabel,
        unmatchedWorkerNames: preview.unmatchedWorkerNames,
        briefings: preview.briefings.map((b) => ({
          recipientName: b.recipient.fullName,
          recipientEmail: b.recipient.email,
          taskCount: b.tasks.length,
          vehicles: b.vehicles,
          crewMates: b.crewMates,
          tasks: b.tasks.slice(0, 6).map((t) => ({
            title: t.title,
            clientName: t.clientName,
            workTypeLabel: t.workTypeLabel,
            scheduledTimeLabel: t.scheduledTimeLabel,
          })),
        })),
      },
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        recipient: l.recipient,
        subject: l.subject,
        status: l.status,
        sentAt: l.sentAt.toISOString(),
        metadata: l.metadata,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nepodařilo se načíst nastavení.';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function PUT(request: Request) {
  try {
    const { organizationId } = await requireOrganizationRole('ADMIN', 'MANAGER');
    const body = (await request.json().catch(() => null)) as {
      enabled?: boolean;
      sendHourLocal?: number;
      timezone?: string;
      skipWeekends?: boolean;
    } | null;

    if (!body) {
      return NextResponse.json({ error: 'Neplatný formát požadavku.' }, { status: 400 });
    }

    const settings = await saveDailyBriefingSettings(organizationId, body);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Změnu se nepodařilo uložit.';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, user } = await requireOrganizationRole('ADMIN', 'MANAGER');
    const baseUrl = getAppOrigin(request);
    const body = (await request.json().catch(() => null)) as {
      action?: 'send_test' | 'send_now' | 'sync_and_preview';
      testEmail?: string;
      targetDate?: string;
      force?: boolean;
    } | null;

    if (!body?.action) {
      return NextResponse.json({ error: 'Chybí typ akce.' }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });

    if (org && isSeePointOrganization(org)) {
      try {
        await syncGooglePlanToWorkOrders({ organizationId });
      } catch (err) {
        console.warn('[settings/daily-briefing] Pre-action Google Sheets sync failed:', err);
      }
    }

    if (body.action === 'sync_and_preview') {
      const preview = await loadDailyBriefingsForOrganization(organizationId, { baseUrl });
      return NextResponse.json({ ok: true, preview });
    }

    if (body.action === 'send_test') {
      const targetEmail = (body.testEmail || user.email || '').trim();
      const summary = await sendDailyBriefingsForOrganization(organizationId, {
        targetDate: body.targetDate,
        testRecipientEmail: targetEmail,
        baseUrl,
      });
      return NextResponse.json({ ok: true, summary });
    }

    if (body.action === 'send_now') {
      const summary = await sendDailyBriefingsForOrganization(organizationId, {
        targetDate: body.targetDate,
        force: Boolean(body.force),
        baseUrl,
      });
      return NextResponse.json({ ok: true, summary });
    }

    return NextResponse.json({ error: 'Neznámá akce.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Akce se nezdařila.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
