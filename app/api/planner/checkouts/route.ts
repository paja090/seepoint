import { prisma } from '@/lib/db';
import { plannerApi, type AuthenticatedPlannerActor } from '@/lib/planner/auth';
import { canSeeTeam } from '@/lib/planner/permissions';
import { activeMembers, preferencesFor } from '@/lib/planner/repository';
import { dateInZone, dayRange } from '@/lib/planner/time';
import { sendTransactionalEmail } from '@/lib/email';
import { buildCompanyAndMemberDailyPulse, type PulseMemberRef } from '@/lib/planner/team-pulse';
import {
  buildSalesDailySummary,
  buildUserAutoDaySummary,
  generateAiOwnerDigest,
  renderApprovalDecisionEmail,
  renderApprovalNotificationEmail,
  sanitizeApprovalRequests,
  sanitizeCheckouts,
  type ApprovalCategory,
  type ApprovalRequestRecord,
  type ApprovalStatus,
  type DailyCheckoutRecord,
} from '@/lib/planner/owner-reports';

export const dynamic = 'force-dynamic';

function asObject(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

async function computeDaySystemSnapshot(
  actor: AuthenticatedPlannerActor,
  date: string,
  timezone: string,
  members: PulseMemberRef[]
) {
  const { start, end } = dayRange(date, timezone);

  const [candidateOrders, dayWorkEntries, dayOffers, dayCrmTasks] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        organizationId: actor.organizationId,
        OR: [
          { scheduledAt: { gte: start, lt: end } },
          { updatedAt: { gte: start, lt: end } },
        ],
      },
      select: {
        id: true,
        title: true,
        clientName: true,
        status: true,
        scheduledAt: true,
        updatedAt: true,
        planningConstraints: true,
        assignments: {
          select: {
            userId: true,
            workerName: true,
            acknowledgedAt: true,
            note: true,
          },
        },
      },
      take: 200,
    }),
    prisma.workEntry.findMany({
      where: {
        organizationId: actor.organizationId,
        workDate: { gte: start, lt: end },
      },
      select: {
        id: true,
        employeeId: true,
        workOrderId: true,
        workTaskId: true,
        clientName: true,
        remunerationMethod: true,
        quantity: true,
        unit: true,
        note: true,
        workTask: { select: { title: true } },
      },
      take: 200,
    }),
    prisma.offer.findMany({
      where: {
        organizationId: actor.organizationId,
        archivedAt: null,
        OR: [
          { createdAt: { gte: start, lt: end } },
          { sentAt: { gte: start, lt: end } },
          { acceptedAt: { gte: start, lt: end } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        totalPrice: true,
        subtotal: true,
        createdByUserId: true,
        createdAt: true,
        sentAt: true,
        acceptedAt: true,
      },
      take: 150,
    }),
    prisma.crmTask.findMany({
      where: {
        organizationId: actor.organizationId,
        status: 'DONE',
        completedAt: { gte: start, lt: end },
      },
      select: {
        id: true,
        title: true,
        status: true,
        assignedUserId: true,
        completedAt: true,
      },
      take: 150,
    }),
  ]);

  const pulseResult = buildCompanyAndMemberDailyPulse({
    date,
    timezone,
    members,
    orders: candidateOrders,
    workEntries: dayWorkEntries.map((e) => ({
      id: e.id,
      employeeId: e.employeeId,
      workOrderId: e.workOrderId,
      workTaskId: e.workTaskId,
      clientName: e.clientName,
      remunerationMethod: e.remunerationMethod,
      quantity: Number(e.quantity),
      unit: e.unit,
      note: e.note,
      workTaskTitle: e.workTask?.title ?? null,
    })),
  });

  const sales = buildSalesDailySummary({
    date,
    timezone,
    members,
    offers: dayOffers.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      totalPrice: o.totalPrice ? Number(o.totalPrice) : null,
      subtotal: o.subtotal ? Number(o.subtotal) : null,
      createdByUserId: o.createdByUserId,
      createdAt: o.createdAt,
      sentAt: o.sentAt,
      acceptedAt: o.acceptedAt,
    })),
    crmTasks: dayCrmTasks,
  });

  return { pulseResult, sales };
}

export function POST(request: Request) {
  return plannerApi(request, async (actor) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || 'submit_checkout');

    const preferences = await preferencesFor(
      actor.organizationId,
      actor.id,
      actor.organization?.plannerDefaults
    );
    const todayStr = dateInZone(new Date(), preferences.timezone);
    const targetDate =
      typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : todayStr;

    const membersList = await activeMembers(actor.organizationId);
    const pulseMembers: PulseMemberRef[] = membersList.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      employeeId: m.user.employees[0]?.id ?? null,
    }));

    const org = await prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: { plannerDefaults: true, name: true },
    });
    const prevDefaults = asObject(org?.plannerDefaults);
    const orgName = org?.name || 'SeePoint';

    if (action === 'submit_checkout') {
      const manualSummary =
        typeof body.manualSummary === 'string' ? body.manualSummary.trim().slice(0, 1500) : '';
      const blockers =
        typeof body.blockers === 'string' && body.blockers.trim()
          ? body.blockers.trim().slice(0, 800)
          : null;

      if (!manualSummary && !blockers) {
        return new Response(
          JSON.stringify({ error: 'Napište alespoň krátkou větu o tom, co se dnes podařilo.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { pulseResult, sales } = await computeDaySystemSnapshot(
        actor,
        targetDate,
        preferences.timezone,
        pulseMembers
      );
      const autoSummary = buildUserAutoDaySummary({
        sales: sales.byUserId[actor.id],
        work: pulseResult.byUserId[actor.id],
      });

      const existingCheckouts = sanitizeCheckouts(prevDefaults.dailyCheckouts);
      const existingApprovals = sanitizeApprovalRequests(prevDefaults.approvalRequests);

      let approvalRequestId: string | null = null;
      let createdApproval: ApprovalRequestRecord | null = null;

      const rawApproval = asObject(body.approvalRequest);
      if (typeof rawApproval.title === 'string' && rawApproval.title.trim()) {
        const category = (['DISCOUNT', 'EXPENSE', 'SCHEDULE', 'COMMERCIAL', 'OTHER'].includes(
          String(rawApproval.category)
        )
          ? String(rawApproval.category)
          : 'OTHER') as ApprovalCategory;

        approvalRequestId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        createdApproval = {
          id: approvalRequestId,
          date: targetDate,
          requesterUserId: actor.id,
          requesterName: actor.name || 'Člen týmu',
          category,
          title: rawApproval.title.trim().slice(0, 180),
          detail:
            typeof rawApproval.detail === 'string'
              ? rawApproval.detail.trim().slice(0, 800)
              : blockers || manualSummary,
          amountLabel:
            typeof rawApproval.amountLabel === 'string' && rawApproval.amountLabel.trim()
              ? rawApproval.amountLabel.trim().slice(0, 60)
              : null,
          offerId: typeof rawApproval.offerId === 'string' ? rawApproval.offerId : null,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        };
      }

      const checkoutId = `chk_${targetDate}_${actor.id}`;
      const newCheckout: DailyCheckoutRecord = {
        id: checkoutId,
        date: targetDate,
        userId: actor.id,
        userName: actor.name || 'Člen týmu',
        submittedAt: new Date().toISOString(),
        autoSummary,
        manualSummary,
        blockers,
        approvalRequestId,
      };

      const updatedCheckouts = [
        newCheckout,
        ...existingCheckouts.filter((c) => !(c.date === targetDate && c.userId === actor.id)),
      ].slice(0, 120);

      const updatedApprovals = createdApproval
        ? [createdApproval, ...existingApprovals].slice(0, 100)
        : existingApprovals;

      await prisma.organization.update({
        where: { id: actor.organizationId },
        data: {
          plannerDefaults: {
            ...prevDefaults,
            dailyCheckouts: updatedCheckouts,
            approvalRequests: updatedApprovals,
          },
        },
      });

      if (createdApproval) {
        const owners = await prisma.organizationMember.findMany({
          where: {
            organizationId: actor.organizationId,
            isActive: true,
            role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
            user: { status: 'ACTIVE', email: { not: '' } },
          },
          select: { userId: true, user: { select: { email: true } } },
        });
        const rendered = renderApprovalNotificationEmail(createdApproval, orgName);
        for (const owner of owners) {
          if (owner.userId === actor.id || !owner.user?.email) continue;
          await sendTransactionalEmail({
            to: owner.user.email,
            subject: rendered.subject,
            message: rendered.text,
            template: 'owner-approval-request',
            customHtml: rendered.html,
            organizationId: actor.organizationId,
          }).catch(() => {});
        }
      }

      return {
        ok: true,
        checkout: newCheckout,
        approvalRequest: createdApproval,
      };
    }

    if (action === 'submit_approval') {
      const rawTitle = typeof body.title === 'string' ? body.title.trim() : '';
      if (!rawTitle) {
        return new Response(JSON.stringify({ error: 'Zadejte název požadavku ke schválení.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const category = (['DISCOUNT', 'EXPENSE', 'SCHEDULE', 'COMMERCIAL', 'OTHER'].includes(
        String(body.category)
      )
        ? String(body.category)
        : 'OTHER') as ApprovalCategory;

      const createdApproval: ApprovalRequestRecord = {
        id: `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: targetDate,
        requesterUserId: actor.id,
        requesterName: actor.name || 'Člen týmu',
        category,
        title: rawTitle.slice(0, 180),
        detail: typeof body.detail === 'string' ? body.detail.trim().slice(0, 800) : '',
        amountLabel:
          typeof body.amountLabel === 'string' && body.amountLabel.trim()
            ? body.amountLabel.trim().slice(0, 60)
            : null,
        offerId: typeof body.offerId === 'string' ? body.offerId : null,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      const existingApprovals = sanitizeApprovalRequests(prevDefaults.approvalRequests);
      await prisma.organization.update({
        where: { id: actor.organizationId },
        data: {
          plannerDefaults: {
            ...prevDefaults,
            approvalRequests: [createdApproval, ...existingApprovals].slice(0, 100),
          },
        },
      });

      const owners = await prisma.organizationMember.findMany({
        where: {
          organizationId: actor.organizationId,
          isActive: true,
          role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
          user: { status: 'ACTIVE', email: { not: '' } },
        },
        select: { userId: true, user: { select: { email: true } } },
      });
      const rendered = renderApprovalNotificationEmail(createdApproval, orgName);
      for (const owner of owners) {
        if (owner.userId === actor.id || !owner.user?.email) continue;
        await sendTransactionalEmail({
          to: owner.user.email,
          subject: rendered.subject,
          message: rendered.text,
          template: 'owner-approval-request',
          customHtml: rendered.html,
          organizationId: actor.organizationId,
        }).catch(() => {});
      }

      return { ok: true, approvalRequest: createdApproval };
    }

    if (action === 'decide_approval') {
      if (!canSeeTeam(actor)) {
        return new Response(
          JSON.stringify({ error: 'Rozhodovat o žádostech mohou pouze majitelé a manažeři.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const requestId = typeof body.requestId === 'string' ? body.requestId : '';
      const status = String(body.status) as ApprovalStatus;
      if (!['APPROVED', 'INFO_REQUESTED', 'REJECTED'].includes(status) || !requestId) {
        return new Response(JSON.stringify({ error: 'Neplatné parametry rozhodnutí.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const existingApprovals = sanitizeApprovalRequests(prevDefaults.approvalRequests);
      const targetIndex = existingApprovals.findIndex((a) => a.id === requestId);
      if (targetIndex === -1) {
        return new Response(JSON.stringify({ error: 'Žádost nebyla nalezena.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const updatedItem: ApprovalRequestRecord = {
        ...existingApprovals[targetIndex],
        status,
        decidedByUserId: actor.id,
        decidedByName: actor.name || 'Vedení',
        decisionNote:
          typeof body.decisionNote === 'string' && body.decisionNote.trim()
            ? body.decisionNote.trim().slice(0, 600)
            : null,
        decidedAt: new Date().toISOString(),
      };

      const nextApprovals = [...existingApprovals];
      nextApprovals[targetIndex] = updatedItem;

      await prisma.organization.update({
        where: { id: actor.organizationId },
        data: {
          plannerDefaults: {
            ...prevDefaults,
            approvalRequests: nextApprovals,
          },
        },
      });

      const requester = await prisma.user.findUnique({
        where: { id: updatedItem.requesterUserId },
        select: { email: true },
      });
      if (requester?.email) {
        const rendered = renderApprovalDecisionEmail(updatedItem, orgName);
        await sendTransactionalEmail({
          to: requester.email,
          subject: rendered.subject,
          message: rendered.text,
          template: 'owner-approval-decision',
          customHtml: rendered.html,
          organizationId: actor.organizationId,
        }).catch(() => {});
      }

      return { ok: true, approvalRequest: updatedItem };
    }

    if (action === 'ai_digest') {
      if (!canSeeTeam(actor)) {
        return new Response(JSON.stringify({ error: 'Pouze pro majitele a vedení.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { pulseResult, sales } = await computeDaySystemSnapshot(
        actor,
        targetDate,
        preferences.timezone,
        pulseMembers
      );
      const allCheckouts = sanitizeCheckouts(prevDefaults.dailyCheckouts).filter(
        (c) => c.date === targetDate
      );
      const checkoutsByUserId: Record<string, DailyCheckoutRecord> = {};
      for (const c of allCheckouts) {
        checkoutsByUserId[c.userId] = c;
      }
      const pendingApprovals = sanitizeApprovalRequests(prevDefaults.approvalRequests).filter(
        (a) => a.status === 'PENDING' || a.status === 'INFO_REQUESTED'
      );

      const digest = await generateAiOwnerDigest({
        organizationId: actor.organizationId,
        userId: actor.id,
        date: targetDate,
        companyPulse: pulseResult.companyPulse,
        sales,
        members: pulseMembers,
        checkoutsByUserId,
        pendingApprovals,
      });

      return { ok: true, digest };
    }

    return new Response(JSON.stringify({ error: 'Neznámá akce.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}
