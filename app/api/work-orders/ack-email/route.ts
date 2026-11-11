import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runWithTenantContext, requireTenantContext } from '@/lib/tenant-context';
import { czechFirstNameVocative, verifyBriefingAckToken } from '@/lib/work/briefing-ack';
import { matchWorkerAssignment, type WorkerRecipient } from '@/lib/work/daily-briefing';
import { getAppOrigin } from '@/lib/app-url';

export const dynamic = 'force-dynamic';

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (ch) => entities[ch]);
}

function renderHtmlResponse(input: {
  ok: boolean;
  title: string;
  subtitle: string;
  details?: string[];
  actionUrl?: string;
  actionLabel?: string;
  statusCode?: number;
}) {
  const detailsHtml =
    input.details && input.details.length > 0
      ? `<ul style="margin:18px 0;padding:0;list-style:none;text-align:left;">
          ${input.details
            .map(
              (item) =>
                `<li style="padding:10px 14px;margin-bottom:8px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:14px;font-weight:700;color:#0f172a;">✅ ${escapeHtml(item)}</li>`
            )
            .join('')}
        </ul>`
      : '';

  const buttonHtml = input.actionUrl
    ? `<div style="margin-top:24px;">
        <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:12px 22px;border-radius:12px;background:#0f172a;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;">
          ${escapeHtml(input.actionLabel || 'Otevřít v SeePoint OS')} →
        </a>
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)} – SeePoint OS</title>
</head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;">
  <main style="width:100%;max-width:480px;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:32px 26px;text-align:center;box-shadow:0 12px 30px rgba(15,23,42,0.08);">
    <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:18px;background:${input.ok ? '#ecfdf5' : '#fef2f2'};font-size:28px;margin-bottom:16px;">
      ${input.ok ? '✅' : '⚠️'}
    </div>
    <h1 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#0f172a;">
      ${escapeHtml(input.title)}
    </h1>
    <p style="margin:0;font-size:14.5px;line-height:1.55;color:#475569;">
      ${escapeHtml(input.subtitle)}
    </p>
    ${detailsHtml}
    ${buttonHtml}
    <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
      SeePoint OS · Potvrzení převzetí práce
    </p>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    status: input.statusCode ?? (input.ok ? 200 : 400),
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token')?.trim();

  if (!token) {
    return renderHtmlResponse({
      ok: false,
      title: 'Neplatný odkaz pro potvrzení',
      subtitle: 'Odkaz neobsahuje potvrzovací kód. Otevřete prosím úkol přímo v SeePoint OS.',
      statusCode: 400,
    });
  }

  const payload = verifyBriefingAckToken(token);
  if (!payload) {
    return renderHtmlResponse({
      ok: false,
      title: 'Platnost odkazu vypršela',
      subtitle:
        'Tento potvrzovací odkaz je neplatný nebo jeho platnost vypršela. Přihlaste se prosím do SeePoint OS.',
      statusCode: 403,
    });
  }

  const parts = payload.workerName.trim().split(/\s+/);
  const recipientObj: WorkerRecipient = {
    key: payload.employeeId || payload.userId || payload.email,
    employeeId: payload.employeeId ?? undefined,
    userId: payload.userId ?? null,
    fullName: payload.workerName,
    firstName: parts[0] || payload.workerName,
    lastName: parts.slice(1).join(' '),
    email: payload.email,
    role: 'WORKER',
  };

  const now = new Date();
  const confirmedTitles: string[] = [];

  await runWithTenantContext(
    {
      organizationId: payload.orgId,
      userId: payload.userId ?? undefined,
      source: 'session',
    },
    async () => {
      requireTenantContext();

      const orders = await prisma.workOrder.findMany({
        where: {
          organizationId: payload.orgId,
          id: { in: payload.orderIds },
        },
        include: {
          assignments: true,
        },
      });

      for (const order of orders) {
        const matchingAssignments = order.assignments.filter(
          (a) =>
            matchWorkerAssignment(
              { userId: a.userId, workerName: a.workerName },
              [recipientObj]
            ).length > 0
        );

        if (matchingAssignments.length > 0) {
          for (const a of matchingAssignments) {
            if (!a.acknowledgedAt || (!a.userId && payload.userId)) {
              await prisma.workAssignment.update({
                where: { id: a.id },
                data: {
                  acknowledgedAt: a.acknowledgedAt ?? now,
                  ...(payload.userId && !a.userId ? { userId: payload.userId } : {}),
                  ...(!a.note ? { note: 'Potvrzeno kliknutím z e-mailu' } : {}),
                },
              });
            }
          }
        } else {
          await prisma.workAssignment.create({
            data: {
              organizationId: payload.orgId,
              workOrderId: order.id,
              userId: payload.userId ?? null,
              workerName: payload.workerName,
              acknowledgedAt: now,
              note: 'Potvrzeno kliknutím z e-mailu',
            },
          });
        }

        confirmedTitles.push(order.title);
      }
    }
  );

  if (confirmedTitles.length === 0) {
    return renderHtmlResponse({
      ok: false,
      title: 'Úkol nebyl nalezen',
      subtitle: 'Tento úkol již pravděpodobně v systému neexistuje nebo byl smazán.',
      statusCode: 404,
    });
  }

  const origin = getAppOrigin(request);
  const vocative = czechFirstNameVocative(recipientObj.firstName);
  const timeFormatted = now.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });

  const actionUrl =
    payload.orderIds.length === 1
      ? `${origin}/work/${payload.orderIds[0]}`
      : `${origin}/my-tasks`;
  const actionLabel =
    payload.orderIds.length === 1 ? 'Zobrazit detail úkolu' : 'Otevřít moje úkoly';

  return renderHtmlResponse({
    ok: true,
    title:
      confirmedTitles.length === 1
        ? `Díky, ${vocative}! Úkol je potvrzen.`
        : `Díky, ${vocative}! Potvrzeno (${confirmedTitles.length}).`,
    subtitle: `Tvé potvrzení („Vím o tom“) bylo ihned zapsáno do SeePoint OS (${timeFormatted}).`,
    details: confirmedTitles,
    actionUrl,
    actionLabel,
  });
}
