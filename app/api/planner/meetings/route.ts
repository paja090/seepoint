import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { plannerApi } from '@/lib/planner/auth';
import { canSeeTeam } from '@/lib/planner/permissions';
import { preferencesFor, activeMembers } from '@/lib/planner/repository';
import { localInstant, plusDays } from '@/lib/planner/time';
import {
  analyzeMeetingTranscript,
  renderMeetingReportEmail,
  sanitizeMeetingEmailDefaults,
  sanitizeMeetingReports,
  type MeetingActionItemDraft,
  type MeetingReportRecord,
  type PulseMemberRef,
} from '@/lib/planner/team-pulse';
import { syncWorkOrderTasks } from '@/lib/work-task-sync';
import { sendTransactionalEmail } from '@/lib/email';
import { hasModuleAccess } from '@/lib/module-policy';
import { getAppOrigin } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

function asObject(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

async function resolveAndSendMeetingEmails(params: {
  organizationId: string;
  organizationName: string;
  report: MeetingReportRecord;
  baseUrl: string;
  recipientUserIds?: string[];
  extraEmails?: string[];
  includeAssignees?: boolean;
  includeManagers?: boolean;
}): Promise<{ sentCount: number; recipientEmails: string[] }> {
  const allActiveMembers = await prisma.organizationMember.findMany({
    where: {
      organizationId: params.organizationId,
      isActive: true,
      user: { status: 'ACTIVE', email: { not: '' } },
    },
    select: {
      userId: true,
      role: true,
      user: { select: { email: true, name: true } },
    },
  });

  const targetByEmail = new Map<
    string,
    { email: string; userId: string | null; name: string | null }
  >();

  const addMember = (m: (typeof allActiveMembers)[number]) => {
    const emailClean = m.user?.email?.trim().toLowerCase();
    if (!emailClean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) return;
    if (!targetByEmail.has(emailClean)) {
      targetByEmail.set(emailClean, {
        email: emailClean,
        userId: m.userId,
        name: m.user?.name || null,
      });
    }
  };

  if (Array.isArray(params.recipientUserIds) && params.recipientUserIds.length > 0) {
    const selectedSet = new Set(params.recipientUserIds);
    for (const m of allActiveMembers) {
      if (selectedSet.has(m.userId)) addMember(m);
    }
  } else {
    if (params.includeAssignees) {
      const assigneeIds = new Set(
        params.report.actionItems
          .map((i) => i.assigneeUserId)
          .filter((id): id is string => Boolean(id))
      );
      for (const m of allActiveMembers) {
        if (assigneeIds.has(m.userId)) addMember(m);
      }
    }
    if (params.includeManagers) {
      for (const m of allActiveMembers) {
        if (['OWNER', 'ADMIN', 'MANAGER'].includes(m.role)) addMember(m);
      }
    }
  }

  for (const extra of params.extraEmails ?? []) {
    const clean = extra.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) continue;
    if (!targetByEmail.has(clean)) {
      targetByEmail.set(clean, { email: clean, userId: null, name: null });
    }
  }

  let sentCount = 0;
  const recipientEmails: string[] = [];

  for (const target of targetByEmail.values()) {
    const rendered = renderMeetingReportEmail(
      params.report,
      params.organizationName,
      params.baseUrl,
      {
        recipientUserId: target.userId,
        recipientName: target.name,
      }
    );
    try {
      const res = await sendTransactionalEmail({
        to: target.email,
        bcc: [],
        subject: rendered.subject,
        message: rendered.text,
        template: 'meeting-report',
        customHtml: rendered.html,
        organizationId: params.organizationId,
        allowPlatformFallback: true,
      });
      if (res.status === 'sent') {
        sentCount++;
      }
      recipientEmails.push(target.email);
    } catch (err) {
      console.error('[planner-meetings] Failed to send email to', target.email, err);
    }
  }

  return { sentCount, recipientEmails };
}

export function POST(request: Request) {
  return plannerApi(request, async (actor) => {
    if (!canSeeTeam(actor)) {
      return new Response(JSON.stringify({ error: 'Zápisy z porad mohou vytvářet pouze vedoucí.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || 'analyze');
    const preferences = await preferencesFor(
      actor.organizationId,
      actor.id,
      actor.organization?.plannerDefaults
    );

    const membersList = await activeMembers(actor.organizationId);
    const pulseMembers: PulseMemberRef[] = membersList.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      employeeId: m.user.employees[0]?.id ?? null,
    }));

    if (action === 'analyze') {
      const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
      if (!transcript) {
        return new Response(JSON.stringify({ error: 'Vložte přepis nebo poznámky z porady.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const explicitTitle = typeof body.title === 'string' ? body.title.trim() : undefined;
      const meetingDate =
        typeof body.meetingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.meetingDate)
          ? body.meetingDate
          : new Date().toISOString().slice(0, 10);

      const analyzed = await analyzeMeetingTranscript({
        organizationId: actor.organizationId,
        userId: actor.id,
        transcript,
        explicitTitle,
        meetingDate,
        members: pulseMembers,
      });

      return {
        ok: true,
        draft: analyzed,
      };
    }

    if (action === 'commit') {
      const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Porada týmu';
      const meetingDate =
        typeof body.meetingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.meetingDate)
          ? body.meetingDate
          : new Date().toISOString().slice(0, 10);
      const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
      const decisions = Array.isArray(body.decisions)
        ? body.decisions.filter((d): d is string => typeof d === 'string' && Boolean(d.trim())).map((d) => d.trim())
        : [];
      const rawActionItems = Array.isArray(body.actionItems) ? body.actionItems : [];
      const sendEmail = Boolean(body.sendEmailToManagers);

      const canWork = hasModuleAccess(actor, 'work');
      const processedItems: MeetingActionItemDraft[] = [];

      for (let i = 0; i < rawActionItems.length; i++) {
        const itemObj = asObject(rawActionItems[i]);
        const itemTitle = typeof itemObj.title === 'string' ? itemObj.title.trim() : '';
        if (!itemTitle) continue;

        const assigneeUserId = typeof itemObj.assigneeUserId === 'string' ? itemObj.assigneeUserId : null;
        const assigneeName = typeof itemObj.assigneeName === 'string' ? itemObj.assigneeName : null;
        const dueDate =
          typeof itemObj.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(itemObj.dueDate)
            ? itemObj.dueDate
            : plusDays(meetingDate, 1);
        const priority =
          itemObj.priority === 'LOW' ||
          itemObj.priority === 'NORMAL' ||
          itemObj.priority === 'HIGH' ||
          itemObj.priority === 'URGENT'
            ? itemObj.priority
            : 'NORMAL';
        const estimatedHours =
          typeof itemObj.estimatedHours === 'number' && Number.isFinite(itemObj.estimatedHours)
            ? itemObj.estimatedHours
            : 1;

        const createWorkOrder = Boolean(itemObj.createWorkOrder && canWork);
        const addToMyPlannerBlock = Boolean(itemObj.addToMyPlannerBlock);
        const blockStartTime =
          typeof itemObj.blockStartTime === 'string' && /^\d{2}:\d{2}$/.test(itemObj.blockStartTime)
            ? itemObj.blockStartTime
            : '10:00';

        let createdWorkOrderId: string | null = null;
        let createdPlannerBlockId: string | null = null;

        // 1. Create WorkOrder in Plán práce if requested
        if (createWorkOrder) {
          try {
            const scheduledAt = localInstant(dueDate, '08:00', preferences.timezone);
            const order = await prisma.workOrder.create({
              data: {
                organizationId: actor.organizationId,
                title: itemTitle,
                description: `Úkol z porady: ${title} (${meetingDate})`,
                status: 'PLANNED',
                priority,
                workType: 'OTHER',
                scheduledAt,
                clientName: 'Interní / Porada',
                requestedBy: actor.name || 'Vedení',
                estimatedHours: new Prisma.Decimal(estimatedHours),
                assignments: assigneeName
                  ? {
                      create: [
                        {
                          organizationId: actor.organizationId,
                          userId: assigneeUserId,
                          workerName: assigneeName,
                        },
                      ],
                    }
                  : undefined,
              },
            });
            createdWorkOrderId = order.id;
            await syncWorkOrderTasks(order.id).catch(() => {});
          } catch (err) {
            console.error('[planner-meetings] Failed to create workOrder:', err);
          }
        }

        // 2. Add to Manager's own Planner block if requested
        if (addToMyPlannerBlock) {
          try {
            const startAt = localInstant(dueDate, blockStartTime, preferences.timezone);
            const durationMs = Math.round(estimatedHours * 60) * 60000;
            const endAt = new Date(+startAt + Math.max(15 * 60000, durationMs));

            const block = await prisma.plannerBlock.create({
              data: {
                organizationId: actor.organizationId,
                userId: actor.id,
                title: itemTitle,
                startAt,
                endAt,
                category: 'OPERATIONS',
                sourceKind: createdWorkOrderId ? 'WORK_ORDER' : null,
                sourceId: createdWorkOrderId,
                requestKey: crypto.randomUUID(),
              },
            });
            createdPlannerBlockId = block.id;
          } catch (err) {
            console.error('[planner-meetings] Failed to create plannerBlock:', err);
          }
        }

        processedItems.push({
          id: `saved-${i + 1}`,
          title: itemTitle,
          assigneeName,
          assigneeUserId,
          dueDate,
          priority,
          estimatedHours,
          createWorkOrder,
          addToMyPlannerBlock,
          blockStartTime,
          createdWorkOrderId,
          createdPlannerBlockId,
        });
      }

      const reportId = `meeting_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newReport: MeetingReportRecord = {
        id: reportId,
        title,
        meetingDate,
        createdAt: new Date().toISOString(),
        createdByName: actor.name || 'Manažer',
        sourceType: 'TRANSCRIPT',
        summary,
        decisions,
        actionItems: processedItems,
        emailedToCount: 0,
      };

      // Save into organization.plannerDefaults
      const org = await prisma.organization.findUnique({
        where: { id: actor.organizationId },
        select: { plannerDefaults: true, name: true },
      });
      const prevDefaults = asObject(org?.plannerDefaults);
      const existingReports = sanitizeMeetingReports(prevDefaults.meetingReports);
      const updatedReports = [newReport, ...existingReports.filter((r) => r.id !== reportId)].slice(0, 25);

      const recipientUserIds = Array.isArray(body.recipientUserIds)
        ? body.recipientUserIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
        : undefined;
      const extraEmails =
        typeof body.extraEmailsText === 'string'
          ? body.extraEmailsText.split(/[,;\s]+/).filter(Boolean)
          : Array.isArray(body.extraEmails)
          ? body.extraEmails.filter((e): e is string => typeof e === 'string')
          : [];
      const includeAssignees =
        typeof body.sendToAssignees === 'boolean' ? body.sendToAssignees : true;
      const includeManagers =
        typeof body.sendEmailToManagers === 'boolean' ? body.sendEmailToManagers : true;

      const shouldSend =
        sendEmail ||
        (recipientUserIds && recipientUserIds.length > 0) ||
        extraEmails.length > 0 ||
        includeAssignees;

      let sentEmailsList: string[] = [];
      if (shouldSend) {
        const emailOutcome = await resolveAndSendMeetingEmails({
          organizationId: actor.organizationId,
          organizationName: org?.name || 'SeePoint',
          report: newReport,
          baseUrl: getAppOrigin(request),
          recipientUserIds,
          extraEmails,
          includeAssignees,
          includeManagers,
        });
        newReport.emailedToCount = emailOutcome.sentCount || emailOutcome.recipientEmails.length;
        updatedReports[0].emailedToCount = newReport.emailedToCount;
        sentEmailsList = emailOutcome.recipientEmails;
      }

      const nextEmailDefaults = body.saveEmailDefaults
        ? sanitizeMeetingEmailDefaults({
            sendToAssignees: includeAssignees,
            sendToManagers: includeManagers,
            extraRecipients: extraEmails,
          })
        : prevDefaults.meetingEmailDefaults;

      await prisma.organization.update({
        where: { id: actor.organizationId },
        data: {
          plannerDefaults: {
            ...prevDefaults,
            meetingReports: updatedReports,
            ...(nextEmailDefaults ? { meetingEmailDefaults: nextEmailDefaults } : {}),
          },
        },
      });

      return {
        ok: true,
        report: newReport,
        sentEmails: sentEmailsList,
      };
    }

    if (action === 'resend_email') {
      const reportId = typeof body.reportId === 'string' ? body.reportId : '';
      const org = await prisma.organization.findUnique({
        where: { id: actor.organizationId },
        select: { plannerDefaults: true, name: true },
      });
      const prevDefaults = asObject(org?.plannerDefaults);
      const existingReports = sanitizeMeetingReports(prevDefaults.meetingReports);
      const report = existingReports.find((r) => r.id === reportId);
      if (!report) {
        return new Response(JSON.stringify({ error: 'Zápis z porady nebyl nalezen.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const recipientUserIds = Array.isArray(body.recipientUserIds)
        ? body.recipientUserIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
        : undefined;
      const extraEmails =
        typeof body.extraEmailsText === 'string'
          ? body.extraEmailsText.split(/[,;\s]+/).filter(Boolean)
          : [];

      const outcome = await resolveAndSendMeetingEmails({
        organizationId: actor.organizationId,
        organizationName: org?.name || 'SeePoint',
        report,
        baseUrl: getAppOrigin(request),
        recipientUserIds,
        extraEmails,
        includeAssignees: true,
        includeManagers: false,
      });

      return {
        ok: true,
        sentCount: outcome.sentCount,
        recipientEmails: outcome.recipientEmails,
      };
    }

    if (action === 'save_email_defaults') {
      const org = await prisma.organization.findUnique({
        where: { id: actor.organizationId },
        select: { plannerDefaults: true },
      });
      const prevDefaults = asObject(org?.plannerDefaults);
      const extraRecipients =
        typeof body.extraRecipientsText === 'string'
          ? body.extraRecipientsText.split(/[,;\s]+/).filter(Boolean)
          : Array.isArray(body.extraRecipients)
          ? body.extraRecipients.filter((r): r is string => typeof r === 'string')
          : [];

      const nextDefaults = sanitizeMeetingEmailDefaults({
        sendToAssignees: body.sendToAssignees,
        sendToManagers: body.sendToManagers,
        extraRecipients,
      });

      await prisma.organization.update({
        where: { id: actor.organizationId },
        data: {
          plannerDefaults: {
            ...prevDefaults,
            meetingEmailDefaults: nextDefaults,
          },
        },
      });

      return { ok: true, defaults: nextDefaults };
    }

    return new Response(JSON.stringify({ error: 'Neznámá akce.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}
