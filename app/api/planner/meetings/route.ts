import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { plannerApi } from '@/lib/planner/auth';
import { canSeeTeam } from '@/lib/planner/permissions';
import { preferencesFor, activeMembers } from '@/lib/planner/repository';
import { localInstant, plusDays } from '@/lib/planner/time';
import {
  analyzeMeetingTranscript,
  renderMeetingReportEmail,
  sanitizeMeetingReports,
  type MeetingActionItemDraft,
  type MeetingReportRecord,
  type PulseMemberRef,
} from '@/lib/planner/team-pulse';
import { syncWorkOrderTasks } from '@/lib/work-task-sync';
import { sendTransactionalEmail } from '@/lib/email';
import { hasModuleAccess } from '@/lib/module-policy';

export const dynamic = 'force-dynamic';

function asObject(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
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

      let emailedToCount = 0;
      if (sendEmail) {
        const managers = await prisma.organizationMember.findMany({
          where: {
            organizationId: actor.organizationId,
            isActive: true,
            role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
            user: { status: 'ACTIVE', email: { not: '' } },
          },
          select: { user: { select: { email: true, name: true } } },
        });

        const orgName = org?.name || 'SeePoint';
        const rendered = renderMeetingReportEmail(newReport, orgName);

        for (const m of managers) {
          if (!m.user?.email) continue;
          try {
            await sendTransactionalEmail({
              to: m.user.email,
              subject: rendered.subject,
              message: rendered.text,
              template: 'meeting-report',
              customHtml: rendered.html,
              organizationId: actor.organizationId,
            });
            emailedToCount++;
          } catch (err) {
            console.error('[planner-meetings] Failed to send email to', m.user.email, err);
          }
        }
        newReport.emailedToCount = emailedToCount;
        updatedReports[0].emailedToCount = emailedToCount;
      }

      await prisma.organization.update({
        where: { id: actor.organizationId },
        data: {
          plannerDefaults: {
            ...prevDefaults,
            meetingReports: updatedReports,
          },
        },
      });

      return {
        ok: true,
        report: newReport,
      };
    }

    return new Response(JSON.stringify({ error: 'Neznámá akce.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}
