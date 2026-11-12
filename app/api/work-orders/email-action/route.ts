import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAppOrigin } from '@/lib/app-url';
import { runWithTenantContext, requireTenantContext } from '@/lib/tenant-context';
import { dayInZone } from '@/lib/field-planning/profile';
import { usesItemExecution } from '@/lib/field-planning/item-jobs';
import { czechFirstNameVocative, verifyBriefingAckToken } from '@/lib/work/briefing-ack';
import {
  addCalendarDays,
  DEFAULT_BRIEFING_TIMEZONE,
  formatCzechFullDate,
  matchWorkerAssignment,
  type WorkerRecipient,
} from '@/lib/work/daily-briefing';
import {
  rescheduleWorkOrderAction,
  updateWorkOrderStatusAction,
  WorkOrderActionError,
} from '@/lib/work/work-order-actions';

export const dynamic = 'force-dynamic';

const REASON_PRESETS = [
  'Nestihlo se časově',
  'Počasí / déšť',
  'Chybí materiál / podklady',
  'Klient nebyl k zastižení',
] as const;

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

function buildRecipientFromPayload(payload: NonNullable<ReturnType<typeof verifyBriefingAckToken>>): WorkerRecipient {
  const parts = payload.workerName.trim().split(/\s+/);
  return {
    key: payload.employeeId || payload.userId || payload.email,
    employeeId: payload.employeeId ?? undefined,
    userId: payload.userId ?? null,
    fullName: payload.workerName,
    firstName: parts[0] || payload.workerName,
    lastName: parts.slice(1).join(' '),
    email: payload.email,
    role: 'WORKER',
  };
}

function renderPage(input: {
  title: string;
  badgeEmoji: string;
  badgeBg: string;
  bodyHtml: string;
  footerLabel?: string;
  statusCode?: number;
}) {
  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)} – SeePoint OS</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .card {
      width: 100%;
      max-width: 500px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      padding: 28px 22px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    }
    .icon-box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 54px;
      height: 54px;
      border-radius: 16px;
      font-size: 26px;
      margin-bottom: 14px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 21px;
      line-height: 1.25;
      font-weight: 900;
      color: #0f172a;
    }
    .subtitle {
      margin: 0 0 18px;
      font-size: 14px;
      line-height: 1.5;
      color: #475569;
    }
    .summary {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 13px 15px;
      margin-bottom: 18px;
    }
    .summary-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px;
    }
    .summary-meta {
      font-size: 12.5px;
      color: #64748b;
      margin: 0;
    }
    .label {
      display: block;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
      margin: 0 0 8px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 12px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
      cursor: pointer;
    }
    .chip:has(input:checked) {
      border-color: #d97706;
      background: #fffbeb;
      color: #92400e;
    }
    textarea, input[type="date"] {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 11px 13px;
      font-family: inherit;
      font-size: 14px;
      color: #0f172a;
      background: #ffffff;
      margin-bottom: 16px;
    }
    .btn {
      display: inline-flex;
      width: 100%;
      align-items: center;
      justify-content: center;
      padding: 14px 18px;
      border: 0;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
    }
    .btn-green { background: #059669; color: #ffffff; }
    .btn-amber { background: #d97706; color: #ffffff; }
    .btn-dark { background: #0f172a; color: #ffffff; margin-top: 10px; }
    .footer {
      margin: 20px 0 0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <main class="card">
    <div style="text-align:center;">
      <div class="icon-box" style="background:${escapeHtml(input.badgeBg)};">${input.badgeEmoji}</div>
      <h1>${escapeHtml(input.title)}</h1>
    </div>
    ${input.bodyHtml}
    <p class="footer">${escapeHtml(input.footerLabel || 'SeePoint OS · Hlášení z denního plánu')}</p>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    status: input.statusCode ?? 200,
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
    return renderPage({
      title: 'Neplatný odkaz',
      badgeEmoji: '⚠️',
      badgeBg: '#fef2f2',
      statusCode: 400,
      bodyHtml:
        '<p class="subtitle" style="text-align:center;">Odkaz neobsahuje autorizační kód. Otevřete prosím úkol přímo v SeePoint OS.</p>',
    });
  }

  const payload = verifyBriefingAckToken(token);
  if (!payload || (payload.action !== 'complete' && payload.action !== 'reschedule')) {
    return renderPage({
      title: 'Platnost odkazu vypršela',
      badgeEmoji: '⚠️',
      badgeBg: '#fef2f2',
      statusCode: 403,
      bodyHtml:
        '<p class="subtitle" style="text-align:center;">Tento odkaz je neplatný nebo jeho platnost vypršela. Změnu můžete provést přímo v aplikaci SeePoint OS.</p>',
    });
  }

  const orderId = payload.orderIds[0];
  const order = await runWithTenantContext(
    {
      organizationId: payload.orgId,
      userId: payload.userId ?? undefined,
      source: 'session',
    },
    async () => {
      requireTenantContext();
      return prisma.workOrder.findFirst({
        where: { id: orderId, organizationId: payload.orgId },
        include: { items: true },
      });
    }
  );

  if (!order) {
    return renderPage({
      title: 'Úkol nebyl nalezen',
      badgeEmoji: '⚠️',
      badgeBg: '#fef2f2',
      statusCode: 404,
      bodyHtml:
        '<p class="subtitle" style="text-align:center;">Tento úkol už v systému pravděpodobně neexistuje nebo byl smazán.</p>',
    });
  }

  const origin = getAppOrigin(request);
  const vocative = czechFirstNameVocative(buildRecipientFromPayload(payload).firstName);
  const scheduledFormatted = order.scheduledAt.toLocaleDateString('cs-CZ', {
    timeZone: DEFAULT_BRIEFING_TIMEZONE,
  });
  const detailUrl = `${origin}/work/${order.id}`;

  const summaryBox = `<div class="summary">
    <p class="summary-title">${escapeHtml(order.title)}</p>
    <p class="summary-meta">${escapeHtml(order.clientName)} · Plánovaný termín: ${escapeHtml(
    scheduledFormatted
  )}</p>
  </div>`;

  if (payload.action === 'complete') {
    if (order.status === 'DONE') {
      return renderPage({
        title: `Hotovo, ${vocative}!`,
        badgeEmoji: '✅',
        badgeBg: '#ecfdf5',
        bodyHtml: `<p class="subtitle" style="text-align:center;">Tento úkol už je v SeePoint OS označený jako <strong>HOTOVÝ</strong>.</p>
          ${summaryBox}
          <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">Otevřít detail úkolu →</a>`,
      });
    }

    const allItemsDone =
      order.items.length > 0 &&
      order.items.every((i) => ['DONE', 'CANCELLED'].includes(i.executionStatus || ''));
    if (usesItemExecution(order.items) && !order.navigationOrderId && !allItemsDone) {
      const orderDay = dayInZone(order.scheduledAt, DEFAULT_BRIEFING_TIMEZONE);
      const routeUrl = `${origin}/my-route?date=${orderDay}`;
      return renderPage({
        title: 'Dokončete jednotlivé zastávky trasy',
        badgeEmoji: '🗺️',
        badgeBg: '#eff6ff',
        bodyHtml: `<p class="subtitle" style="text-align:center;">Tento výjezd obsahuje jednotlivé položky na trase, které je potřeba odkliknout v <strong>Moje trasa dnes</strong> (včetně případné fotodokumentace).</p>
          ${summaryBox}
          <a href="${escapeHtml(routeUrl)}" class="btn btn-dark">Otevřít Moje trasa dnes →</a>`,
      });
    }

    return renderPage({
      title: `Označit jako hotové`,
      badgeEmoji: '✅',
      badgeBg: '#ecfdf5',
      bodyHtml: `<p class="subtitle" style="text-align:center;">Ahoj <strong>${escapeHtml(
        vocative
      )}</strong>, potvrď jedním klepnutím, že je dnešní úkol hotový. Zároveň se automaticky zapíše do systému.</p>
        ${summaryBox}
        <form method="POST" action="/api/work-orders/email-action">
          <input type="hidden" name="token" value="${escapeHtml(token)}" />
          <label class="label" for="note">Volitelná poznámka k dokončení</label>
          <textarea id="note" name="note" rows="3" placeholder="Např. vše v pořádku předáno, polepeno čistě..."></textarea>
          <button type="submit" class="btn btn-green">✅ Potvrdit jako HOTOVÉ</button>
        </form>
        <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">Zobrazit detail v aplikaci →</a>`,
    });
  }

  // payload.action === 'reschedule'
  const todayStr = dayInZone(new Date(), DEFAULT_BRIEFING_TIMEZONE);
  const tomorrowStr = addCalendarDays(todayStr, 1);
  const dayAfterStr = addCalendarDays(todayStr, 2);
  const tomorrowLabel = formatCzechFullDate(tomorrowStr);
  const dayAfterLabel = formatCzechFullDate(dayAfterStr);

  const reasonChipsHtml = REASON_PRESETS.map(
    (preset, index) => `
      <label class="chip">
        <input type="radio" name="reason" value="${escapeHtml(preset)}" ${index === 0 ? 'checked' : ''} />
        <span>${escapeHtml(preset)}</span>
      </label>`
  ).join('');

  return renderPage({
    title: 'Nestihl jsem / Přesunout úkol',
    badgeEmoji: '⏳',
    badgeBg: '#fffbeb',
    bodyHtml: `<p class="subtitle" style="text-align:center;">Ahoj <strong>${escapeHtml(
      vocative
    )}</strong>, vyber důvod a nový den. Zakázka se rovnou přesune v Plánu práce i v Planneru a poznámka se uloží pro dispečink.</p>
      ${summaryBox}
      <form method="POST" action="/api/work-orders/email-action">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />

        <span class="label">1. Důvod (co se stalo)</span>
        <div class="chips">
          ${reasonChipsHtml}
          <label class="chip">
            <input type="radio" name="reason" value="" />
            <span>Jiný důvod (v poznámce)</span>
          </label>
        </div>

        <label class="label" for="note">2. Krátká poznámka pro tým</label>
        <textarea id="note" name="note" rows="3" placeholder="Např. nestihlo se kvůli dešti, zbývají 2 ks na zítra ráno..."></textarea>

        <span class="label">3. Na kdy úkol přesunout</span>
        <div class="chips">
          <label class="chip">
            <input type="radio" name="dateChoice" value="${escapeHtml(tomorrowStr)}" checked />
            <span>Zítra (${escapeHtml(tomorrowLabel)})</span>
          </label>
          <label class="chip">
            <input type="radio" name="dateChoice" value="${escapeHtml(dayAfterStr)}" />
            <span>Pozítří (${escapeHtml(dayAfterLabel)})</span>
          </label>
          <label class="chip">
            <input type="radio" name="dateChoice" value="custom" />
            <span>Jiný den níže</span>
          </label>
        </div>

        <input type="date" name="customDate" value="${escapeHtml(tomorrowStr)}" min="${escapeHtml(todayStr)}" aria-label="Vlastní datum přesunu" />

        <button type="submit" class="btn btn-amber">📅 Přesunout a uložit poznámku</button>
      </form>
      <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">Otevřít detail v aplikaci →</a>`,
  });
}

export async function POST(request: Request) {
  let token = '';
  let note = '';
  let reason = '';
  let targetDate = '';

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    token = typeof body?.token === 'string' ? body.token.trim() : '';
    note = typeof body?.note === 'string' ? body.note.trim() : '';
    reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    targetDate = typeof body?.targetDate === 'string' ? body.targetDate.trim() : '';
  } else {
    const formData = await request.formData().catch(() => null);
    if (formData) {
      token = String(formData.get('token') ?? '').trim();
      note = String(formData.get('note') ?? '').trim();
      reason = String(formData.get('reason') ?? '').trim();
      const dateChoice = String(formData.get('dateChoice') ?? '').trim();
      const customDate = String(formData.get('customDate') ?? '').trim();
      targetDate =
        dateChoice && dateChoice !== 'custom' ? dateChoice : customDate || String(formData.get('targetDate') ?? '').trim();
    }
  }

  if (!token) {
    return renderPage({
      title: 'Neplatný požadavek',
      badgeEmoji: '⚠️',
      badgeBg: '#fef2f2',
      statusCode: 400,
      bodyHtml: '<p class="subtitle" style="text-align:center;">Chybí ověřovací kód formuláře.</p>',
    });
  }

  const payload = verifyBriefingAckToken(token);
  if (!payload || (payload.action !== 'complete' && payload.action !== 'reschedule')) {
    return renderPage({
      title: 'Platnost odkazu vypršela',
      badgeEmoji: '⚠️',
      badgeBg: '#fef2f2',
      statusCode: 403,
      bodyHtml:
        '<p class="subtitle" style="text-align:center;">Platnost odkazu vypršela nebo je kód neplatný. Přihlaste se prosím do SeePoint OS.</p>',
    });
  }

  const orderId = payload.orderIds[0];
  const recipient = buildRecipientFromPayload(payload);
  const vocative = czechFirstNameVocative(recipient.firstName);
  const origin = getAppOrigin(request);
  const detailUrl = `${origin}/work/${orderId}`;
  const now = new Date();
  const timeFormatted = now.toLocaleString('cs-CZ', { timeZone: DEFAULT_BRIEFING_TIMEZONE });

  const matcher = (assignment: { userId: string | null; workerName: string }) =>
    matchWorkerAssignment(assignment, [recipient]).length > 0;

  try {
    if (payload.action === 'complete') {
      const result = await runWithTenantContext(
        {
          organizationId: payload.orgId,
          userId: payload.userId ?? undefined,
          source: 'session',
        },
        async () => {
          requireTenantContext();
          return updateWorkOrderStatusAction({
            organizationId: payload.orgId,
            workOrderId: orderId,
            status: 'DONE',
            note,
            actor: {
              userId: payload.userId,
              employeeId: payload.employeeId,
              email: payload.email,
              name: payload.workerName,
            },
            viaEmail: true,
            assignmentMatcher: matcher,
            now,
          });
        }
      );

      return renderPage({
        title: `Díky, ${vocative}! Úkol je hotový.`,
        badgeEmoji: '✅',
        badgeBg: '#ecfdf5',
        bodyHtml: `<p class="subtitle" style="text-align:center;">Stav <strong>HOTOVO</strong> byl ihned uložen do SeePoint OS (${escapeHtml(
          timeFormatted
        )}).</p>
          <div class="summary">
            <p class="summary-title">${escapeHtml(result.order.title)}</p>
            <p class="summary-meta">${escapeHtml(result.order.clientName)}${
          note ? ` · Poznámka: ${escapeHtml(note)}` : ''
        }</p>
          </div>
          <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">Otevřít detail úkolu →</a>`,
      });
    }

    // payload.action === 'reschedule'
    const fallbackTomorrow = addCalendarDays(dayInZone(now, DEFAULT_BRIEFING_TIMEZONE), 1);
    const chosenDate = targetDate || fallbackTomorrow;

    const result = await runWithTenantContext(
      {
        organizationId: payload.orgId,
        userId: payload.userId ?? undefined,
        source: 'session',
      },
      async () => {
        requireTenantContext();
        return rescheduleWorkOrderAction({
          organizationId: payload.orgId,
          workOrderId: orderId,
          targetDate: chosenDate,
          reason,
          note,
          actorName: payload.workerName,
          viaEmail: true,
          assignmentMatcher: matcher,
          now,
        });
      }
    );

    return renderPage({
      title: `Uloženo, ${vocative}! Úkol přesunut.`,
      badgeEmoji: '📅',
      badgeBg: '#fffbeb',
      bodyHtml: `<p class="subtitle" style="text-align:center;">Úkol byl přesunut na <strong>${escapeHtml(
        result.newDateStr
      )}</strong> a poznámka byla uložena do SeePoint OS (${escapeHtml(timeFormatted)}).</p>
        <div class="summary">
          <p class="summary-title">${escapeHtml(result.workOrder.title)}</p>
          <p class="summary-meta">${escapeHtml(result.workOrder.clientName)} · Nový termín: ${escapeHtml(
        result.newDateStr
      )}${result.combinedReason ? ` · Důvod: ${escapeHtml(result.combinedReason)}` : ''}</p>
        </div>
        <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">Otevřít detail úkolu →</a>`,
    });
  } catch (err) {
    if (err instanceof WorkOrderActionError) {
      return renderPage({
        title: 'Úpravu se nepodařilo provést',
        badgeEmoji: '⚠️',
        badgeBg: '#fef2f2',
        statusCode: err.statusCode,
        bodyHtml: `<p class="subtitle" style="text-align:center;">${escapeHtml(err.message)}</p>
          <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">Otevřít úkol v aplikaci →</a>`,
      });
    }
    console.error('[work-orders/email-action] Unexpected error:', err);
    return renderPage({
      title: 'Došlo k neočekávané chybě',
      badgeEmoji: '⚠️',
      badgeBg: '#fef2f2',
      statusCode: 500,
      bodyHtml: `<p class="subtitle" style="text-align:center;">Změnu se nepodařilo uložit. Otevřete prosím úkol přímo v SeePoint OS.</p>
        <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">Otevřít úkol v aplikaci →</a>`,
    });
  }
}
