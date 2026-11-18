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

  const focusOrderId = url.searchParams.get('focus')?.trim() || '';
  const ordersRaw = await runWithTenantContext(
    {
      organizationId: payload.orgId,
      userId: payload.userId ?? undefined,
      source: 'session',
    },
    async () => {
      requireTenantContext();
      return prisma.workOrder.findMany({
        where: { id: { in: payload.orderIds }, organizationId: payload.orgId },
        include: { items: true },
      });
    }
  );

  const orderById = new Map(ordersRaw.map((o) => [o.id, o]));
  const orders = payload.orderIds
    .map((id) => orderById.get(id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  if (orders.length === 0) {
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
  const order = orders.find((o) => o.id === focusOrderId) || orders[0];
  const scheduledFormatted = order.scheduledAt.toLocaleDateString('cs-CZ', {
    timeZone: DEFAULT_BRIEFING_TIMEZONE,
  });
  const detailUrl = orders.length > 1 ? `${origin}/my-tasks` : `${origin}/work/${order.id}`;

  const renderChecklistHtml = () => {
    if (orders.length === 1) {
      return `<div class="summary">
        <input type="hidden" name="selectedOrderIds" value="${escapeHtml(order.id)}" />
        <p class="summary-title">${escapeHtml(order.title)}</p>
        <p class="summary-meta">${escapeHtml(order.clientName)} · Plánovaný termín: ${escapeHtml(
          scheduledFormatted
        )}</p>
      </div>`;
    }

    const itemsHtml = orders
      .map((o, idx) => {
        const isDone = o.status === 'DONE';
        const isChecked = !isDone && (!focusOrderId || o.id === focusOrderId);
        const dateStr = o.scheduledAt.toLocaleDateString('cs-CZ', {
          timeZone: DEFAULT_BRIEFING_TIMEZONE,
        });
        return `
          <label style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;margin-bottom:8px;border-radius:12px;border:1px solid ${
            isDone ? '#a7f3d0' : '#cbd5e1'
          };background:${isDone ? '#f0fdf4' : '#ffffff'};cursor:pointer;">
            <input
              type="checkbox"
              class="task-cb"
              name="selectedOrderIds"
              value="${escapeHtml(o.id)}"
              ${isChecked ? 'checked' : ''}
              style="width:20px;height:20px;margin-top:2px;accent-color:#059669;flex-shrink:0;"
            />
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;font-weight:800;color:#0f172a;line-height:1.35;">
                ${idx + 1}. ${escapeHtml(o.title)}
                ${
                  isDone
                    ? '<span style="display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;background:#d1fae5;color:#065f46;font-size:10.5px;font-weight:800;">✓ Již hotovo</span>'
                    : ''
                }
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:3px;">
                ${escapeHtml(o.clientName)} · Termín: ${escapeHtml(dateStr)}
              </div>
            </div>
          </label>`;
      })
      .join('');

    return `
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span class="label" style="margin:0;">Vyber úkoly (${orders.length}):</span>
          <div style="display:flex;gap:6px;">
            <button type="button" onclick="document.querySelectorAll('.task-cb').forEach(c => c.checked = true)" style="padding:5px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;font-size:11.5px;font-weight:800;color:#0f172a;cursor:pointer;">☑️ Vybrat vše</button>
            <button type="button" onclick="document.querySelectorAll('.task-cb').forEach(c => c.checked = false)" style="padding:5px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;font-size:11.5px;font-weight:700;color:#64748b;cursor:pointer;">⬜ Zrušit výběr</button>
          </div>
        </div>
        ${itemsHtml}
      </div>`;
  };

  if (payload.action === 'complete') {
    if (orders.length === 1 && order.status === 'DONE') {
      return renderPage({
        title: `Hotovo, ${vocative}!`,
        badgeEmoji: '✅',
        badgeBg: '#ecfdf5',
        bodyHtml: `<p class="subtitle" style="text-align:center;">Tento úkol už je v SeePoint OS označený jako <strong>HOTOVÝ</strong>.</p>
          ${renderChecklistHtml()}
          <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">Otevřít detail úkolu →</a>`,
      });
    }

    const allItemsDone =
      order.items.length > 0 &&
      order.items.every((i) => ['DONE', 'CANCELLED'].includes(i.executionStatus || ''));
    if (orders.length === 1 && usesItemExecution(order.items) && !order.navigationOrderId && !allItemsDone) {
      const orderDay = dayInZone(order.scheduledAt, DEFAULT_BRIEFING_TIMEZONE);
      const routeUrl = `${origin}/my-route?date=${orderDay}`;
      return renderPage({
        title: 'Dokončete jednotlivé zastávky trasy',
        badgeEmoji: '🗺️',
        badgeBg: '#eff6ff',
        bodyHtml: `<p class="subtitle" style="text-align:center;">Tento výjezd obsahuje jednotlivé položky na trase, které je potřeba odkliknout v <strong>Moje trasa dnes</strong> (včetně případné fotodokumentace).</p>
          ${renderChecklistHtml()}
          <a href="${escapeHtml(routeUrl)}" class="btn btn-dark">Otevřít Moje trasa dnes →</a>`,
      });
    }

    return renderPage({
      title: orders.length > 1 ? `Označit vybrané úkoly jako hotové` : `Označit jako hotové`,
      badgeEmoji: '✅',
      badgeBg: '#ecfdf5',
      bodyHtml: `<p class="subtitle" style="text-align:center;">Ahoj <strong>${escapeHtml(
        vocative
      )}</strong>, ${
        orders.length > 1
          ? 'zaškrtni všechny úkoly, které máš hotové, a potvrď je jedním kliknutím najednou.'
          : 'potvrď jedním klepnutím, že je dnešní úkol hotový. Zároveň se automaticky zapíše do systému.'
      }</p>
        <form method="POST" action="/api/work-orders/email-action">
          <input type="hidden" name="token" value="${escapeHtml(token)}" />
          ${renderChecklistHtml()}
          <label class="label" for="note">Volitelná poznámka k dokončení</label>
          <textarea id="note" name="note" rows="3" placeholder="Např. vše v pořádku předáno, polepeno čistě..."></textarea>
          <button type="submit" class="btn btn-green">✅ Potvrdit zaškrtnuté jako HOTOVÉ</button>
        </form>
        <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">${
        orders.length > 1 ? 'Otevřít moje úkoly v aplikaci →' : 'Zobrazit detail v aplikaci →'
      }</a>`,
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
    title: orders.length > 1 ? 'Hromadný přesun / uzavření úkolů' : 'Nestihl jsem / Přesunout úkol',
    badgeEmoji: '⏳',
    badgeBg: '#fffbeb',
    bodyHtml: `<p class="subtitle" style="text-align:center;">Ahoj <strong>${escapeHtml(
      vocative
    )}</strong>, ${
      orders.length > 1
        ? 'zaškrtni úkoly, které chceš přesunout na jiný den (nebo je rovnou označ jako hotové).'
        : 'vyber důvod a nový den. Zakázka se rovnou přesune v Plánu práce i v Planneru a poznámka se uloží pro dispečink.'
    }</p>
      <form method="POST" action="/api/work-orders/email-action">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        ${renderChecklistHtml()}

        <span class="label">1. Důvod (pokud přesouváš)</span>
        <div class="chips">
          ${reasonChipsHtml}
          <label class="chip">
            <input type="radio" name="reason" value="" />
            <span>Jiný důvod (v poznámce)</span>
          </label>
        </div>

        <label class="label" for="note">2. Krátká poznámka pro tým</label>
        <textarea id="note" name="note" rows="3" placeholder="Např. nestihlo se kvůli dešti, zbývají 2 ks na zítra ráno..."></textarea>

        <span class="label">3. Na kdy zaškrtnuté úkoly přesunout</span>
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

        <button type="submit" name="actionOverride" value="reschedule" class="btn btn-amber">📅 Přesunout zaškrtnuté a uložit poznámku</button>
        ${
          orders.length > 1
            ? `<button type="submit" name="actionOverride" value="complete" class="btn btn-green" style="margin-top:8px;">✅ Nebo zaškrtnuté označit jako HOTOVÉ</button>`
            : ''
        }
      </form>
      <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">${
      orders.length > 1 ? 'Otevřít moje úkoly v aplikaci →' : 'Otevřít detail v aplikaci →'
    }</a>`,
  });
}

export async function POST(request: Request) {
  let token = '';
  let note = '';
  let reason = '';
  let targetDate = '';
  let actionOverride = '';
  let rawSelectedIds: string[] = [];

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    token = typeof body?.token === 'string' ? body.token.trim() : '';
    note = typeof body?.note === 'string' ? body.note.trim() : '';
    reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    targetDate = typeof body?.targetDate === 'string' ? body.targetDate.trim() : '';
    actionOverride = typeof body?.actionOverride === 'string' ? body.actionOverride.trim() : '';
    if (Array.isArray(body?.selectedOrderIds)) {
      rawSelectedIds = body.selectedOrderIds.map((id) => String(id).trim()).filter(Boolean);
    }
  } else {
    const formData = await request.formData().catch(() => null);
    if (formData) {
      token = String(formData.get('token') ?? '').trim();
      note = String(formData.get('note') ?? '').trim();
      reason = String(formData.get('reason') ?? '').trim();
      actionOverride = String(formData.get('actionOverride') ?? '').trim();
      rawSelectedIds = formData
        .getAll('selectedOrderIds')
        .map((id) => String(id).trim())
        .filter(Boolean);
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

  const allowedSet = new Set(payload.orderIds);
  const selectedIds = rawSelectedIds.filter((id) => allowedSet.has(id));
  const targetOrderIds = selectedIds.length > 0 ? selectedIds : [payload.orderIds[0]];
  const effectiveAction =
    actionOverride === 'complete' || actionOverride === 'reschedule'
      ? actionOverride
      : payload.action;

  const recipient = buildRecipientFromPayload(payload);
  const vocative = czechFirstNameVocative(recipient.firstName);
  const origin = getAppOrigin(request);
  const detailUrl =
    targetOrderIds.length > 1 ? `${origin}/my-tasks` : `${origin}/work/${targetOrderIds[0]}`;
  const now = new Date();
  const timeFormatted = now.toLocaleString('cs-CZ', { timeZone: DEFAULT_BRIEFING_TIMEZONE });

  const matcher = (assignment: { userId: string | null; workerName: string }) =>
    matchWorkerAssignment(assignment, [recipient]).length > 0;

  try {
    if (effectiveAction === 'complete') {
      const completedOrders = await runWithTenantContext(
        {
          organizationId: payload.orgId,
          userId: payload.userId ?? undefined,
          source: 'session',
        },
        async () => {
          requireTenantContext();
          const results: Array<{ id: string; title: string; clientName: string }> = [];
          for (const oid of targetOrderIds) {
            const res = await updateWorkOrderStatusAction({
              organizationId: payload.orgId,
              workOrderId: oid,
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
            results.push(res.order);
          }
          return results;
        }
      );

      const summariesHtml = completedOrders
        .map(
          (o) => `<div class="summary" style="margin-bottom:10px;">
            <p class="summary-title">✅ ${escapeHtml(o.title)}</p>
            <p class="summary-meta">${escapeHtml(o.clientName)}${
            note ? ` · Poznámka: ${escapeHtml(note)}` : ''
          }</p>
          </div>`
        )
        .join('');

      return renderPage({
        title:
          completedOrders.length > 1
            ? `Díky, ${vocative}! Hotovo (${completedOrders.length}).`
            : `Díky, ${vocative}! Úkol je hotový.`,
        badgeEmoji: '✅',
        badgeBg: '#ecfdf5',
        bodyHtml: `<p class="subtitle" style="text-align:center;">Stav <strong>HOTOVO</strong> u ${
          completedOrders.length > 1 ? `${completedOrders.length} úkolů` : 'úkolu'
        } byl ihned uložen do SeePoint OS (${escapeHtml(timeFormatted)}).</p>
          ${summariesHtml}
          <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">${
          completedOrders.length > 1 ? 'Otevřít moje úkoly →' : 'Otevřít detail úkolu →'
        }</a>`,
      });
    }

    // effectiveAction === 'reschedule'
    const fallbackTomorrow = addCalendarDays(dayInZone(now, DEFAULT_BRIEFING_TIMEZONE), 1);
    const chosenDate = targetDate || fallbackTomorrow;

    const movedOrders = await runWithTenantContext(
      {
        organizationId: payload.orgId,
        userId: payload.userId ?? undefined,
        source: 'session',
      },
      async () => {
        requireTenantContext();
        const results: Array<{
          title: string;
          clientName: string;
          newDateStr: string;
          combinedReason: string | null;
        }> = [];
        for (const oid of targetOrderIds) {
          const res = await rescheduleWorkOrderAction({
            organizationId: payload.orgId,
            workOrderId: oid,
            targetDate: chosenDate,
            reason,
            note,
            actorName: payload.workerName,
            viaEmail: true,
            assignmentMatcher: matcher,
            now,
          });
          results.push({
            title: res.workOrder.title,
            clientName: res.workOrder.clientName,
            newDateStr: res.newDateStr,
            combinedReason: res.combinedReason,
          });
        }
        return results;
      }
    );

    const movedHtml = movedOrders
      .map(
        (m) => `<div class="summary" style="margin-bottom:10px;">
          <p class="summary-title">📅 ${escapeHtml(m.title)}</p>
          <p class="summary-meta">${escapeHtml(m.clientName)} · Nový termín: ${escapeHtml(
          m.newDateStr
        )}${m.combinedReason ? ` · Důvod: ${escapeHtml(m.combinedReason)}` : ''}</p>
        </div>`
      )
      .join('');

    return renderPage({
      title:
        movedOrders.length > 1
          ? `Uloženo, ${vocative}! Přesunuto (${movedOrders.length}).`
          : `Uloženo, ${vocative}! Úkol přesunut.`,
      badgeEmoji: '📅',
      badgeBg: '#fffbeb',
      bodyHtml: `<p class="subtitle" style="text-align:center;">${
        movedOrders.length > 1 ? 'Vybrané úkoly byly přesunuty' : 'Úkol byl přesunut'
      } na <strong>${escapeHtml(
        movedOrders[0]?.newDateStr || chosenDate
      )}</strong> a poznámka byla uložena do SeePoint OS (${escapeHtml(timeFormatted)}).</p>
        ${movedHtml}
        <a href="${escapeHtml(detailUrl)}" class="btn btn-dark">${
        movedOrders.length > 1 ? 'Otevřít moje úkoly →' : 'Otevřít detail v aplikaci →'
      }</a>`,
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

