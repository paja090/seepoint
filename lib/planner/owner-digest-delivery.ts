import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { dateInZone, dayRange } from './time';
import { activeMembers } from './repository';
import { buildCompanyAndMemberDailyPulse, type PulseMemberRef } from './team-pulse';
import {
  buildSalesDailySummary,
  generateAiOwnerDigest,
  renderOwnerExecutiveDigestEmail,
  sanitizeApprovalRequests,
  sanitizeCheckouts,
  sanitizeOwnerEmailDigestSettings,
  type DailyCheckoutRecord,
} from './owner-reports';
import { getGoogleSalesSheetSummary } from '@/lib/sales/google-sales-sync';
import { isSeePointOrganization } from '@/lib/work/google-sheets-sync';
import { sendTransactionalEmail } from '@/lib/email';

function asObject(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

export async function sendOwnerExecutiveDigestForOrganization(
  organizationId: string,
  options?: {
    date?: string;
    actorUserId?: string | null;
    force?: boolean;
    explicitRecipients?: string[];
    baseUrl?: string;
  }
): Promise<{
  date: string;
  recipientsCount: number;
  sentCount: number;
  skippedAlreadySentCount: number;
  skippedEnvCount: number;
  recipients: string[];
}> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, plannerDefaults: true },
  });
  if (!org) {
    throw new Error('Organizace nebyla nalezena.');
  }

  const isSeePoint = isSeePointOrganization(org);
  const prevDefaults = asObject(org.plannerDefaults);
  const settings = sanitizeOwnerEmailDigestSettings(prevDefaults.ownerEmailDigest, isSeePoint);
  const targetDate = options?.date || dateInZone(new Date(), settings.timezone);
  const { start, end } = dayRange(targetDate, settings.timezone);

  const membersList = await activeMembers(organizationId);
  const pulseMembers: PulseMemberRef[] = membersList.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    employeeId: m.user.employees[0]?.id ?? null,
  }));

  const [candidateOrders, dayWorkEntries, dayOffers, dayCrmTasks] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        organizationId,
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
        organizationId,
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
        organizationId,
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
        organizationId,
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
    date: targetDate,
    timezone: settings.timezone,
    members: pulseMembers,
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
    date: targetDate,
    timezone: settings.timezone,
    members: pulseMembers,
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

  const dayCheckouts = sanitizeCheckouts(prevDefaults.dailyCheckouts).filter(
    (c) => c.date === targetDate
  );
  const checkoutsByUserId: Record<string, DailyCheckoutRecord> = {};
  for (const c of dayCheckouts) {
    checkoutsByUserId[c.userId] = c;
  }

  const pendingApprovals = sanitizeApprovalRequests(prevDefaults.approvalRequests).filter(
    (a) => a.status === 'PENDING' || a.status === 'INFO_REQUESTED'
  );

  // Resolve target recipients
  const recipientSet = new Set<string>();
  if (options?.explicitRecipients && options.explicitRecipients.length > 0) {
    for (const r of options.explicitRecipients) {
      const clean = r.trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) recipientSet.add(clean);
    }
  } else {
    if (settings.includeAllAdminsAndOwners) {
      const owners = await prisma.organizationMember.findMany({
        where: {
          organizationId,
          isActive: true,
          role: { in: ['OWNER', 'ADMIN'] },
          user: { status: 'ACTIVE', email: { not: '' } },
        },
        select: { user: { select: { email: true } } },
      });
      for (const o of owners) {
        if (o.user?.email) recipientSet.add(o.user.email.trim().toLowerCase());
      }
    }
    for (const c of settings.customRecipients) {
      recipientSet.add(c.toLowerCase());
    }
    if (isSeePoint) {
      recipientSet.add('marek.konecny@seepoint.cz');
    }
  }

  const recipients = [...recipientSet];
  if (recipients.length === 0) {
    return {
      date: targetDate,
      recipientsCount: 0,
      sentCount: 0,
      skippedAlreadySentCount: 0,
      skippedEnvCount: 0,
      recipients: [],
    };
  }

  const alreadySentEmails = new Set<string>();
  if (!options?.force) {
    const recentLogs = await prisma.emailLog.findMany({
      where: {
        organizationId,
        template: 'owner-executive-digest',
        status: 'SENT',
        sentAt: { gte: new Date(Date.now() - 36 * 60 * 60 * 1000) },
      },
      select: { recipient: true, metadata: true },
    });
    for (const log of recentLogs) {
      const meta = asObject(log.metadata);
      if (meta.date === targetDate && meta.isManual !== true) {
        alreadySentEmails.add(log.recipient.trim().toLowerCase());
      }
    }
  }

  let salesSheet = null;
  try {
    salesSheet = await getGoogleSalesSheetSummary(organizationId);
  } catch (sheetErr) {
    console.warn('[owner-digest-delivery] Could not fetch sales sheet summary:', sheetErr);
  }

  const digest = await generateAiOwnerDigest({
    organizationId,
    userId: options?.actorUserId || pulseMembers[0]?.userId || 'system',
    date: targetDate,
    companyPulse: pulseResult.companyPulse,
    sales,
    members: pulseMembers,
    checkoutsByUserId,
    pendingApprovals,
    salesSheet,
  });

  const rendered = renderOwnerExecutiveDigestEmail({
    organizationName: org.name,
    date: targetDate,
    digest,
    sales,
    companyPulse: pulseResult.companyPulse,
    members: pulseMembers,
    checkoutsByUserId,
    pendingApprovals,
    salesSheet,
    baseUrl: options?.baseUrl,
  });

  let sentCount = 0;
  let skippedAlreadySentCount = 0;
  let skippedEnvCount = 0;

  for (const email of recipients) {
    if (alreadySentEmails.has(email)) {
      skippedAlreadySentCount++;
      continue;
    }

    const idempHash = crypto
      .createHash('sha256')
      .update(`${organizationId}:owner-digest:${targetDate}:${email}`)
      .digest('hex')
      .slice(0, 16);

    try {
      const result = await sendTransactionalEmail({
        to: email,
        bcc: [],
        subject: rendered.subject,
        message: rendered.text,
        customHtml: rendered.html,
        template: 'owner-executive-digest',
        organizationId,
        allowPlatformFallback: true,
        idempotencyKey: options?.force
          ? undefined
          : `owner-digest/${targetDate}/${idempHash}`,
        metadata: {
          date: targetDate,
          isManual: Boolean(options?.force),
        },
      });
      if (result.status === 'sent') sentCount++;
      else if (result.status === 'skipped') skippedEnvCount++;
    } catch (err) {
      console.error(`[owner-executive-digest] Failed sending to ${email}:`, err);
    }
  }

  return {
    date: targetDate,
    recipientsCount: recipients.length,
    sentCount,
    skippedAlreadySentCount,
    skippedEnvCount,
    recipients,
  };
}
